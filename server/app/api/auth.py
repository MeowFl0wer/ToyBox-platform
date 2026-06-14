"""认证：注册、登录、刷新、退出、当前用户、改资料；
以及需邮箱验证码的：找回密码、修改邮箱、修改密码。"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core import mailer, ratelimit
from ..core.config import settings
from ..core.database import get_db
from ..core.deps import get_client_ip, get_current_user
from ..core.response import (
    APIError,
    CODE_BAD_PARAM,
    CODE_CONFLICT,
    CODE_RATE_LIMITED,
    CODE_UNAUTHORIZED,
    ok,
)
from ..core.security import (
    create_access_token,
    hash_code,
    hash_password,
    hash_token,
    new_refresh_token,
    new_verify_code,
    verify_password,
)
from ..models import EmailVerification, Sequence, User, UserSession
from ..schemas import (
    ChangeEmailIn,
    EmailSendCodeIn,
    ForgotPasswordIn,
    LoginIn,
    PasswordIn,
    ProfileIn,
    RegisterIn,
    ResetPasswordIn,
    SendCodeIn,
)
from ..serializers import user_public

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("toybox.auth")

REFRESH_COOKIE = "toybox_refresh"
# 作用于整个 /api：刷新接口与模块网关 /api/modules/* 的 iframe 请求都能带上
COOKIE_PATH = "/api"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------- 验证码：创建 / 校验 ----------
def _create_code(db: Session, email: str, purpose: str) -> str:
    """作废该 (email,purpose) 旧验证码，生成新码并发信，返回明文（仅用于开发态返回）。"""
    db.query(EmailVerification).filter(
        EmailVerification.email == email,
        EmailVerification.purpose == purpose,
        EmailVerification.consumed == False,  # noqa: E712
    ).update({"consumed": True})
    code = new_verify_code()
    db.add(
        EmailVerification(
            email=email,
            purpose=purpose,
            code_hash=hash_code(code),
            expires_at=_now() + timedelta(minutes=settings.verify_code_ttl_min),
        )
    )
    db.commit()
    mailer.send_code_email(email, code, purpose)
    log.info("[验证码] %s (%s) 已生成", email, purpose)
    return code


def _consume_code(db: Session, email: str, purpose: str, code: str) -> None:
    rec = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.email == email,
            EmailVerification.purpose == purpose,
            EmailVerification.consumed == False,  # noqa: E712
        )
        .order_by(EmailVerification.created_at.desc())
        .first()
    )
    if not rec or rec.expires_at < _now():
        raise APIError(CODE_BAD_PARAM, "验证码不存在或已过期，请重新获取")
    if rec.attempts >= 5:
        rec.consumed = True
        db.commit()
        raise APIError(CODE_BAD_PARAM, "验证码尝试次数过多，请重新获取")
    if rec.code_hash != hash_code(code):
        rec.attempts += 1
        db.commit()
        raise APIError(CODE_BAD_PARAM, "验证码错误")
    rec.consumed = True
    db.commit()


def _dev(data: dict, code: str) -> dict:
    if settings.dev_mode:
        data = {**data, "dev_code": code}
    return data


# ---------- 会话 / token ----------
def _allocate_uid(db: Session) -> int:
    seq = db.get(Sequence, "user_uid")
    if seq is None:
        seq = Sequence(name="user_uid", value=0)
        db.add(seq)
        db.flush()
    seq.value += 1
    db.flush()
    return seq.value


def _issue_session(db: Session, user: User, request: Request, remember: bool) -> str:
    raw = new_refresh_token()
    db.add(
        UserSession(
            user_id=user.id,
            refresh_token_hash=hash_token(raw),
            user_agent=request.headers.get("User-Agent", "")[:300],
            ip_address=get_client_ip(request),
            remember=remember,
            expires_at=_now() + timedelta(days=settings.refresh_token_ttl_days),
        )
    )
    return raw


def _set_refresh_cookie(response: Response, raw: str, remember: bool) -> None:
    kwargs = dict(
        httponly=True,
        samesite="lax",
        secure=not settings.dev_mode,  # 生产（HTTPS）强制 Secure；开发 http 下为 False
        path=COOKIE_PATH,
    )
    # 记住我：持久化（关浏览器仍在，下次自动登录）；否则会话级 Cookie（关浏览器即失效）
    if remember:
        kwargs["max_age"] = settings.refresh_token_ttl_days * 86400
    response.set_cookie(REFRESH_COOKIE, raw, **kwargs)


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)


def _auth_payload(db: Session, user: User, request: Request, response: Response, remember: bool) -> dict:
    access = create_access_token(user.id, user.role)
    raw = _issue_session(db, user, request, remember)
    _set_refresh_cookie(response, raw, remember)
    return {"access_token": access, "user": user_public(user)}


def _revoke_all_sessions(db: Session, user_id: str) -> None:
    db.query(UserSession).filter(
        UserSession.user_id == user_id, UserSession.revoked_at.is_(None)
    ).update({"revoked_at": _now()})


# ============ 注册 ============
@router.post("/register/send-code")
def register_send_code(body: SendCodeIn, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    email = body.email.lower()
    if not ratelimit.allow(f"sendcode:ip:{ip}", 8, 3600):
        raise APIError(CODE_RATE_LIMITED, "操作过于频繁，请稍后再试")
    if not ratelimit.allow(f"sendcode:email:{email}", 1, 60):
        raise APIError(CODE_RATE_LIMITED, "验证码发送过于频繁，请 1 分钟后再试")
    if db.query(User).filter(User.email == email).first():
        raise APIError(CODE_CONFLICT, "该邮箱已注册")
    code = _create_code(db, email, "register")
    return ok(_dev({"sent": True, "expires_in_min": settings.verify_code_ttl_min}, code), message="验证码已发送")


@router.post("/register")
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    email = body.email.lower()
    if not ratelimit.allow(f"register:ip:{ip}", 10, 3600):
        raise APIError(CODE_RATE_LIMITED, "操作过于频繁，请稍后再试")
    _consume_code(db, email, "register", body.code)
    if db.query(User).filter(User.username == body.username).first():
        raise APIError(CODE_CONFLICT, "用户名已被占用")
    if db.query(User).filter(User.email == email).first():
        raise APIError(CODE_CONFLICT, "该邮箱已注册")
    user = User(
        uid=_allocate_uid(db),
        username=body.username,
        nickname=body.nickname or body.username,
        email=email,
        password_hash=hash_password(body.password),
        role="user",
        status="active",
    )
    db.add(user)
    db.flush()
    data = _auth_payload(db, user, request, response, remember=True)
    db.commit()
    return ok(data, message="注册成功")


# ============ 登录 / 刷新 / 退出 ============
@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    if not ratelimit.allow(f"login:ip:{ip}", 15, 300):
        raise APIError(CODE_RATE_LIMITED, "登录尝试过于频繁，请稍后再试")
    account = body.account.strip()
    user = db.query(User).filter(or_(User.username == account, User.email == account.lower())).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise APIError(CODE_UNAUTHORIZED, "账号或密码错误")
    if user.status != "active":
        raise APIError(CODE_UNAUTHORIZED, "账号已被禁用或注销")
    data = _auth_payload(db, user, request, response, body.remember)
    db.commit()
    return ok(data, message="登录成功")


@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise APIError(CODE_UNAUTHORIZED, "未登录")
    sess = db.query(UserSession).filter(UserSession.refresh_token_hash == hash_token(raw)).first()
    if not sess or sess.revoked_at is not None or sess.expires_at < _now():
        raise APIError(CODE_UNAUTHORIZED, "登录已过期，请重新登录")
    user = db.get(User, sess.user_id)
    if not user or user.status != "active":
        raise APIError(CODE_UNAUTHORIZED, "账号不可用")
    remember = sess.remember  # 续期时保持原来的记住我设置
    sess.revoked_at = _now()
    data = _auth_payload(db, user, request, response, remember)
    db.commit()
    return ok(data, message="ok")


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        sess = db.query(UserSession).filter(UserSession.refresh_token_hash == hash_token(raw)).first()
        if sess and sess.revoked_at is None:
            sess.revoked_at = _now()
            db.commit()
    _clear_refresh_cookie(response)
    return ok(message="已退出登录")


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok(user_public(user))


@router.put("/profile")
def update_profile(body: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.nickname is not None:
        user.nickname = body.nickname or user.username
    if body.bio is not None:
        user.bio = body.bio
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url
    db.commit()
    return ok(user_public(user), message="资料已更新")


# ============ 找回密码（未登录，邮箱验证码）============
@router.post("/password/forgot")
def forgot_password(body: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    email = body.email.lower()
    if not ratelimit.allow(f"forgot:ip:{ip}", 8, 3600) or not ratelimit.allow(f"forgot:email:{email}", 1, 60):
        raise APIError(CODE_RATE_LIMITED, "操作过于频繁，请稍后再试")
    user = db.query(User).filter(User.email == email).first()
    data: dict = {"sent": True, "expires_in_min": settings.verify_code_ttl_min}
    # 防枚举：无论邮箱是否存在都返回成功；仅存在且可用时才真正发码
    if user and user.status == "active":
        code = _create_code(db, email, "reset_password")
        data = _dev(data, code)
    return ok(data, message="如果该邮箱已注册，验证码已发送")


@router.post("/password/reset")
def reset_password(body: ResetPasswordIn, request: Request, db: Session = Depends(get_db)):
    ip = get_client_ip(request)
    email = body.email.lower()
    if not ratelimit.allow(f"reset:ip:{ip}", 10, 3600):
        raise APIError(CODE_RATE_LIMITED, "操作过于频繁，请稍后再试")
    _consume_code(db, email, "reset_password", body.code)
    user = db.query(User).filter(User.email == email).first()
    if not user or user.status != "active":
        raise APIError(CODE_BAD_PARAM, "账号不可用")
    user.password_hash = hash_password(body.new_password)
    _revoke_all_sessions(db, user.id)
    db.commit()
    return ok(message="密码已重置，请用新密码登录")


# ============ 修改邮箱（已登录，验证码发往新邮箱）============
@router.post("/email/send-code")
def email_send_code(body: EmailSendCodeIn, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_email = body.new_email.lower()
    if not ratelimit.allow(f"changeemail:user:{user.id}", 5, 3600):
        raise APIError(CODE_RATE_LIMITED, "操作过于频繁，请稍后再试")
    if new_email == user.email:
        raise APIError(CODE_BAD_PARAM, "新邮箱与当前邮箱相同")
    if db.query(User).filter(User.email == new_email).first():
        raise APIError(CODE_CONFLICT, "该邮箱已被占用")
    code = _create_code(db, new_email, "change_email")
    return ok(_dev({"sent": True, "expires_in_min": settings.verify_code_ttl_min}, code), message="验证码已发送至新邮箱")


@router.put("/email")
def change_email(body: ChangeEmailIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_email = body.new_email.lower()
    if not verify_password(body.password, user.password_hash):
        raise APIError(CODE_BAD_PARAM, "登录密码不正确")
    _consume_code(db, new_email, "change_email", body.code)
    if db.query(User).filter(User.email == new_email, User.id != user.id).first():
        raise APIError(CODE_CONFLICT, "该邮箱已被占用")
    user.email = new_email
    db.commit()
    return ok(user_public(user), message="邮箱已更新")


# ============ 修改密码（已登录，旧密码 + 邮箱验证码）============
@router.post("/password/send-code")
def password_send_code(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not ratelimit.allow(f"changepwd:user:{user.id}", 5, 3600):
        raise APIError(CODE_RATE_LIMITED, "操作过于频繁，请稍后再试")
    code = _create_code(db, user.email, "change_password")
    return ok(_dev({"sent": True, "expires_in_min": settings.verify_code_ttl_min}, code), message="验证码已发送至你的邮箱")


@router.put("/password")
def change_password(body: PasswordIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.old_password, user.password_hash):
        raise APIError(CODE_BAD_PARAM, "原密码不正确")
    _consume_code(db, user.email, "change_password", body.code)
    user.password_hash = hash_password(body.new_password)
    _revoke_all_sessions(db, user.id)
    db.commit()
    return ok(message="密码已修改，请重新登录")
