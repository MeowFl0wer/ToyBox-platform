"""主站公开接口：工具大厅模块列表、收藏、欢迎模块、站点内容渲染。"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user, get_optional_user
from ..core.response import APIError, CODE_MODULE_NOT_FOUND, ok
from ..models import InstalledModule, ModuleUserPreference, SiteContent, User
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
