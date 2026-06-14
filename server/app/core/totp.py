"""TOTP（RFC 6238）纯 Python 实现，用于管理员登录的动态口令二次验证。

不引入第三方依赖：标准库即可生成密钥、计算/校验 6 位动态码，并产出 otpauth:// 配对串
（兼容 Google Authenticator / Microsoft Authenticator / Authy / 1Password 等）。
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
import urllib.parse

PERIOD = 30   # 时间步长（秒）
DIGITS = 6


def generate_secret(num_bytes: int = 20) -> str:
    """生成 base32 编码的随机密钥（默认 160 bit，符合 RFC 4226 推荐）。"""
    return base64.b32encode(secrets.token_bytes(num_bytes)).decode("ascii").rstrip("=")


def _b32decode(secret: str) -> bytes:
    s = secret.strip().replace(" ", "").upper()
    s += "=" * (-len(s) % 8)  # 补齐 base32 padding
    return base64.b32decode(s, casefold=True)


def _hotp(secret: str, counter: int) -> str:
    key = _b32decode(secret)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{code % (10 ** DIGITS):0{DIGITS}d}"


def now_code(secret: str, t: float | None = None) -> str:
    return _hotp(secret, int((t if t is not None else time.time()) // PERIOD))


def verify(secret: str, code: str, window: int = 1, t: float | None = None) -> bool:
    """校验动态码；window 允许前后各 N 个时间步，吸收时钟漂移。恒定时间比较防时序攻击。"""
    if not secret or not code:
        return False
    code = code.strip()
    if not (code.isdigit() and len(code) == DIGITS):
        return False
    counter = int((t if t is not None else time.time()) // PERIOD)
    for w in range(-window, window + 1):
        if counter + w < 0:
            continue
        if hmac.compare_digest(_hotp(secret, counter + w), code):
            return True
    return False


def provisioning_uri(secret: str, account: str, issuer: str = "ToyBox") -> str:
    """生成 otpauth://totp 配对串。authenticator 扫码或「手动输入密钥」均可。"""
    label = urllib.parse.quote(f"{issuer}:{account}")
    query = urllib.parse.urlencode({
        "secret": secret,
        "issuer": issuer,
        "algorithm": "SHA1",
        "digits": DIGITS,
        "period": PERIOD,
    })
    return f"otpauth://totp/{label}?{query}"
