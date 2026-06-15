"""主站公开接口：工具大厅模块列表、收藏、欢迎模块、站点内容渲染。"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core import ratelimit
from ..core.config import DATA_DIR, settings
from ..core.database import get_db
from ..core.deps import get_client_ip, get_current_user, get_optional_user
from ..core.response import (
    APIError,
    CODE_BAD_PARAM,
    CODE_CONFLICT,
    CODE_MODULE_DISABLED,
    CODE_MODULE_NOT_FOUND,
    CODE_NOT_FOUND,
    ok,
)
from ..core.security import clean_text, create_module_token
from ..models import InstalledModule, ModuleStorage, ModuleUserPreference, PageView, SiteContent, User
from ..modules_runtime import uses_platform_storage
from ..schemas import ModuleStorageSetIn, PageViewIn
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


# ---------- 平台托管存储（runtime.mode=platform_storage 模块用）----------
_STORAGE_KEY_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,120}$")


def _storage_module(db: Session, module_id: str) -> InstalledModule:
    """校验：模块存在、未隐藏、active，且 runtime.mode=platform_storage 才允许用托管存储。"""
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m or m.hidden:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    if m.status != "active":
        raise APIError(CODE_MODULE_DISABLED, "模块未启用")
    if not uses_platform_storage(m.manifest):
        raise APIError(CODE_MODULE_DISABLED, "该模块未使用平台托管存储")
    return m


def _check_key(key: str) -> str:
    if not _STORAGE_KEY_RE.match(key or ""):
        raise APIError(CODE_BAD_PARAM, "key 非法（只允许 1-120 位字母/数字/_.:- ）")
    return key


def _storage_out(row: ModuleStorage) -> dict:
    return {"key": row.key, "value": row.value_json, "updated_at": row.updated_at.isoformat() if row.updated_at else None}


@router.get("/modules/{module_id}/storage")
def storage_list(module_id: str, prefix: str = Query(default=""), limit: int = Query(default=100, ge=1, le=500),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _storage_module(db, module_id)
    q = db.query(ModuleStorage).filter(ModuleStorage.user_id == user.id, ModuleStorage.module_id == module_id)
    if prefix:
        q = q.filter(ModuleStorage.key.like(prefix.replace("%", "") + "%"))
    rows = q.order_by(ModuleStorage.key.asc()).limit(limit).all()
    return ok([_storage_out(r) for r in rows])


@router.get("/modules/{module_id}/storage/{key}")
def storage_get(module_id: str, key: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _storage_module(db, module_id)
    _check_key(key)
    row = (
        db.query(ModuleStorage)
        .filter(ModuleStorage.user_id == user.id, ModuleStorage.module_id == module_id, ModuleStorage.key == key)
        .first()
    )
    if not row:
        raise APIError(CODE_NOT_FOUND, "无此数据")
    return ok(_storage_out(row))


@router.put("/modules/{module_id}/storage/{key}")
def storage_set(module_id: str, key: str, body: ModuleStorageSetIn,
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _storage_module(db, module_id)
    _check_key(key)
    # 体积校验：按紧凑 JSON 字节数计
    try:
        size = len(json.dumps(body.value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    except (TypeError, ValueError):
        raise APIError(CODE_BAD_PARAM, "value 必须是可序列化的 JSON")
    if size > settings.module_storage_max_value_bytes:
        raise APIError(CODE_BAD_PARAM, f"value 过大（上限 {settings.module_storage_max_value_bytes // 1024}KB）")

    row = (
        db.query(ModuleStorage)
        .filter(ModuleStorage.user_id == user.id, ModuleStorage.module_id == module_id, ModuleStorage.key == key)
        .first()
    )
    # 配额：key 数 + 总字节数（更新已有 key 不增计数；总量按「替换后」计算）
    used = db.query(func.coalesce(func.sum(ModuleStorage.size_bytes), 0)).filter(
        ModuleStorage.user_id == user.id, ModuleStorage.module_id == module_id
    ).scalar() or 0
    if not row:
        count = db.query(func.count(ModuleStorage.id)).filter(
            ModuleStorage.user_id == user.id, ModuleStorage.module_id == module_id
        ).scalar() or 0
        if count >= settings.module_storage_max_keys:
            raise APIError(CODE_CONFLICT, f"key 数量已达上限（{settings.module_storage_max_keys}）")
        projected = used + size
    else:
        projected = used - (row.size_bytes or 0) + size
    if projected > settings.module_storage_max_total_bytes:
        raise APIError(CODE_CONFLICT, f"存储总量超限（上限 {settings.module_storage_max_total_bytes // 1024 // 1024}MB）")

    if not row:
        row = ModuleStorage(user_id=user.id, module_id=module_id, key=key)
        db.add(row)
    row.value_json = body.value
    row.size_bytes = size
    db.commit()
    db.refresh(row)
    return ok(_storage_out(row), message="已保存")


@router.delete("/modules/{module_id}/storage/{key}")
def storage_delete(module_id: str, key: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _storage_module(db, module_id)
    _check_key(key)
    db.query(ModuleStorage).filter(
        ModuleStorage.user_id == user.id, ModuleStorage.module_id == module_id, ModuleStorage.key == key
    ).delete(synchronize_session=False)
    db.commit()
    return ok(message="已删除")


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
