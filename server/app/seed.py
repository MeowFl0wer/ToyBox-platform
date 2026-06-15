"""初始化数据：建表 + 默认管理员 + 内置/规划模块 + 示例站点内容。幂等。"""
from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .core.config import settings
from .core.database import Base, SessionLocal, engine
from .core.security import hash_password
from .models import InstalledModule, Sequence, SiteContent, User

log = logging.getLogger("toybox.seed")


# 现有库轻量迁移：补齐后加的列（系统未部署，直接 ALTER + 回填，无需 alembic）。
_COLUMN_MIGRATIONS = {
    "users": {
        # 历史用户都是经邮箱验证码注册/管理员创建的，回填为已验证
        "email_verified": "BOOLEAN NOT NULL DEFAULT 1",
        # 管理员动态口令二次验证（默认空 / 未绑定，首次登录时引导绑定）
        "totp_secret": "VARCHAR(64) NOT NULL DEFAULT ''",
        "totp_enabled": "BOOLEAN NOT NULL DEFAULT 0",
        "totp_pending_at": "DATETIME",
        "totp_recovery": "TEXT NOT NULL DEFAULT ''",
        "token_version": "INTEGER NOT NULL DEFAULT 0",
    },
    "module_install_jobs": {
        "updated_at": "DATETIME",  # 心跳列，用于回收崩溃中断的安装任务
    },
}


def _migrate_columns() -> None:
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, cols in _COLUMN_MIGRATIONS.items():
            if table not in existing_tables:
                continue
            have = {c["name"] for c in insp.get_columns(table)}
            for col, ddl in cols.items():
                if col not in have:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))
                    log.info("迁移：为 %s 增加列 %s", table, col)


def _allocate_uid(db: Session) -> int:
    seq = db.get(Sequence, "user_uid")
    if seq is None:
        seq = Sequence(name="user_uid", value=0)
        db.add(seq)
        db.flush()
    seq.value += 1
    db.flush()
    return seq.value


# welcome 模块改为通过「后台 → 模块部署」从 GitHub 安装（personal-tool-module-welcome），
# 不再内置；todo / journal 仍作为「即将上线」占位入口。
_MODULES = [
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
    _migrate_columns()
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
                email_verified=True,
            )
            db.add(admin)
            if settings.dev_mode:
                log.warning("已创建默认管理员：用户名=%s 密码=%s（开发态显示，请尽快修改）",
                            settings.admin_username, settings.admin_password)
            else:
                log.warning("已创建管理员 %s（密码取自环境变量）", settings.admin_username)

        # 模块注册表
        for m in _MODULES:
            if db.query(InstalledModule).filter(InstalledModule.module_id == m["module_id"]).first() is None:
                db.add(InstalledModule(**m))

        # 站点可编辑内容：用「前端当前写死的文案」作为默认值入库，后台改了即生效，未改则前端回退到默认。
        _seed_contents(db)

        db.commit()
    finally:
        db.close()


# content_key -> (标题, content_type, 默认值)。前端按 key 取，取不到则用内置兜底。
_SITE_CONTENTS: list[tuple[str, str, str, dict]] = [
    ("home.notice", "首页公告", "plain_text",
     {"text": "ToyBox 正在慢慢长大，欢迎常来看看 ✨"}),
    ("home.hero_subtitle", "首页 · 主标题下副文案", "plain_text",
     {"text": "一个可以慢慢加功能的小盒子。工具、游戏、灵感实验和生活记录都会被放在这里，"
              "首页保持完整清爽，每次打开都能看到它又长大一点。"}),
    ("home.banner", "首页 · 底部横幅", "json",
     {"title": "慢慢装满这个盒子",
      "text": "后续内容现在回到主页下方，页面会更自然地向下展开；每次加一个真的会用到的小功能，"
              "ToyBox 就多一格可以玩的空间。"}),
    ("home.updates", "首页 · 最近动态", "json",
     {"items": [
         {"date": "2026-06-12", "title": "ToyBox v1.0 上线", "desc": "主站框架完成，开始慢慢装入新功能"},
         {"date": "2026-06-20", "title": "待办清单准备中", "desc": "把要做的事一件件记下来"},
         {"date": "2026-07-01", "title": "小本本开发中", "desc": "给灵感一个随手落脚的地方"},
     ]}),
    ("about.version", "关于 · 当前版本", "json",
     {"current": "v1.0.0", "release_date": "2026-06-12",
      "changelog": [
          {"version": "v1.0.0", "date": "2026-06-12", "note": "主站框架完成，首页 / 功能大厅 / 设置上线"},
          {"version": "v0.9.0", "date": "2026-06-01", "note": "内测版本，搭建配色主题与导航结构"},
      ]}),
    ("about.disclaimer", "关于 · 免责声明", "json",
     {"items": [
         "ToyBox 为个人非商业项目，全部功能仅供学习、娱乐与日常自用，不提供任何形式的商业服务保证。",
         "站内工具的计算与生成结果仅供参考，请勿作为专业、医疗、财务或法律决策的唯一依据。",
         "本站不会主动收集敏感个人信息，你在本地填写的内容默认只保存在你的设备上。",
         "因使用本站功能产生的任何直接或间接后果，需由使用者自行承担。",
     ]}),
    ("about.feedback", "关于 · 技术问题反馈", "json",
     {"email": "your-email@example.com", "github_url": "https://github.com/your-name/your-repo"}),
]


def _seed_contents(db: Session) -> None:
    for key, title, ctype, value in _SITE_CONTENTS:
        if db.query(SiteContent).filter(SiteContent.content_key == key).first() is None:
            db.add(SiteContent(content_key=key, title=title, content_type=ctype,
                               content_value=value, status="published"))
