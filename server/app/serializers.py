"""把 ORM 对象转成对外 JSON（避免泄露 password_hash 等敏感字段）。"""
from __future__ import annotations

from .models import InstalledModule, ModuleUserPreference, User


def user_public(u: User) -> dict:
    return {
        "id": u.id,
        "uid": u.uid,
        "uid_display": u.uid_display,          # 展示用：000001
        "username": u.username,
        "nickname": u.nickname or u.username,
        "email": u.email,
        "avatar_url": u.avatar_url,
        "bio": u.bio,
        "email_verified": bool(u.email_verified),
        "role": u.role,
        "status": u.status,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def module_public(m: InstalledModule, pref: ModuleUserPreference | None = None) -> dict:
    from .modules_runtime import runtime_mode_for  # 延迟导入避免循环

    return {
        "module_id": m.module_id,
        "name": m.name,
        "description": m.description,
        "category": m.category,
        "icon": m.icon,
        "auth_required": m.auth_required,
        "status": m.status,            # active | coming_soon
        "runtime_mode": runtime_mode_for(m.manifest),  # static / platform_storage / container / lazy_container
        "builtin": m.builtin,
        "hidden": m.hidden,
        "sort_order": m.sort_order,
        "favorite": bool(pref.favorite) if pref else False,
        "pinned": bool(pref.pinned) if pref else False,
        "last_used_at": pref.last_used_at.isoformat() if pref and pref.last_used_at else None,
        "use_count": pref.use_count if pref else 0,
    }
