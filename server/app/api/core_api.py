"""主站公开接口：工具大厅模块列表、收藏、欢迎模块、站点内容渲染。"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..core import ratelimit
from ..core.config import DATA_DIR
from ..core.database import get_db
from ..core.deps import get_client_ip, get_current_user, get_optional_user
from ..core.response import APIError, CODE_MODULE_DISABLED, CODE_MODULE_NOT_FOUND, ok
from ..core.security import clean_text, create_module_token
from ..models import InstalledModule, ModuleUserPreference, PageView, SiteContent, User
from ..schemas import PageViewIn
from ..serializers import module_public

router = APIRouter(prefix="/api/core", tags=["core"])


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _prefs_map(db: Session, user: User | None) -> dict[str, ModuleUserPreference]:
    if not user:
        return {}
    rows = db.query(ModuleUserPreference).filter(ModuleUserPreference.user_id == user.id).all()
    return {r.module_id: r for r in rows}


def _get_pref(db: Session, user: User, module_id: str) -> ModuleUserPreference:
    pref = (
        db.query(ModuleUserPreference)
        .filter(ModuleUserPreference.user_id == user.id, ModuleUserPreference.module_id == module_id)
        .first()
    )
    if not pref:
        pref = ModuleUserPreference(user_id=user.id, module_id=module_id)
        db.add(pref)
        db.flush()
    return pref


@router.get("/modules")
def list_modules(db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    """工具大厅：只展示未隐藏的模块（来自注册表，而非前端写死）。"""
    mods = (
        db.query(InstalledModule)
        .filter(InstalledModule.hidden == False)  # noqa: E712
        .order_by(InstalledModule.sort_order.asc(), InstalledModule.created_at.asc())
        .all()
    )
    prefs = _prefs_map(db, user)
    return ok([module_public(m, prefs.get(m.module_id)) for m in mods])


@router.post("/modules/{module_id}/favorite")
def add_favorite(module_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m or m.hidden:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    pref = _get_pref(db, user, module_id)
    pref.favorite = True
    db.commit()
    return ok(module_public(m, pref), message="已收藏")


@router.delete("/modules/{module_id}/favorite")
def remove_favorite(module_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    pref = _get_pref(db, user, module_id)
    pref.favorite = False
    db.commit()
    return ok(module_public(m, pref), message="已取消收藏")


@router.post("/modules/{module_id}/token")
def issue_module_token(module_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """为 iframe 宿主签发模块级短期 token（供 postMessage RPC 调用网关），需登录。"""
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m or m.hidden:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    if m.status != "active":
        raise APIError(CODE_MODULE_DISABLED, "模块未启用")
    return ok({"token": create_module_token(user.id, module_id, version=user.token_version), "expires_in": 1800})


@router.post("/analytics/page-view")
def report_page_view(
    body: PageViewIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """前端路由变化时上报访问。UV 用登录用户 id，否则用 IP。"""
    ip = get_client_ip(request)
    if not ratelimit.allow(f"pv:{user.id if user else ip}", limit=120, window_s=60):
        return ok()  # 限流时静默丢弃，不报错
    db.add(
        PageView(
            user_id=user.id if user else None,
            visitor=user.id if user else (ip or "anon"),
            path=clean_text(body.path, 300),
            module_id=clean_text(body.module_id, 100),
            referrer=clean_text(body.referrer, 300),
            user_agent=request.headers.get("User-Agent", "")[:300],
            ip_address=ip,
        )
    )
    db.commit()
    return ok()


_AVATAR_DIR = DATA_DIR / "avatars"
_AVATAR_MIME = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}
# 用户内部 id：UUID 字符（防路径穿越/枚举其它文件）
_AVATAR_ID_RE = re.compile(r"^[0-9a-fA-F-]{8,36}$")


@router.get("/avatar/{user_id}")
def get_avatar(user_id: str):
    """公开返回某用户头像图片（头像非敏感数据，img 标签需无凭证直接加载）。"""
    if not _AVATAR_ID_RE.match(user_id):
        raise APIError(CODE_MODULE_NOT_FOUND, "头像不存在")
    for ext, mime in _AVATAR_MIME.items():
        p = _AVATAR_DIR / f"{user_id}.{ext}"
        if p.exists():
            return FileResponse(str(p), media_type=mime)
    raise APIError(CODE_MODULE_NOT_FOUND, "头像不存在")


@router.get("/site-contents")
def site_contents(keys: str = Query(default=""), db: Session = Depends(get_db)):
    """按 key 批量取已发布内容。前端定义展示位置，后台定义内容。"""
    key_list = [k.strip() for k in keys.split(",") if k.strip()][:50]
    out: dict[str, dict] = {}
    if key_list:
        rows = (
            db.query(SiteContent)
            .filter(SiteContent.content_key.in_(key_list), SiteContent.status == "published")
            .all()
        )
        for r in rows:
            out[r.content_key] = {"content_type": r.content_type, "content_value": r.content_value}
    return ok(out)
