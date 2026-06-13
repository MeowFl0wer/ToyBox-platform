"""邮件发送：生产用 Resend（HTTP API），开发态不发信、只打印验证码。

部署时设置环境变量：
  TOYBOX_DEV_MODE=false
  TOYBOX_RESEND_API_KEY=re_xxx
  TOYBOX_MAIL_FROM="ToyBox <noreply@your-domain.com>"   # 需在 Resend 验证过的发件域名
"""
from __future__ import annotations

import json
import logging
import urllib.request

from .config import settings

log = logging.getLogger("toybox.mailer")

_SUBJECTS = {
    "register": "注册验证码",
    "reset_password": "重置密码验证码",
    "change_email": "更换邮箱验证码",
    "change_password": "修改密码验证码",
}


def send_code_email(to: str, code: str, purpose: str) -> None:
    """发送验证码邮件。开发态或未配置 Resend 时仅记录日志（不抛错）。"""
    subject = f"【ToyBox】{_SUBJECTS.get(purpose, '验证码')}"

    if settings.dev_mode or not settings.resend_api_key:
        log.info("[邮件·开发模式] to=%s purpose=%s code=%s（未真正发信）", to, purpose, code)
        return

    html = (
        f"<div style='font-family:sans-serif'>"
        f"<p>你的{_SUBJECTS.get(purpose, '验证码')}是：</p>"
        f"<p style='font-size:26px;font-weight:800;letter-spacing:4px'>{code}</p>"
        f"<p style='color:#888'>{settings.verify_code_ttl_min} 分钟内有效。若非本人操作，请忽略此邮件。</p>"
        f"</div>"
    )
    payload = json.dumps({"from": settings.mail_from, "to": [to], "subject": subject, "html": html}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
        log.info("[邮件·Resend] 已发送 to=%s purpose=%s", to, purpose)
    except Exception as e:  # noqa: BLE001
        # 发信失败不阻断主流程，但记录错误；前端会提示稍后重试
        log.error("[邮件·Resend] 发送失败 to=%s: %s", to, e)
        raise
