"""请求/响应 schema。所有用户输入在此做强类型 + 长度 + 格式校验（防注入/超长/畸形输入第一道闸）。"""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator

from .core.security import USERNAME_RE, clean_text, is_safe_url


# ---------- 认证 ----------
class SendCodeIn(BaseModel):
    email: EmailStr


class RegisterIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    username: str = Field(min_length=3, max_length=20)
    password: str = Field(min_length=8, max_length=72)
    nickname: str = Field(default="", max_length=30)

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError("用户名只能由 3-20 位字母、数字、下划线组成")
        return v

    @field_validator("nickname")
    @classmethod
    def _nickname(cls, v: str) -> str:
        return clean_text(v, 30)


class LoginIn(BaseModel):
    account: str = Field(min_length=3, max_length=255)  # 用户名或邮箱
    password: str = Field(min_length=1, max_length=72)
    remember: bool = False  # 在此设备记住我（持久化刷新 Cookie）


class ProfileIn(BaseModel):
    nickname: str | None = Field(default=None, max_length=30)
    bio: str | None = Field(default=None, max_length=200)
    avatar_url: str | None = Field(default=None, max_length=500)

    @field_validator("nickname")
    @classmethod
    def _nickname(cls, v: str | None) -> str | None:
        return None if v is None else clean_text(v, 30)

    @field_validator("bio")
    @classmethod
    def _bio(cls, v: str | None) -> str | None:
        return None if v is None else clean_text(v, 200)

    @field_validator("avatar_url")
    @classmethod
    def _avatar(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not is_safe_url(v):
            raise ValueError("头像链接非法")
        return v


class PasswordIn(BaseModel):
    old_password: str = Field(min_length=1, max_length=72)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")  # 改密码需邮箱验证码
    new_password: str = Field(min_length=8, max_length=72)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=72)


class EmailSendCodeIn(BaseModel):
    new_email: EmailStr


class ChangeEmailIn(BaseModel):
    new_email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    password: str = Field(min_length=1, max_length=72)


# ---------- 后台：模块 ----------
class ComingSoonIn(BaseModel):
    """发布一个「即将上线」的功能入口。"""
    module_id: str = Field(min_length=2, max_length=50, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=50)
    description: str = Field(default="", max_length=200)
    category: str = Field(default="工具", max_length=20)
    icon: str = Field(default="sparkles", max_length=40)

    @field_validator("name", "description", "category")
    @classmethod
    def _txt(cls, v: str) -> str:
        return clean_text(v, 200)


class PageViewIn(BaseModel):
    path: str = Field(min_length=1, max_length=300)
    module_id: str = Field(default="", max_length=100)
    referrer: str = Field(default="", max_length=300)


class InstallModuleIn(BaseModel):
    repo_url: str = Field(min_length=10, max_length=300)
    ref: str = Field(default="", max_length=100)

    @field_validator("repo_url")
    @classmethod
    def _repo(cls, v: str) -> str:
        from .core.config import settings

        v = v.strip()
        # 只允许 https 的 GitHub 仓库地址（架构文档 19.1：限制可信来源）
        if not v.startswith("https://github.com/"):
            raise ValueError("仅支持 https://github.com/ 开头的仓库地址")
        owner = v[len("https://github.com/"):].split("/")[0]
        if settings.module_source_allowlist and owner not in settings.module_source_allowlist:
            raise ValueError(f"仓库来源 {owner} 不在允许的白名单内")
        return v


class ModuleUpdateIn(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=200)
    category: str | None = Field(default=None, max_length=20)
    status: str | None = Field(default=None, pattern=r"^(active|coming_soon)$")


# ---------- 后台：内容 ----------
class SiteContentIn(BaseModel):
    title: str = Field(default="", max_length=200)
    content_type: str = Field(default="plain_text", pattern=r"^(plain_text|markdown|rich_text|notice|link_list)$")
    content_value: dict = Field(default_factory=dict)
    status: str = Field(default="published", pattern=r"^(draft|published)$")


# ---------- 后台：用户 ----------
class AdminUserCreateIn(BaseModel):
    username: str = Field(min_length=3, max_length=20)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    nickname: str = Field(default="", max_length=30)
    role: str = Field(default="user", pattern=r"^(user|admin)$")

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError("用户名只能由 3-20 位字母、数字、下划线组成")
        return v
