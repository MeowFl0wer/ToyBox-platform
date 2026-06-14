import { useRef, useState } from "react";
import { Mail, Lock, User, FileText, Moon, Sun, LogOut, ChevronRight, Shield, Camera } from "lucide-react";
import type { ThemePalette } from "../theme";
import { Reveal, fireConfetti } from "./anim";
import { DoodleLayer } from "./DoodleLayer";
import { ABOUT_DOODLES, AboutBlobs } from "./AboutPage";
import { api, ApiError, type ApiUser } from "../api/client";
import { useAuth } from "../api/auth";

interface SettingsPageProps {
  isLoggedIn: boolean;
  onOpenAuth: () => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleDark: () => void;
  user?: ApiUser | null;
  palette: ThemePalette;
}

type SettingsView = "main" | "change-password" | "change-email";

/**
 * 个人设置页外壳：和关于页一致的居中布局 + 同一套持续浮动的 q 版插画装饰。
 * 背景/插画随主题与深浅模式（palette 已在 App 解析）变化。
 */
function SettingsShell({
  palette,
  center,
  maxW = "max-w-2xl",
  children,
}: {
  palette: ThemePalette;
  center?: boolean;
  maxW?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-flow" style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}>
      <div className="bg-flow relative min-h-full" style={{ background: palette.heroBackdrop }}>
        <DoodleLayer palette={palette} doodles={ABOUT_DOODLES} className="hidden sm:block" extra={<AboutBlobs palette={palette} />} animateIn />
        {center ? (
          <div className="relative z-10 min-h-full flex flex-col items-center justify-center gap-6" style={{ padding: "40px 20px" }}>
            {children}
          </div>
        ) : (
          <div className={`relative z-10 mx-auto px-6 md:px-10 py-8 ${maxW}`}>{children}</div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage({ isLoggedIn, onOpenAuth, onLogout, isDark, onToggleDark, user, palette }: SettingsPageProps) {
  const { refreshMe } = useAuth();
  const [view, setView] = useState<SettingsView>("main");
  const [nickname, setNickname] = useState(user?.nickname || user?.username || "ToyBox 用户");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState("");

  const handlePickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选同一文件
    if (!file) return;
    setAvatarErr("");
    setAvatarBusy(true);
    try {
      await api.uploadAvatar(file);
      await refreshMe();
      fireConfetti(palette);
    } catch (err) {
      setAvatarErr(err instanceof ApiError ? err.message : "上传失败");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSave = async () => {
    setSaveErr("");
    try {
      await api.updateProfile({ nickname, bio });
      await refreshMe();
      setSaved(true);
      fireConfetti(palette);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveErr(e instanceof ApiError ? e.message : "保存失败");
    }
  };

  if (!isLoggedIn) {
    return (
      <SettingsShell palette={palette} center>
        <div style={{ fontSize: "64px" }}>🔒</div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 900, color: palette.ink, marginBottom: "8px" }}>
            请先登录
          </h2>
          <p style={{ fontSize: "14px", color: palette.muted, maxWidth: "280px", lineHeight: 1.7 }}>
            登录后即可管理你的账号信息、偏好设置，以及查看使用记录
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="px-8 py-3 rounded-2xl transition-all hover:scale-105 active:scale-95"
          style={{
            background: palette.activeGradient,
            color: "#fff",
            fontSize: "16px",
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
            boxShadow: `0 6px 20px ${palette.glow}`,
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          登录 / 注册
        </button>
      </SettingsShell>
    );
  }

  if (view === "change-password") {
    return <SubPage title="修改密码" onBack={() => setView("main")} palette={palette}>
      <PasswordChangeForm palette={palette} onDone={() => setView("main")} />
    </SubPage>;
  }

  if (view === "change-email") {
    return <SubPage title="修改邮箱" onBack={() => setView("main")} palette={palette}>
      <EmailChangeForm palette={palette} currentEmail={user?.email ?? ""} onDone={() => setView("main")} />
    </SubPage>;
  }

  return (
    <SettingsShell palette={palette}>
      <Reveal immediate className="mb-7 flex flex-col items-center text-center">
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: palette.ink, marginBottom: "6px" }}>
          个人设置
        </h1>
        <p style={{ fontSize: "13px", color: palette.muted }}>
          管理你的账号信息和偏好
        </p>
      </Reveal>

      {/* Avatar + profile */}
      <Section title="基本信息" palette={palette}>
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-5">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handlePickAvatar} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            title="点击更换头像"
            className="group relative w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden"
            style={{ background: palette.activeGradient, border: "none", cursor: avatarBusy ? "wait" : "pointer", padding: 0, flexShrink: 0 }}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              nickname.charAt(0).toUpperCase()
            )}
            {/* 悬停遮罩：相机图标 */}
            <span
              className="absolute inset-0 flex items-center justify-center transition-opacity"
              style={{ background: "rgba(0,0,0,0.4)", opacity: avatarBusy ? 1 : 0 }}
              onMouseEnter={(e) => !avatarBusy && (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => !avatarBusy && (e.currentTarget.style.opacity = "0")}
            >
              <Camera size={18} color="#fff" />
            </span>
          </button>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: palette.ink }}>{nickname}</div>
            <div style={{ fontSize: "12px", color: palette.muted, fontWeight: 600 }}>ID {user?.uid_display} · @{user?.username}</div>
            <div style={{ fontSize: "13px", color: palette.muted }}>{user?.email}</div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              style={{ marginTop: "4px", fontSize: "12px", fontWeight: 700, color: palette.primaryDark, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Nunito', sans-serif" }}
            >
              {avatarBusy ? "上传中…" : "更换头像"}
            </button>
            {avatarErr && <div style={{ fontSize: "12px", color: "#D14343", fontWeight: 600 }}>{avatarErr}</div>}
          </div>
        </div>

        <FieldGroup label="昵称" icon={<User size={15} />} palette={palette}>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={fieldInputStyle(palette)}
            onFocus={(e) => (e.target.style.borderColor = palette.primary)}
            onBlur={(e) => (e.target.style.borderColor = palette.border)}
          />
        </FieldGroup>

        <FieldGroup label="个人简介" icon={<FileText size={15} />} palette={palette}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            style={{ ...fieldInputStyle(palette), resize: "none", lineHeight: 1.6 }}
            onFocus={(e) => (e.target.style.borderColor = palette.primary)}
            onBlur={(e) => (e.target.style.borderColor = palette.border)}
          />
        </FieldGroup>

        {saveErr && <div style={{ fontSize: "13px", color: "#D14343", fontWeight: 600 }}>{saveErr}</div>}
        <button
          onClick={handleSave}
          className="mt-2 px-5 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95"
          style={{
            background: saved ? palette.secondary : palette.activeGradient,
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          {saved ? "✓ 已保存" : "保存修改"}
        </button>
      </Section>

      {/* Account security */}
      <Section title="账号安全" palette={palette}>
        <SettingRow
          palette={palette}
          icon={<Mail size={16} style={{ color: palette.primaryDark }} />}
          label="邮箱地址"
          value={user?.email ?? ""}
          onClick={() => setView("change-email")}
        />
        <SettingRow
          palette={palette}
          icon={<Lock size={16} style={{ color: palette.accent }} />}
          label="登录密码"
          value="••••••••"
          onClick={() => setView("change-password")}
        />
        <SettingRow
          palette={palette}
          icon={<Shield size={16} style={{ color: palette.secondary }} />}
          label="账号安全等级"
          value="普通"
        />
      </Section>

      {/* Preferences */}
      <Section title="偏好设置" palette={palette}>
        <div
          className="flex items-center justify-between py-3 px-4 rounded-xl"
          style={{ background: palette.inputBg, border: `1px solid ${palette.border}` }}
        >
          <div className="flex items-center gap-3">
            {isDark ? <Moon size={16} style={{ color: palette.accent }} /> : <Sun size={16} style={{ color: palette.secondary }} />}
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: palette.ink }}>
                {isDark ? "深色模式" : "浅色模式"}
              </div>
              <div style={{ fontSize: "12px", color: palette.muted }}>切换界面主题</div>
            </div>
          </div>
          <button
            onClick={onToggleDark}
            className="relative w-12 h-6 rounded-full transition-all"
            style={{
              background: isDark ? palette.primary : "#D8DDE5",
              border: "none",
              cursor: "pointer",
            }}
          >
            <div
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: isDark ? "26px" : "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
            />
          </button>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="账号操作" palette={palette}>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all"
          style={{
            background: palette.soft,
            border: `1.5px solid ${palette.border}`,
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          <LogOut size={16} style={{ color: palette.primaryDark }} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: palette.primaryDark }}>退出登录</span>
        </button>
      </Section>
    </SettingsShell>
  );
}

const fieldInputStyle = (palette: ThemePalette): React.CSSProperties => ({
  width: "100%",
  padding: "9px 12px",
  borderRadius: "10px",
  border: `1.5px solid ${palette.border}`,
  background: palette.inputBg,
  fontSize: "14px",
  color: palette.ink,
  outline: "none",
  fontFamily: "'Nunito', sans-serif",
  transition: "border-color 0.15s",
});

function Section({ title, children, palette }: { title: string; children: React.ReactNode; palette: ThemePalette }) {
  return (
    <Reveal className="mb-7">
      <div
        style={{ fontSize: "12px", fontWeight: 800, color: palette.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </Reveal>
  );
}

function FieldGroup({ label, icon, children, palette }: { label: string; icon: React.ReactNode; children: React.ReactNode; palette: ThemePalette }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5" style={{ fontSize: "13px", fontWeight: 700, color: palette.muted }}>
        <span style={{ color: palette.secondary }}>{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

function SettingRow({ icon, label, value, onClick, palette }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void; palette: ThemePalette }) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-xl ${onClick ? "cursor-pointer hover:opacity-90" : ""} transition-all`}
      style={{ background: palette.inputBg, border: `1px solid ${palette.border}` }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: palette.ink }}>{label}</div>
          <div style={{ fontSize: "12px", color: palette.muted }}>{value}</div>
        </div>
      </div>
      {onClick && <ChevronRight size={16} style={{ color: palette.muted }} />}
    </div>
  );
}

function SubPage({ title, children, onBack, palette }: { title: string; children: React.ReactNode; onBack: () => void; palette: ThemePalette }) {
  return (
    <SettingsShell palette={palette} maxW="max-w-md">
      <button
        onClick={onBack}
        className="flex items-center gap-2 mb-6"
        style={{ color: palette.primaryDark, fontWeight: 700, fontSize: "14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
      >
        ← 返回
      </button>
      <h2 style={{ fontSize: "22px", fontWeight: 900, color: palette.ink, marginBottom: "20px" }}>{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </SettingsShell>
  );
}

function Msg({ text }: { text: string }) {
  if (!text) return null;
  return <div style={{ fontSize: "13px", color: text.startsWith("✓") ? "#0E8A6A" : "#D14343", fontWeight: 600 }}>{text}</div>;
}

function DevHint({ code }: { code: string }) {
  if (!code) return null;
  return (
    <div style={{ fontSize: "12px", color: "#9B6A16", background: "#FFF4C9", borderRadius: "10px", padding: "8px 12px", fontWeight: 700 }}>
      开发模式验证码：{code}（已自动填入）
    </div>
  );
}

function SendCodeBtn({ onClick, busy, palette }: { onClick: () => void; busy: boolean; palette: ThemePalette }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-xl px-3 transition-all active:scale-95 flex-shrink-0"
      style={{ background: palette.soft, color: palette.primaryDark, border: `1.5px solid ${palette.border}`, fontSize: "13px", fontWeight: 800, cursor: busy ? "not-allowed" : "pointer", fontFamily: "'Nunito', sans-serif", whiteSpace: "nowrap" }}
    >
      {busy ? "…" : "发送验证码"}
    </button>
  );
}

function PasswordChangeForm({ onDone, palette }: { onDone: () => void; palette: ThemePalette }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const sendCode = async () => {
    setMsg("");
    setSending(true);
    try {
      const d: any = await api.passwordSendCode();
      if (d?.dev_code) { setDevCode(d.dev_code); setCode(d.dev_code); }
      setMsg("✓ 验证码已发送到你的邮箱");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "发送失败");
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    setMsg("");
    if (newPwd.length < 8) return setMsg("新密码至少 8 位");
    if (newPwd !== confirmPwd) return setMsg("两次输入的新密码不一致");
    if (!/^\d{6}$/.test(code)) return setMsg("请输入 6 位邮箱验证码");
    setBusy(true);
    try {
      await api.changePassword(oldPwd, code, newPwd);
      setMsg("✓ 密码已修改");
      setTimeout(onDone, 800);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "修改失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StyledInput palette={palette} placeholder="当前密码" type="password" value={oldPwd} onChange={setOldPwd} />
      <StyledInput palette={palette} placeholder="新密码（至少 8 位）" type="password" value={newPwd} onChange={setNewPwd} />
      <StyledInput palette={palette} placeholder="确认新密码" type="password" value={confirmPwd} onChange={setConfirmPwd} />
      <div className="flex gap-2">
        <StyledInput palette={palette} placeholder="邮箱验证码" type="text" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} />
        <SendCodeBtn palette={palette} onClick={sendCode} busy={sending} />
      </div>
      <DevHint code={devCode} />
      <Msg text={msg} />
      <PrimaryBtn palette={palette} onClick={submit}>{busy ? "处理中…" : "保存新密码"}</PrimaryBtn>
    </>
  );
}

function EmailChangeForm({ currentEmail, onDone, palette }: { currentEmail: string; onDone: () => void; palette: ThemePalette }) {
  const { refreshMe } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const sendCode = async () => {
    setMsg("");
    if (!newEmail.trim()) return setMsg("请输入新邮箱地址");
    setSending(true);
    try {
      const d: any = await api.emailSendCode(newEmail.trim());
      if (d?.dev_code) { setDevCode(d.dev_code); setCode(d.dev_code); }
      setMsg("✓ 验证码已发送到新邮箱");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "发送失败");
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    setMsg("");
    if (!/^\d{6}$/.test(code)) return setMsg("请输入 6 位邮箱验证码");
    if (!pwd) return setMsg("请输入当前登录密码");
    setBusy(true);
    try {
      await api.changeEmail(newEmail.trim(), code, pwd);
      await refreshMe();
      setMsg("✓ 邮箱已更新");
      setTimeout(onDone, 800);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "修改失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.7, padding: "10px 14px", background: palette.soft, borderRadius: "10px" }}>
        当前邮箱：<strong style={{ color: palette.primaryDark }}>{currentEmail}</strong>
      </div>
      <StyledInput palette={palette} placeholder="新邮箱地址" type="email" value={newEmail} onChange={setNewEmail} />
      <div className="flex gap-2">
        <StyledInput palette={palette} placeholder="新邮箱验证码" type="text" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} />
        <SendCodeBtn palette={palette} onClick={sendCode} busy={sending} />
      </div>
      <DevHint code={devCode} />
      <StyledInput palette={palette} placeholder="当前登录密码" type="password" value={pwd} onChange={setPwd} />
      <Msg text={msg} />
      <PrimaryBtn palette={palette} onClick={submit}>{busy ? "处理中…" : "确认更换邮箱"}</PrimaryBtn>
    </>
  );
}

function StyledInput({ placeholder, type, value, onChange, palette }: { placeholder: string; type: string; value: string; onChange: (v: string) => void; palette: ThemePalette }) {
  return (
    <input
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", padding: "10px 14px", borderRadius: "10px",
        border: `1.5px solid ${palette.border}`, background: palette.inputBg,
        fontSize: "14px", color: palette.ink, outline: "none", fontFamily: "'Nunito', sans-serif",
      }}
      onFocus={(e) => (e.target.style.borderColor = palette.primary)}
      onBlur={(e) => (e.target.style.borderColor = palette.border)}
    />
  );
}

function PrimaryBtn({ children, onClick, palette }: { children: React.ReactNode; onClick: () => void; palette: ThemePalette }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2.5 rounded-xl font-bold transition-all hover:opacity-90 active:scale-95"
      style={{
        background: palette.activeGradient, color: "#fff",
        fontSize: "15px", border: "none", cursor: "pointer",
        fontFamily: "'Nunito', sans-serif", boxShadow: `0 4px 16px ${palette.glow}`,
      }}
    >
      {children}
    </button>
  );
}
