"""后台管理接口（/api/admin/*）。仅管理员可访问，所有写操作记审计日志。"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_client_ip, require_admin
from ..core.response import (
    APIError,
    CODE_BAD_PARAM,
    CODE_CONFLICT,
    CODE_FORBIDDEN,
    CODE_MODULE_NOT_FOUND,
    CODE_NOT_FOUND,
    ok,
)
from ..core.security import clean_text, sanitize_html, strip_tags
from ..models import AdminAuditLog, InstalledModule, SiteContent, User
from ..schemas import ComingSoonIn, ModuleUpdateIn, SiteContentIn
from ..serializers import module_public, user_public

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(db: Session, request: Request, admin: User, action: str, ttype: str, tid: str, payload: dict | None = None):
    db.add(
        AdminAuditLog(
            admin_user_id=admin.id,
            action=action,
            target_type=ttype,
            target_id=tid,
            payload=payload or {},
            ip_address=get_client_ip(request),
        )
    )


# ---------- Dashboard ----------
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users_total = db.query(User).count()
    users_active = db.query(User).filter(User.status == "active").count()
    mods = db.query(InstalledModule).all()
    return ok(
        {
            "users_total": users_total,
            "users_active": users_active,
            "modules_total": len(mods),
            "modules_active": sum(1 for m in mods if m.status == "active"),
            "modules_coming_soon": sum(1 for m in mods if m.status == "coming_soon"),
            "modules_hidden": sum(1 for m in mods if m.hidden),
        }
    )


# ---------- 模块管理 ----------
@router.get("/modules")
def admin_list_modules(db: Session = Depends(get_db)):
    mods = (
        db.query(InstalledModule)
        .order_by(InstalledModule.sort_order.asc(), InstalledModule.created_at.asc())
        .all()
    )
    return ok([module_public(m) for m in mods])


@router.post("/modules")
def publish_coming_soon(body: ComingSoonIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """发布一个「即将上线」的功能入口（内容编辑里的即将上线内容发布）。"""
    if db.query(InstalledModule).filter(InstalledModule.module_id == body.module_id).first():
        raise APIError(CODE_CONFLICT, "该模块 ID 已存在")
    m = InstalledModule(
        module_id=body.module_id,
        name=body.name,
        description=body.description,
        category=body.category or "工具",
        icon=body.icon or "sparkles",
        auth_required=True,
        builtin=False,
        status="coming_soon",
        sort_order=200,
    )
    db.add(m)
    _audit(db, request, admin, "module.publish_coming_soon", "module", body.module_id, {"name": body.name})
    db.commit()
    return ok(module_public(m), message="已发布即将上线入口")


@router.put("/modules/{module_id}")
def update_module(module_id: str, body: ModuleUpdateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    if body.name is not None:
        m.name = clean_text(body.name, 50)
    if body.description is not None:
        m.description = clean_text(body.description, 200)
    if body.category is not None:
        m.category = clean_text(body.category, 20)
    if body.status is not None:
        m.status = body.status
    _audit(db, request, admin, "module.update", "module", module_id, body.model_dump(exclude_none=True))
    db.commit()
    return ok(module_public(m), message="已更新")


@router.post("/modules/{module_id}/hide")
def hide_module(module_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    m.hidden = True
    _audit(db, request, admin, "module.hide", "module", module_id)
    db.commit()
    return ok(module_public(m), message="已隐藏")


@router.post("/modules/{module_id}/unhide")
def unhide_module(module_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    m.hidden = False
    _audit(db, request, admin, "module.unhide", "module", module_id)
    db.commit()
    return ok(module_public(m), message="已取消隐藏")


@router.delete("/modules/{module_id}")
def uninstall_module(module_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    m = db.query(InstalledModule).filter(InstalledModule.module_id == module_id).first()
    if not m:
        raise APIError(CODE_MODULE_NOT_FOUND, "模块不存在")
    if m.builtin:
        raise APIError(CODE_FORBIDDEN, "内置模块不可卸载")
    db.delete(m)
    _audit(db, request, admin, "module.uninstall", "module", module_id, {"name": m.name})
    db.commit()
    return ok(message="已卸载")


@router.post("/modules/install")
def install_module(request: Request, admin: User = Depends(require_admin)):
    """GitHub 安装 / Docker 部署：按架构文档规划，当前为占位（务实子集阶段未实现）。"""
    raise APIError(CODE_BAD_PARAM, "GitHub 安装与一键部署功能规划中（占位）")


# ---------- 用户管理 ----------
@router.get("/users")
def admin_list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.uid.asc()).all()
    return ok([user_public(u) for u in users])


@router.post("/users/{user_id}/disable")
def disable_user(user_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    u = db.get(User, user_id)
    if not u:
        raise APIError(CODE_NOT_FOUND, "用户不存在")
    if u.id == admin.id:
        raise APIError(CODE_FORBIDDEN, "不能禁用自己")
    u.status = "disabled"  # 注意：uid 不释放、不复用
    _audit(db, request, admin, "user.disable", "user", user_id)
    db.commit()
    return ok(user_public(u), message="已禁用")


@router.post("/users/{user_id}/enable")
def enable_user(user_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    u = db.get(User, user_id)
    if not u:
        raise APIError(CODE_NOT_FOUND, "用户不存在")
    u.status = "active"
    _audit(db, request, admin, "user.enable", "user", user_id)
    db.commit()
    return ok(user_public(u), message="已启用")


# ---------- 网站内容编辑 ----------
@router.get("/site-contents")
def admin_list_contents(db: Session = Depends(get_db)):
    rows = db.query(SiteContent).order_by(SiteContent.content_key.asc()).all()
    return ok(
        [
            {
                "content_key": r.content_key,
                "title": r.title,
                "content_type": r.content_type,
                "content_value": r.content_value,
                "status": r.status,
                "version": r.version,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]
    )


def _sanitize_content(content_type: str, value: dict) -> dict:
    """入库前清洗，防 XSS。"""
    out = dict(value or {})
    if content_type == "rich_text" and isinstance(out.get("html"), str):
        out["html"] = sanitize_html(out["html"])
    elif content_type == "markdown" and isinstance(out.get("markdown"), str):
        out["markdown"] = out["markdown"][:20000]  # 前端渲染时再做 markdown->安全HTML
    else:
        if isinstance(out.get("text"), str):
            out["text"] = clean_text(strip_tags(out["text"]), 5000)
    return out


@router.put("/site-contents/{content_key}")
def upsert_content(content_key: str, body: SiteContentIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    key = content_key.strip()[:200]
    value = _sanitize_content(body.content_type, body.content_value)
    row = db.query(SiteContent).filter(SiteContent.content_key == key).first()
    if not row:
        row = SiteContent(content_key=key)
        db.add(row)
        row.version = 1
    else:
        row.version += 1
    row.title = clean_text(body.title, 200)
    row.content_type = body.content_type
    row.content_value = value
    row.status = body.status
    row.updated_by = admin.id
    _audit(db, request, admin, "content.upsert", "site_content", key, {"version": row.version})
    db.commit()
    return ok({"content_key": key, "version": row.version}, message="内容已保存")
