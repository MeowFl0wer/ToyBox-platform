"""运维命令行工具（服务器侧应急用）。

用法（在 server/ 目录下，激活 venv 后）：
  python -m app.manage reset-totp <用户名>     # 重置某账号的动态验证器（丢失 Authenticator 应急）
  python -m app.manage list-admins             # 列出所有管理员及其 2FA 绑定状态

reset-totp 后，该账号下次登录会重新引导绑定 Authenticator。
这是「把自己锁死」时的兜底恢复入口：拥有服务器权限即可解锁，无需第二个管理员。
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

from .core.database import SessionLocal
from .models import User, UserSession


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _reset_totp(username: str) -> int:
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.username == username).first()
        if not u:
            print(f"用户不存在：{username}")
            return 1
        u.totp_secret = ""
        u.totp_enabled = False
        u.totp_pending_at = None
        u.totp_recovery = ""
        # 强制全局登出：撤销刷新会话 + 自增 token_version 让旧 access token 失效
        db.query(UserSession).filter(
            UserSession.user_id == u.id, UserSession.revoked_at.is_(None)
        ).update({"revoked_at": _now()})
        u.token_version = (u.token_version or 0) + 1
        db.commit()
        print(f"已重置 {username} 的动态验证器并强制下线，下次登录将重新引导绑定。")
        return 0
    finally:
        db.close()


def _list_admins() -> int:
    db = SessionLocal()
    try:
        admins = db.query(User).filter(User.role == "admin").all()
        if not admins:
            print("（没有管理员账号）")
        for a in admins:
            print(f"- {a.username} (uid {a.uid_display})  2FA: {'已绑定' if a.totp_enabled else '未绑定'}  status: {a.status}")
        return 0
    finally:
        db.close()


def main(argv: list[str]) -> int:
    cmd = argv[0] if argv else ""
    if cmd not in ("reset-totp", "list-admins"):
        print(__doc__)
        return 2
    # 先确保数据库结构是最新的（建表 + 轻量迁移）：兼容「真实库尚未随后端重启迁移」时直接用 CLI 自救
    from .seed import run_seed
    run_seed()
    if cmd == "reset-totp" and len(argv) >= 2:
        return _reset_totp(argv[1])
    if cmd == "list-admins":
        return _list_admins()
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
