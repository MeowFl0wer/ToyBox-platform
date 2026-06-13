"""FastAPI 依赖：当前用户、管理员校验、客户端 IP。"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from ..models import User, UserSession
from .database import get_db
from .response import APIError, CODE_FORBIDDEN, CODE_UNAUTHORIZED
from .security import decode_access_token, hash_token

REFRESH_COOKIE = "toybox_refresh"


def get_client_ip(request: Request) -> str:
    # 经可信反代时读 X-Forwarded-For 的首个 IP（供限流按真实客户端聚合）；否则取直连 IP
    from .config import settings

    if settings.trust_proxy:
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else ""


def _bearer(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = _bearer(request)
    if not token:
        raise APIError(CODE_UNAUTHORIZED, "未登录")
    payload = decode_access_token(token)
    if not payload:
        raise APIError(CODE_UNAUTHORIZED, "登录状态已失效，请重新登录")
    user = db.get(User, payload.get("sub"))
    if not user or user.status != "active":
        raise APIError(CODE_UNAUTHORIZED, "账号不可用")
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = _bearer(request)
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user = db.get(User, payload.get("sub"))
    if user and user.status == "active":
        return user
    return None


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise APIError(CODE_FORBIDDEN, "需要管理员权限")
    return user


def resolve_user_optional(request: Request, db: Session) -> User | None:
    """网关/iframe 场景：用 Bearer access token，或退回 HttpOnly 刷新 Cookie 识别当前用户。
    （iframe 内拿不到父窗口内存里的 access token，故支持 Cookie 兜底。）"""
    token = _bearer(request)
    if token:
        payload = decode_access_token(token)
        if payload:
            u = db.get(User, payload.get("sub"))
            if u and u.status == "active":
                return u
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        sess = db.query(UserSession).filter(UserSession.refresh_token_hash == hash_token(raw)).first()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if sess and sess.revoked_at is None and sess.expires_at > now:
            u = db.get(User, sess.user_id)
            if u and u.status == "active":
                return u
    return None
