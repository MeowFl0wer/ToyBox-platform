"""主站签名用户上下文解析与校验（架构文档 10.2）。

主站网关转发请求到模块后端时附带：
  X-PT-Module-Id:        模块 id
  X-PT-User-Context:     base64url(json)  —— 用户上下文
  X-PT-User-Signature:   hmac_sha256_hex(MODULE_SIGN_KEY, X-PT-User-Context)

模块**只信任主站签名过的 Header**，绝不信任前端直接传来的 user_id。
MODULE_SIGN_KEY 由主站部署模块时通过环境变量注入。
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends, Request

from .response import CODE_FORBIDDEN, CODE_UNAUTHORIZED, ModuleError

MODULE_SIGN_KEY = os.environ.get("MODULE_SIGN_KEY", "dev-insecure-key")
MODULE_ID = os.environ.get("MODULE_ID", "welcome")


class UserContext:
    def __init__(self, payload: dict):
        self.sub: str | None = payload.get("sub")
        self.username: str = payload.get("username", "")
        self.email: str = payload.get("email", "")
        self.roles: list[str] = payload.get("roles", [])
        self.anonymous: bool = bool(payload.get("anonymous"))
        self.persistence_allowed: bool = bool(payload.get("persistence_allowed", not self.anonymous))
        self.module_id: str = payload.get("module_id", "")


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def parse_user_context(request: Request) -> UserContext | None:
    ctx_b64 = request.headers.get("X-PT-User-Context")
    sig = request.headers.get("X-PT-User-Signature")
    if not ctx_b64 or not sig:
        return None
    expected = hmac.new(MODULE_SIGN_KEY.encode("utf-8"), ctx_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        payload = json.loads(_b64url_decode(ctx_b64))
    except Exception:  # noqa: BLE001
        return None
    if payload.get("exp") and int(payload["exp"]) < int(time.time()):
        return None
    return UserContext(payload)


def get_user_context(request: Request) -> UserContext:
    """可选上下文：匿名也返回（用于无需登录模块）。"""
    ctx = parse_user_context(request)
    if ctx is None:
        # 没有有效签名时按匿名处理
        return UserContext({"anonymous": True, "persistence_allowed": False, "module_id": MODULE_ID})
    return ctx


def require_user(ctx: UserContext = Depends(get_user_context)) -> UserContext:
    """需要登录的接口用此依赖：匿名或无 sub 直接拒绝。"""
    if ctx.anonymous or not ctx.sub:
        raise ModuleError(CODE_UNAUTHORIZED, "需要登录后通过主站访问", http_status=401)
    return ctx
