"""Module Gateway（架构文档 11）：/api/modules/{module_id}/{path} 统一鉴权 + 签名转发。

职责：识别模块 → 检查已安装/启用/运行 → 检查登录要求 → 生成签名用户上下文 →
转发请求到模块后端 internal_backend_url → 透传响应。不负责模块业务逻辑。
"""
from __future__ import annotations

import json
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


def _forward(method: str, url: str, body: bytes, headers: dict[str, str]) -> tuple[int, bytes, str]:
    req = urllib.request.Request(url, data=body or None, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read(), r.headers.get("Content-Type", "application/json")
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers.get("Content-Type", "application/json")
    except Exception:  # noqa: BLE001
        return 502, json.dumps({"code": 20003, "message": "模块无响应", "data": None}).encode(), "application/json"


@router.api_route("/{module_id}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def gateway(module_id: str, path: str, request: Request, db: Session = Depends(get_db)):
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m or m.hidden:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    if m.status != "active" or not m.internal_backend_url:
        raise APIError(CODE_MODULE_DISABLED, "模块未启用或未在运行")

    # 转发路径白名单（module.yaml 的 gateway.allow_paths）：声明了就只放行匹配路径，
    # 避免把模块后端的 /health、/admin、/internal 等非业务接口经网关暴露给用户。
    allow = (m.manifest or {}).get("gateway", {}).get("allow_paths") if isinstance(m.manifest, dict) else None
    if allow:
        sub = "/" + path
        if not any(sub == a or sub.startswith(a.rstrip("/") + "/") for a in allow):
            raise APIError(CODE_MODULE_NOT_FOUND, "该模块接口未开放")

    # 鉴权改用模块级 token（Bearer），不再凭 Cookie——iframe 已 sandbox 为不透明源、拿不到 Cookie
    user = None
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        uid = decode_module_token(auth[7:].strip(), module_id)
        if uid:
            u = db.get(User, uid)
            if u and u.status == "active":
                user = u
    if m.auth_required and not user:
        raise APIError(CODE_UNAUTHORIZED, "请先登录")

    exp = int(time.time()) + 300
    if user:
        payload = {
            "sub": user.id,
            "username": user.nickname or user.username,
            "email": user.email,
            "roles": [user.role],
            "module_id": module_id,
            "auth_required": m.auth_required,
            "exp": exp,
        }
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

    target = m.internal_backend_url.rstrip("/") + "/" + path
    if request.url.query:
        target += "?" + request.url.query
    body = await request.body()

    status, content, resp_ct = await run_in_threadpool(_forward, request.method, target, body, headers)
    return Response(content=content, status_code=status, media_type=resp_ct)
