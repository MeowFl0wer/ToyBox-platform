"""安全相关：密码哈希、JWT、验证码、模块上下文签名、输入清洗。

加固要点：
- 密码用 bcrypt 加盐哈希；登录失败信息统一、不泄露账号是否存在
- JWT 短期 access + 区分 token 类型；refresh 走 HttpOnly Cookie（在 api 层设置）
- 验证码只存哈希、限次、限时、一次性
- 所有可入库文本统一清洗控制字符并限长；富文本/Markdown 用 bleach 白名单清洗，防 XSS
- 比对敏感值用恒定时间比较，防时序攻击
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import time
import unicodedata
from datetime import datetime, timedelta, timezone

import bcrypt
import bleach
import jwt

from .config import settings

# ---------- 密码 ----------
_BCRYPT_MAX_BYTES = 72  # bcrypt 算法上限


def hash_password(plain: str) -> str:
    pw = plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(pw, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:_BCRYPT_MAX_BYTES], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------- JWT ----------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(sub: str, role: str) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(minutes=settings.access_token_ttl_min)).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != "access":
        return None
    return payload


def create_module_token(user_id: str, module_id: str, ttl_min: int = 30) -> str:
    """模块级短期 token：由主站签发给 iframe 宿主，仅用于访问该模块网关。
    与 access token 区分（type=module、绑定 mod=module_id），即便泄露也只能访问该模块。"""
    now = _now()
    payload = {
        "sub": user_id,
        "mod": module_id,
        "type": "module",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl_min)).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_module_token(token: str, module_id: str) -> str | None:
    """校验模块 token，返回 user_id；type 必须为 module 且 mod 必须等于当前模块。"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != "module" or payload.get("mod") != module_id:
        return None
    return payload.get("sub")


def new_refresh_token() -> str:
    """不可猜测的随机 refresh token（明文给前端 Cookie，库里只存哈希）。"""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---------- 验证码 ----------
def new_verify_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(code: str) -> str:
    # 加盐（用 secret_key 作为 pepper）后哈希
    return hashlib.sha256(f"{settings.secret_key}:{code}".encode("utf-8")).hexdigest()


def constant_time_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


# ---------- 模块用户上下文签名（架构文档 10.2）----------
def module_sign_key_for(module_id: str) -> str:
    """每个模块的独立签名密钥 = HMAC(主密钥, module_id)。

    避免把同一个全局密钥下发给所有模块——这样即使某模块拿到自己的密钥，
    也无法伪造其它模块/用户的上下文（不同 module_id 派生出不同密钥）。
    主站签名用此 key，模块的 MODULE_SIGN_KEY env 也注入同一派生 key，验签方案不变。
    """
    return hmac.new(settings.module_sign_key.encode("utf-8"), module_id.encode("utf-8"), hashlib.sha256).hexdigest()


def build_module_user_headers(module_id: str, payload: dict) -> dict[str, str]:
    """生成主站网关转发给模块后端的签名 Header（方案与模块模板 auth.py 一致）：
      X-PT-User-Context   = base64url(json，紧凑、key 排序)
      X-PT-User-Signature = hmac_sha256_hex(本模块派生密钥, X-PT-User-Context)
    """
    key = module_sign_key_for(module_id)
    ctx_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    ctx_b64 = base64.urlsafe_b64encode(ctx_json.encode("utf-8")).decode("utf-8").rstrip("=")
    sig = hmac.new(key.encode("utf-8"), ctx_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    return {
        "X-PT-Module-Id": module_id,
        "X-PT-User-Context": ctx_b64,
        "X-PT-User-Signature": sig,
    }


# ---------- 输入清洗 / 校验 ----------
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")


def clean_text(value: str | None, max_len: int) -> str:
    """去除控制字符、做 NFKC 归一化、trim、限长。用于昵称/简介等纯文本字段。"""
    if value is None:
        return ""
    value = unicodedata.normalize("NFKC", value)
    value = _CONTROL_RE.sub("", value).strip()
    return value[:max_len]


def sanitize_html(value: str, *, max_len: int = 20000) -> str:
    """富文本/Markdown 入库或渲染前的 HTML 清洗（白名单），防 XSS。"""
    cleaned = bleach.clean(
        value[:max_len],
        tags=["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "a", "code", "pre", "blockquote", "h3", "h4"],
        attributes={"a": ["href", "title"]},
        protocols=["http", "https", "mailto"],
        strip=True,
    )
    return bleach.linkify(cleaned) if cleaned else cleaned


def strip_tags(value: str) -> str:
    """彻底去除所有 HTML 标签，用于纯文本字段的纵深防御。"""
    return bleach.clean(value, tags=[], attributes={}, strip=True)


def is_safe_url(value: str) -> bool:
    """头像等链接：仅允许 http(s) 或站内相对路径，挡 javascript: / data: 等。"""
    if not value:
        return True
    v = value.strip().lower()
    if v.startswith("/"):
        return True
    return v.startswith("http://") or v.startswith("https://")
