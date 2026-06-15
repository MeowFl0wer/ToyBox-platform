"""主站数据库模型（main_db）。只保存平台级数据，不含模块业务数据。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from .core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    # 统一用 naive UTC，匹配 SQLite 的 DateTime 存储，避免 aware/naive 比较报错
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Sequence(Base):
    """单调递增计数器。用于分配 uid——即使用户被删除/注销/禁用也绝不复用。"""

    __tablename__ = "sequences"
    name: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)  # 内部 UUID
    uid: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)  # 展示用，从 1 递增
    username: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    nickname: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    bio: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # 是否已通过邮箱验证码验证
    # 管理员动态口令（TOTP）二次验证
    totp_secret: Mapped[str] = mapped_column(String(64), nullable=False, default="")   # base32 密钥
    totp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # 已完成绑定
    totp_pending_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)   # 未完成绑定的密钥生成时间（过期则轮换）
    totp_recovery: Mapped[str] = mapped_column(Text, nullable=False, default="")        # 一次性恢复码哈希列表(JSON)
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)      # 自增即让所有旧 access token 失效（强制全局登出）
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")     # user | admin
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active | disabled | deleted
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    @property
    def uid_display(self) -> str:
        return f"{self.uid:06d}"


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    purpose: Mapped[str] = mapped_column(String(30), nullable=False, default="register")
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_agent: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    remember: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # 记住我：持久化刷新 Cookie
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class InstalledModule(Base):
    __tablename__ = "installed_modules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    module_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="工具")
    icon: Mapped[str] = mapped_column(String(100), nullable=False, default="sparkles")
    auth_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # 内置模块（如欢迎模块），不可卸载
    # active：可用；coming_soon：即将上线
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)   # 管理员隐藏，普通用户不可见
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    # 安装/部署信息（由部署器写入）
    source_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_ref: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    version: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    entry_type: Mapped[str] = mapped_column(String(50), nullable=False, default="iframe")  # iframe | builtin
    internal_backend_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    manifest: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class ModuleUserPreference(Base):
    __tablename__ = "module_user_preferences"
    __table_args__ = (UniqueConstraint("user_id", "module_id", name="uq_user_module"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    module_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class InstallJob(Base):
    """模块安装/部署任务（架构文档 8.5）。"""

    __tablename__ = "module_install_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    module_id: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    job_type: Mapped[str] = mapped_column(String(50), nullable=False, default="install")
    # pending|cloning|validating|building_frontend|building_backend|migrating|starting|health_checking|success|failed
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    source_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_ref: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    logs: Mapped[str] = mapped_column(Text, nullable=False, default="")
    error_message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class SiteContent(Base):
    __tablename__ = "site_contents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    content_key: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    content_type: Mapped[str] = mapped_column(String(50), nullable=False, default="plain_text")
    content_value: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="published")  # draft | published
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class PageView(Base):
    """访问记录（架构文档 8.10）。用于 PV/UV 与访问排行统计。"""

    __tablename__ = "page_views"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    visitor: Mapped[str] = mapped_column(String(100), nullable=False, default="", index=True)  # UV 标识：用户 id 或 ip
    path: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    module_id: Mapped[str] = mapped_column(String(100), nullable=False, default="", index=True)
    referrer: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    user_agent: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    admin_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    target_id: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class ModuleStorage(Base):
    """平台托管存储：让纯前端模块（runtime.mode=platform_storage）无需自带后端/数据库，
    即可按 (用户, 模块, key) 隔离地保存少量 JSON 数据。主站统一鉴权与配额。"""

    __tablename__ = "module_storage"
    __table_args__ = (UniqueConstraint("user_id", "module_id", "key", name="uq_storage_user_module_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    module_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    value_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # value 序列化字节数（配额统计用）
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
