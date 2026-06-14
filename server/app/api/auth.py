"""认证：注册、登录、刷新、退出、当前用户、改资料；
以及需邮箱验证码的：找回密码、修改邮箱、修改密码。"""
from __future__ import annotations

import hashlib
import io
import json
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core import mailer, ratelimit, totp
from ..core.config import DATA_DIR, settings
from ..core.database import get_db
from ..core.deps import get_client_ip, get_current_user
from ..core.response import (
    APIError,
    CODE_BAD_PARAM,
    CODE_CONFLICT,
    CODE_NEED_VERIFY,
    CODE_RATE_LIMITED,
    CODE_TOTP_ENROLL,
    CODE_TOTP_REQUIRED,
    CODE_UNAUTHORIZED,
    fail,
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
    LoginSendCodeIn,
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
    access = create_access_token(user.id, user.role, user.token_version)
    raw = _issue_session(db, user, request, remember)
    _set_refresh_cookie(response, raw, remember)
    return {"access_token": access, "user": user_public(user)}


def _revoke_all_sessions(db: Session, user_id: str) -> None:
    db.query(UserSession).filter(
        UserSession.user_id == user_id, UserSession.revoked_at.is_(None)
    ).update({"revoked_at": _now()})


def force_logout_everywhere(db: Session, user: User) -> None:
    """强制该用户全局登出：撤销全部刷新会话 + 自增 token_version 让所有已签发的 access token 立即失效。
    用于改密码 / 重置密码 / 重置 2FA 等需要立刻断开旧凭证的场景。"""
    _revoke_all_sessions(db, user.id)
    user.token_version = (user.token_version or 0) + 1


TOTP_FAIL_WINDOW_S = 900       # 动态码失败计数窗口（15 分钟）
TOTP_MAX_FAILS = 8             # 窗口内最多失败次数，超过则冷却（账号维度，防密码泄露后撞码）
TOTP_PENDING_TTL_MIN = 10      # 未完成绑定的临时密钥有效期，过期自动轮换
RECOVERY_CODE_COUNT = 10       # 绑定时生成的一次性恢复码数量


def _recovery_hash(code: str) -> str:
    norm = code.strip().lower().replace("-", "").replace(" ", "")
    return hashlib.sha256(f"{settings.secret_key}:recovery:{norm}".encode("utf-8")).hexdigest()


def _generate_recovery_codes(user: User) -> list[str]:
    """生成一组一次性恢复码：明文仅本次返回给用户保存，库里只存哈希。
    每条 80 bit 熵（恢复码是长期备用凭证，需足够抗离线/在线猜测）。"""
    codes = []
    for _ in range(RECOVERY_CODE_COUNT):
        raw = secrets.token_hex(10)  # 20 位十六进制 = 80 bit
        codes.append("-".join(raw[i:i + 5] for i in range(0, 20, 5)))  # xxxxx-xxxxx-xxxxx-xxxxx
    user.totp_recovery = json.dumps([_recovery_hash(c) for c in codes])
    return codes


def _consume_recovery_code(db: Session, user: User, code: str) -> bool:
    """校验并消费一个恢复码（一次性）。命中则从库中移除并返回 True。"""
    try:
        hashes = json.loads(user.totp_recovery or "[]")
    except (ValueError, TypeError):
        hashes = []
    h = _recovery_hash(code)
    if h in hashes:
        user.totp_recovery = json.dumps([x for x in hashes if x != h])
        db.commit()
        return True
    return False


def _ensure_pending_secret(db: Session, user: User) -> None:
    """为未绑定的管理员准备/轮换临时 TOTP 密钥：空或超过有效期就重新生成，
    收敛「仅靠密码保护」的暴露窗口（首次绑定阶段）。"""
    stale = user.totp_pending_at is None or (_now() - user.totp_pending_at > timedelta(minutes=TOTP_PENDING_TTL_MIN))
    if user.totp_secret == "" or stale:
        user.totp_secret = totp.generate_secret()
        user.totp_pending_at = _now()
        db.commit()


def _admin_totp_gate(db: Session, user: User, totp_code: str | None, recovery_code: str | None = None) -> list[str] | None:
    """管理员动态口令二次验证（在密码校验通过后调用）。
    - 账号维度失败限流（totpfail:{id}）：即便密码泄露，也限制分布式撞动态码；
    - 未绑定：引导绑定 Authenticator（临时密钥带有效期/轮换），输入一次正确动态码即完成绑定，
      并返回一组一次性恢复码（仅此一次明文返回，供用户保存）；
    - 已绑定：每次登录需正确的 6 位动态码，或使用一次性恢复码（丢失验证器时）。
    返回值：仅在「本次刚完成绑定」时返回恢复码明文列表，否则 None。"""
    fail_key = f"totpfail:{user.id}"
    if ratelimit.count(fail_key, TOTP_FAIL_WINDOW_S) >= TOTP_MAX_FAILS:
        raise APIError(CODE_RATE_LIMITED, "动态验证码尝试次数过多，请 15 分钟后再试")

    # 已绑定且使用恢复码登录
    if user.totp_enabled and recovery_code:
        if _consume_recovery_code(db, user, recovery_code):
            return None
        ratelimit.record(fail_key)
        raise APIError(CODE_TOTP_REQUIRED, "恢复码无效或已被使用")

    if not user.totp_enabled:
        _ensure_pending_secret(db, user)
        enroll = {
            "totp_enroll": True,
            "secret": user.totp_secret,
            "otpauth_uri": totp.provisioning_uri(user.totp_secret, user.username),
            "account": user.username,
            "issuer": "ToyBox",
        }
        if not totp_code:
            raise APIError(CODE_TOTP_ENROLL, "管理员账号需绑定动态验证器（Authenticator）", data=enroll)
        if not totp.verify(user.totp_secret, totp_code):
            ratelimit.record(fail_key)
            raise APIError(CODE_TOTP_ENROLL, "动态验证码不正确，请用 App 上最新的 6 位码再试一次", data=enroll)
        user.totp_enabled = True
        user.totp_pending_at = None
        codes = _generate_recovery_codes(user)  # 绑定成功 → 生成一次性恢复码
        db.commit()
        return codes

    # 已绑定：校验动态码
    if not totp_code:
        raise APIError(CODE_TOTP_REQUIRED, "请输入 Authenticator 动态验证码")
    if not totp.verify(user.totp_secret, totp_code):
        ratelimit.record(fail_key)
        raise APIError(CODE_TOTP_REQUIRED, "动态验证码不正确")
    return None


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
        email_verified=True,  # 注册必须通过邮箱验证码，落库即为已验证
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
    # 账号维度失败限流：抵御分布式撞库（多 IP 刷同一账号）。失败满阈值后改为「要求邮箱验证码」，
    # 而不是硬阻断——这样攻击者刷错也不会把真实用户锁在门外（真实用户能收码、攻击者收不到）。
    acct_key = f"loginfail:{account.lower()}"
    stepup = ratelimit.count(acct_key, 900) >= 10
    user = db.query(User).filter(or_(User.username == account, User.email == account.lower())).first()

    if stepup:
        if not body.code:
            raise APIError(CODE_NEED_VERIFY, "为确认是本人操作，请获取并输入邮箱验证码")
        # 校验邮箱验证码（针对该账号邮箱）；无此账号则按通用失败处理，避免枚举
        if not user:
            ratelimit.record(acct_key)
            raise APIError(CODE_UNAUTHORIZED, "账号或密码错误")
        _consume_code(db, user.email, "login", body.code)  # 验证码错/过期会抛 400

    if not user or not verify_password(body.password, user.password_hash):
        ratelimit.record(acct_key)  # 仅失败计数
        raise APIError(CODE_UNAUTHORIZED, "账号或密码错误")
    if user.status != "active":
        raise APIError(CODE_UNAUTHORIZED, "账号已被禁用或注销")

    # 管理员动态口令二次验证（首登引导绑定 Authenticator，之后每次需输入动态码 / 恢复码）
    # 注意：放在清除失败计数之前——TOTP 自身做账号维度失败限流，完整通过后再统一清计数。
    recovery_codes = None
    if user.role == "admin":
        recovery_codes = _admin_totp_gate(db, user, body.totp, body.recovery_code)

    ratelimit.clear(acct_key)              # 完整登录成功，清除密码失败计数（解除步进验证）
    ratelimit.clear(f"totpfail:{user.id}")  # 清除动态码失败计数
    data = _auth_payload(db, user, request, response, body.remember)
    if recovery_codes:
        data = {**data, "recovery_codes": recovery_codes}  # 刚绑定 → 一次性返回恢复码供保存
    db.commit()
    return ok(data, message="登录成功")


@router.post("/login/send-code")
def login_send_code(body: LoginSendCodeIn, request: Request, db: Session = Depends(get_db)):
    """登录失败过多触发步进验证时，把验证码发到该账号邮箱。防枚举：不暴露账号是否存在。"""
    ip = get_client_ip(request)
    account = body.account.strip()
    if not ratelimit.allow(f"loginsendcode:ip:{ip}", 10, 3600) or not ratelimit.allow(f"loginsendcode:{account.lower()}", 1, 60):
        raise APIError(CODE_RATE_LIMITED, "操作过于频繁，请稍后再试")
    user = db.query(User).filter(or_(User.username == account, User.email == account.lower())).first()
    data: dict = {"sent": True, "expires_in_min": settings.verify_code_ttl_min}
    if user and user.status == "active":
        code = _create_code(db, user.email, "login")
        data = _dev(data, code)
    return ok(data, message="如该账号存在，验证码已发送到其邮箱")


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
    # 管理员必须完成 2FA 绑定才能持有会话：拒绝「未绑定 TOTP 的管理员」静默续期
    #（堵住升级前遗留的管理员 cookie 绕过首次绑定的情况），撤销该会话并清 Cookie，强制走登录→绑定流程。
    # 注意：这里直接返回带「删除 Cookie」头的响应——若改用 raise，全局异常处理器会另起响应、丢掉清 Cookie。
    if user.role == "admin" and not user.totp_enabled:
        sess.revoked_at = _now()
        db.commit()
        rej = JSONResponse(status_code=401, content=fail(CODE_UNAUTHORIZED, "管理员需重新登录并绑定动态验证器"))
        rej.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
        return rej
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


# ---------- 头像上传 ----------
AVATAR_DIR = DATA_DIR / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
_MAX_AVATAR_BYTES = 2 * 1024 * 1024     # 上传体积上限 2MB
_AVATAR_OUT_SIZE = 512                   # 重编码后边长上限（等比缩放）
_MAX_SRC_PIXELS = 24_000_000            # 源图像素上限，挡解压炸弹（~24MP）

# 仅接受图片：用魔术字节（而非仅靠扩展名/Content-Type）判定，防伪造类型
def _sniff_image(data: bytes) -> str | None:
    if data[:8].startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 用户维度频率限制：每小时最多 10 次（与 IP 限流互补，防刷爆磁盘/CPU）
    if not ratelimit.allow(f"avatar:user:{user.id}", 10, 3600):
        raise APIError(CODE_RATE_LIMITED, "头像上传过于频繁，请稍后再试")
    raw = await file.read(_MAX_AVATAR_BYTES + 1)
    if len(raw) > _MAX_AVATAR_BYTES:
        raise APIError(CODE_BAD_PARAM, "图片过大，请控制在 2MB 以内")
    if not _sniff_image(raw):
        raise APIError(CODE_BAD_PARAM, "仅支持 PNG / JPG / GIF / WEBP 图片")
    # 解码 → 取首帧 → 等比缩放 → 重编码为规整 PNG：
    # 去掉动画、EXIF 等元数据与潜在畸形结构，并用像素上限挡解压炸弹（纵深防御，不只信任魔术字节）。
    Image.MAX_IMAGE_PIXELS = _MAX_SRC_PIXELS
    try:
        with Image.open(io.BytesIO(raw)) as im:
            im.seek(0)  # 动图只取第一帧
            rgba = im.convert("RGBA")  # 触发实际解码；畸形/截断会在此抛错
            rgba.thumbnail((_AVATAR_OUT_SIZE, _AVATAR_OUT_SIZE))
            out = io.BytesIO()
            rgba.save(out, format="PNG", optimize=True)
    except Exception:  # noqa: BLE001 解压炸弹 / 截断 / 畸形图片
        raise APIError(CODE_BAD_PARAM, "图片无法解析，请更换一张")
    # 清掉该用户旧头像（任意扩展名），统一写为 png；文件名用内部 UUID，外部不可枚举他人
    for old in AVATAR_DIR.glob(f"{user.id}.*"):
        old.unlink(missing_ok=True)
    (AVATAR_DIR / f"{user.id}.png").write_bytes(out.getvalue())
    user.avatar_url = f"/api/core/avatar/{user.id}?v={int(time.time())}"  # 带版本号破缓存
    db.commit()
    return ok(user_public(user), message="头像已更新")


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
    force_logout_everywhere(db, user)  # 撤销旧会话 + 让旧 access token 失效
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
    user.email_verified = True  # 新邮箱已通过验证码确认
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
    force_logout_everywhere(db, user)  # 撤销旧会话 + 让旧 access token 失效
    db.commit()
    return ok(message="密码已修改，请重新登录")
