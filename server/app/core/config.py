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

    # 模块部署方式：local（本地进程，开发态，无需 Docker）| docker（生产，构建镜像+容器+独立 Postgres 库）
    deploy_mode: str = "local"
    docker_network: str = "toybox_net"          # 模块容器加入的内部网络
    module_image_prefix: str = "toybox-module-"
    module_container_prefix: str = "toybox-module-"
    # 部署任务执行位置：true=主站进程内线程（本地/开发）；false=独立 Deploy Worker（生产，主站不碰 docker）
    worker_inproc: bool = True
    # docker 模式建模块独立库用的 Postgres 超管连接（worker 直连 psycopg，不再 docker exec）
    postgres_host: str = "toybox-postgres"
    postgres_port: int = 5432
    postgres_superuser: str = "postgres"
    postgres_password: str = ""

    # 允许的前端来源（携带 Cookie，必须显式列出，不能用 *）
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ]

    # 反代后取真实客户端 IP（生产经 Nginx 时设 true 以读 X-Forwarded-For，供限流按客户端聚合）
    trust_proxy: bool = False
    # 模块来源白名单（GitHub owner 列表，空=不限制）。建议生产只允许自己的账号/组织。
    module_source_allowlist: list[str] = []

    # 平台托管存储（runtime.mode=platform_storage 模块用）配额
    module_storage_max_keys: int = 100              # 每用户每模块最多 key 数
    module_storage_max_value_bytes: int = 128 * 1024   # 单个 value 序列化上限 128KB
    module_storage_max_total_bytes: int = 2 * 1024 * 1024  # 每用户每模块总量上限 2MB

    # 容器模块（runtime.mode=container/lazy_container）默认/上限资源（docker 模式生效）
    module_default_memory: str = "256m"
    module_max_memory: str = "1024m"
    module_default_cpus: float = 0.5
    module_max_cpus: float = 2.0
    module_default_pids: int = 128
    module_max_pids: int = 512

    # 初始管理员（首次启动自动创建，请尽快在设置里改密码）
    admin_username: str = "admin"
    admin_email: str = "admin@toybox.local"
    admin_password: str = "Admin@12345"
    admin_nickname: str = "管理员"


settings = Settings()
