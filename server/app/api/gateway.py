"""Module Gateway（架构文档 11）：/api/modules/{module_id}/{path} 统一鉴权 + 签名转发。

职责：识别模块 → 检查已安装/启用/运行 → 检查登录要求 → 生成签名用户上下文 →
转发请求到模块后端 internal_backend_url → 透传响应。不负责模块业务逻辑。
"""
from __future__ import annotations

import json
import posixpath
import time
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, Request, Response
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db
from ..core.response import (
    APIError,
    CODE_MODULE_DISABLED,
    CODE_MODULE_NOT_FOUND,
    CODE_UNAUTHORIZED,
)
from ..core.security import build_module_user_headers, decode_module_token
from ..models import InstalledModule, ModuleUserPreference, User

router = APIRouter(prefix="/api/modules", tags=["gateway"])

_HOP_BY_HOP = {"connection", "keep-alive", "transfer-encoding", "content-length", "host"}

# 禁止跟随模块后端的 30x 重定向：否则模块可借重定向把请求导向 /admin、/health 或外部地址，绕过白名单
class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: ANN002, ANN003, D102
        return None


_opener = urllib.request.build_opener(_NoRedirect)
_REDIRECT_REJECT = json.dumps({"code": 20003, "message": "模块返回了非法重定向", "data": None}).encode("utf-8")
_NO_RESPONSE = json.dumps({"code": 20003, "message": "模块无响应", "data": None}).encode("utf-8")


def _forward(method: str, url: str, body: bytes, headers: dict[str, str]) -> tuple[int, bytes, str]:
    req = urllib.request.Request(url, data=body or None, method=method, headers=headers)
    try:
        with _opener.open(req, timeout=30) as r:
            if 300 <= r.status < 400:  # 模块业务接口不应重定向
                return 502, _REDIRECT_REJECT, "application/json"
            return r.status, r.read(), r.headers.get("Content-Type", "application/json")
    except urllib.error.HTTPError as e:
        if 300 <= e.code < 400:  # 禁用重定向后 3xx 会以 HTTPError 抛出
            return 502, _REDIRECT_REJECT, "application/json"
        return e.code, e.read(), e.headers.get("Content-Type", "application/json")
    except Exception:  # noqa: BLE001
        return 502, _NO_RESPONSE, "application/json"


@router.api_route("/{module_id}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def gateway(module_id: str, path: str, request: Request, db: Session = Depends(get_db)):
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m or m.hidden:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    if m.status != "active" or not m.internal_backend_url:
        raise APIError(CODE_MODULE_DISABLED, "模块未启用或未在运行")

    # 转发路径白名单（module.yaml 的 gateway.allow_paths）：fail-closed —— 未声明就一律拒绝，
    # 仅 gateway.allow_paths 命中的业务路径放行；模块后端的 /health、/admin、/internal 等不暴露。
    # 旧/特殊模块若确需放行全部，必须在 module.yaml 显式声明 gateway.legacy_allow_all: true。
    # 路径规范化 + 可疑字符拒绝（防 ../、编码绕过白名单或打到未开放路径）
    # 原始路径段一律不允许百分号编码（含 %2e/%2f/%5c 及双重编码 %25xx）；需要编码的值请放查询参数。
    raw_path = request.scope.get("raw_path", b"").decode("latin-1", "ignore")
    if "%" in raw_path:
        raise APIError(CODE_MODULE_NOT_FOUND, "该模块接口未开放")
    if ".." in path or "\\" in path or any(ord(c) < 32 for c in path):
        raise APIError(CODE_MODULE_NOT_FOUND, "该模块接口未开放")
    sub = posixpath.normpath("/" + path)  # 规范化后的安全路径，用于匹配与转发
    if not sub.startswith("/") or ".." in sub:
        raise APIError(CODE_MODULE_NOT_FOUND, "该模块接口未开放")

    gw = m.manifest.get("gateway", {}) if isinstance(m.manifest, dict) else {}
    if gw.get("legacy_allow_all") is not True:  # 必须严格布尔 true 才放行全部
        allow = gw.get("allow_paths") if isinstance(gw.get("allow_paths"), list) else []  # 非 list 一律视为空 → 拒
        ok_path = any(
            isinstance(a, str) and a.startswith("/") and a != "/" and (sub == a or sub.startswith(a.rstrip("/") + "/"))
            for a in allow
        )
        if not ok_path:
            raise APIError(CODE_MODULE_NOT_FOUND, "该模块接口未开放")

    # 鉴权改用模块级 token（Bearer），不再凭 Cookie——iframe 已 sandbox 为不透明源、拿不到 Cookie
    user = None
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        tok = decode_module_token(auth[7:].strip(), module_id)
        if tok:
            u = db.get(User, tok.get("sub"))
            # 绑定 token_version：改密码/重置 2FA 后旧模块 token 立即失效
            if u and u.status == "active" and int(tok.get("ver", 0)) == int(u.token_version or 0):
                user = u
    if m.auth_required and not user:
        raise APIError(CODE_UNAUTHORIZED, "请先登录")

    exp = int(time.time()) + 300
    if user:
        # 下发给模块的「主站用户资料」：包含展示所需的非敏感字段。
        # 邮箱按需下发：仅当模块在 module.yaml 声明 auth.request_email: true 才给（最小权限）。
        payload = {
            "sub": user.id,                          # 签名过的内部用户 id（模块据此隔离数据）
            "uid": user.uid,                         # 数字 uid
            "uid_display": user.uid_display,         # 展示用 000001
            "username": user.username,               # 登录名（唯一）
            "nickname": user.nickname,               # 昵称（可空）
            "display_name": user.nickname or user.username,  # 展示名（已回退）
            "avatar_url": user.avatar_url,           # 头像（站内相对路径，同源可直接加载）
            "roles": [user.role],
            "ver": user.token_version,
            "module_id": module_id,
            "auth_required": m.auth_required,
            "exp": exp,
        }
        if ((m.manifest.get("auth") or {}).get("request_email") is True) if isinstance(m.manifest, dict) else False:
            payload["email"] = user.email
        # 记录最近使用（主站层偏好，非模块业务数据）
        pref = (
            db.query(ModuleUserPreference)
            .filter(ModuleUserPreference.user_id == user.id, ModuleUserPreference.module_id == module_id)
            .first()
        )
        if not pref:
            pref = ModuleUserPreference(user_id=user.id, module_id=module_id)
            db.add(pref)
        pref.use_count = (pref.use_count or 0) + 1
        from datetime import datetime, timezone
        pref.last_used_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
    else:
        payload = {
            "sub": None,
            "anonymous": True,
            "persistence_allowed": False,
            "module_id": module_id,
            "auth_required": False,
            "exp": exp,
        }

    headers = build_module_user_headers(module_id, payload)
    ct = request.headers.get("Content-Type")
    if ct:
        headers["Content-Type"] = ct

    target = m.internal_backend_url.rstrip("/") + sub  # 只转发规范化后的安全路径
    if request.url.query:
        target += "?" + request.url.query
    body = await request.body()

    status, content, resp_ct = await run_in_threadpool(_forward, request.method, target, body, headers)
    return Response(content=content, status_code=status, media_type=resp_ct)
