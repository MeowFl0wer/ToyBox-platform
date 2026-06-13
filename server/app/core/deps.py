"""FastAPI 依赖：当前用户、管理员校验、客户端 IP。"""
from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from ..models import User
from .database import get_db
from .response import APIError, CODE_FORBIDDEN, CODE_UNAUTHORIZED
from .security import decode_access_token


def get_client_ip(request: Request) -> str:
    # 直连场景取 client.host；若经反代，可改读 X-Forwarded-For（需信任代理）
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
