"""全局配置。开发态默认值开箱即用，生产用环境变量（前缀 TOYBOX_）覆盖。"""
from __future__ import annotations

import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# server/ 根目录（本文件位于 server/app/core/config.py）
SERVER_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = SERVER_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _persisted_secret(name: str) -> str:
    """生成并持久化一个随机密钥到 data/ 下（gitignore），避免重启后 token 失效，
    同时不把密钥硬编码进代码或提交到仓库。"""
    f = DATA_DIR / name
    if f.exists():
        return f.read_text().strip()
    value = secrets.token_urlsafe(48)
    f.write_text(value)
    f.chmod(0o600)
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TOYBOX_", env_file=".env", extra="ignore")

    app_name: str = "ToyBox 主站后端"
    # 开发态：邮箱验证码直接在接口返回 / 控制台打印，不接真实 SMTP
    dev_mode: bool = True

    # 密钥：环境变量优先，否则用持久化的随机值
    secret_key: str = _persisted_secret("jwt_secret.key")          # 签发 JWT
    module_sign_key: str = _persisted_secret("module_sign.key")    # 模块用户上下文 HMAC 签名

    access_token_ttl_min: int = 30
    refresh_token_ttl_days: int = 14
    verify_code_ttl_min: int = 10

    # 邮件（Resend）。dev_mode=true 或未配置 key 时不真正发信，验证码走开发模式返回。
    resend_api_key: str = ""
    mail_from: str = "ToyBox <onboarding@resend.dev>"

    db_url: str = f"sqlite:///{(DATA_DIR / 'main.db').as_posix()}"

    # 允许的前端来源（携带 Cookie，必须显式列出，不能用 *）
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ]

    # 初始管理员（首次启动自动创建，请尽快在设置里改密码）
    admin_username: str = "admin"
    admin_email: str = "admin@toybox.local"
    admin_password: str = "Admin@12345"
    admin_nickname: str = "管理员"


settings = Settings()
