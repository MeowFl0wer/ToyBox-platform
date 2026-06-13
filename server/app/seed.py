"""初始化数据：建表 + 默认管理员 + 内置/规划模块 + 示例站点内容。幂等。"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from .core.config import settings
from .core.database import Base, SessionLocal, engine
from .core.security import hash_password
from .models import InstalledModule, Sequence, SiteContent, User

log = logging.getLogger("toybox.seed")


def _allocate_uid(db: Session) -> int:
    seq = db.get(Sequence, "user_uid")
    if seq is None:
        seq = Sequence(name="user_uid", value=0)
        db.add(seq)
        db.flush()
    seq.value += 1
    db.flush()
    return seq.value


_MODULES = [
    dict(
        module_id="welcome",
        name="欢迎小屋",
        description="登录后进来，看看今天的问候。",
        category="工具",
        icon="hand-heart",
        auth_required=True,
        builtin=True,
        status="active",
        sort_order=10,
    ),
    dict(
        module_id="todo",
        name="待办清单 Todo",
        description="把要做的事一件件记下来。",
        category="效率",
        icon="check-square",
        auth_required=True,
        builtin=False,
        status="coming_soon",
        sort_order=20,
    ),
    dict(
        module_id="journal",
        name="小本本",
        description="随手记录灵感与日常。",
        category="记录",
        icon="notebook-pen",
        auth_required=True,
        builtin=False,
        status="coming_soon",
        sort_order=30,
    ),
]


def run_seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.get(Sequence, "user_uid") is None:
            db.add(Sequence(name="user_uid", value=0))
            db.flush()

        # 默认管理员
        if db.query(User).filter(User.role == "admin").first() is None:
            admin = User(
                uid=_allocate_uid(db),
                username=settings.admin_username,
                nickname=settings.admin_nickname,
                email=settings.admin_email.lower(),
                password_hash=hash_password(settings.admin_password),
                role="admin",
                status="active",
            )
            db.add(admin)
            log.warning(
                "已创建默认管理员：用户名=%s 密码=%s（请尽快修改）",
                settings.admin_username,
                settings.admin_password,
            )

        # 模块注册表
        for m in _MODULES:
            if db.query(InstalledModule).filter(InstalledModule.module_id == m["module_id"]).first() is None:
                db.add(InstalledModule(**m))

        # 示例站点内容（可在后台编辑）
        if db.query(SiteContent).filter(SiteContent.content_key == "home.notice").first() is None:
            db.add(
                SiteContent(
                    content_key="home.notice",
                    title="首页公告",
                    content_type="plain_text",
                    content_value={"text": "ToyBox 正在慢慢长大，欢迎常来看看 ✨"},
                    status="published",
                )
            )

        db.commit()
    finally:
        db.close()
