import { useState } from "react";
import { Mail, Lock, User, FileText, Moon, Sun, LogOut, ChevronRight, Shield } from "lucide-react";
import type { ThemePalette } from "../theme";
import { Reveal, fireConfetti } from "./anim";
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

export function SettingsPage({ isLoggedIn, onOpenAuth, onLogout, isDark, onToggleDark, user, palette }: SettingsPageProps) {
  const { refreshMe } = useAuth();
  const [view, setView] = useState<SettingsView>("main");
  const [nickname, setNickname] = useState(user?.nickname || user?.username || "ToyBox 用户");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState("");

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
      <div
        className="min-h-full flex flex-col items-center justify-center gap-6 bg-flow"
        style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg, padding: "40px 20px" }}
      >
        <div style={{ fontSize: "64px" }}>🔒</div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#2D1F18", marginBottom: "8px" }}>
            请先登录
          </h2>
          <p style={{ fontSize: "14px", color: "#8C7B72", maxWidth: "280px", lineHeight: 1.7 }}>
            登录后即可管理你的账号信息、偏好设置，以及查看使用记录
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="px-8 py-3 rounded-2xl transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #38BDF8, #2DD4BF)",
            color: "#fff",
            fontSize: "16px",
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(56,189,248,0.35)",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          登录 / 注册
        </button>
      </div>
    );
  }

  if (view === "change-password") {
    return <SubPage title="修改密码" onBack={() => setView("main")} palette={palette}>
      <PasswordChangeForm onDone={() => setView("main")} />
    </SubPage>;
  }

  if (view === "change-email") {
    return <SubPage title="修改邮箱" onBack={() => setView("main")} palette={palette}>
      <EmailChangeForm currentEmail={user?.email ?? ""} onDone={() => setView("main")} />
    </SubPage>;
  }

  return (
    <div
      className="min-h-full bg-flow"
      style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}
    >
      <div className="px-6 md:px-10 py-8 max-w-2xl">
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#2D1F18", marginBottom: "6px" }}>
          个人设置
        </h1>
        <p style={{ fontSize: "13px", color: "#8C7B72", marginBottom: "28px" }}>
          管理你的账号信息和偏好
        </p>

        {/* Avatar + profile */}
        <Section title="基本信息">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden"
              style={{ background: "linear-gradient(135deg, #38BDF8, #2DD4BF)" }}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                nickname.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#2D1F18" }}>{nickname}</div>
              <div style={{ fontSize: "12px", color: "#8C7B72", fontWeight: 600 }}>ID {user?.uid_display} · @{user?.username}</div>
              <div style={{ fontSize: "13px", color: "#8C7B72" }}>{user?.email}</div>
            </div>
          </div>

          <FieldGroup label="昵称" icon={<User size={15} />}>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              style={fieldInputStyle}
              onFocus={(e) => (e.target.style.borderColor = "#38BDF8")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(56,189,248,0.2)")}
            />
          </FieldGroup>

          <FieldGroup label="个人简介" icon={<FileText size={15} />}>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              style={{ ...fieldInputStyle, resize: "none", lineHeight: 1.6 }}
              onFocus={(e) => (e.target.style.borderColor = "#38BDF8")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(56,189,248,0.2)")}
            />
          </FieldGroup>

          {saveErr && <div style={{ fontSize: "13px", color: "#D14343", fontWeight: 600 }}>{saveErr}</div>}
          <button
            onClick={handleSave}
            className="mt-2 px-5 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95"
            style={{
              background: saved ? "#2DD4BF" : "linear-gradient(135deg, #38BDF8, #2DD4BF)",
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
        <Section title="账号安全">
          <SettingRow
            icon={<Mail size={16} style={{ color: "#036E94" }} />}
            label="邮箱地址"
            value={user?.email ?? ""}
            onClick={() => setView("change-email")}
          />
          <SettingRow
            icon={<Lock size={16} style={{ color: "#A6877A" }} />}
            label="登录密码"
            value="••••••••"
            onClick={() => setView("change-password")}
          />
          <SettingRow
            icon={<Shield size={16} style={{ color: "#6B7A55" }} />}
            label="账号安全等级"
            value="普通"
          />
        </Section>

        {/* Preferences */}
        <Section title="偏好设置">
          <div
            className="flex items-center justify-between py-3 px-4 rounded-xl"
            style={{ background: "#FFFDF8", border: "1px solid rgba(56,189,248,0.08)" }}
          >
            <div className="flex items-center gap-3">
              {isDark ? <Moon size={16} style={{ color: "#A6877A" }} /> : <Sun size={16} style={{ color: "#2DD4BF" }} />}
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#2D1F18" }}>
                  {isDark ? "深色模式" : "浅色模式"}
                </div>
                <div style={{ fontSize: "12px", color: "#8C7B72" }}>切换界面主题</div>
              </div>
            </div>
            <button
              onClick={onToggleDark}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{
                background: isDark ? "#38BDF8" : "#E5E7EB",
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
        <Section title="账号操作">
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
      </div>
    </div>
  );
}

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "10px",
  border: "1.5px solid rgba(56,189,248,0.2)",
  background: "#FFFDF8",
  fontSize: "14px",
  color: "#2D1F18",
  outline: "none",
  fontFamily: "'Nunito', sans-serif",
  transition: "border-color 0.15s",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal className="mb-7">
      <div
        style={{ fontSize: "12px", fontWeight: 800, color: "#C4B5AD", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </Reveal>
  );
}

function FieldGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5" style={{ fontSize: "13px", fontWeight: 700, color: "#8C7B72" }}>
        <span style={{ color: "#2DD4BF" }}>{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

function SettingRow({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-xl ${onClick ? "cursor-pointer hover:bg-sky-50" : ""} transition-all`}
      style={{ background: "#FFFDF8", border: "1px solid rgba(56,189,248,0.08)" }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#2D1F18" }}>{label}</div>
          <div style={{ fontSize: "12px", color: "#8C7B72" }}>{value}</div>
        </div>
      </div>
      {onClick && <ChevronRight size={16} style={{ color: "#C4B5AD" }} />}
    </div>
  );
}

function SubPage({ title, children, onBack, palette }: { title: string; children: React.ReactNode; onBack: () => void; palette: ThemePalette }) {
  return (
    <div className="min-h-full bg-flow" style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}>
      <div className="px-6 md:px-10 py-8 max-w-md">
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-6"
          style={{ color: "#38BDF8", fontWeight: 700, fontSize: "14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
        >
          ← 返回
        </button>
        <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#2D1F18", marginBottom: "20px" }}>{title}</h2>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
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

function SendCodeBtn({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-xl px-3 transition-all active:scale-95 flex-shrink-0"
      style={{ background: "#E6F7FF", color: "#036E94", border: "1.5px solid rgba(56,189,248,0.3)", fontSize: "13px", fontWeight: 800, cursor: busy ? "not-allowed" : "pointer", fontFamily: "'Nunito', sans-serif", whiteSpace: "nowrap" }}
    >
      {busy ? "…" : "发送验证码"}
    </button>
  );
}

function PasswordChangeForm({ onDone }: { onDone: () => void }) {
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
      <StyledInput placeholder="当前密码" type="password" value={oldPwd} onChange={setOldPwd} />
      <StyledInput placeholder="新密码（至少 8 位）" type="password" value={newPwd} onChange={setNewPwd} />
      <StyledInput placeholder="确认新密码" type="password" value={confirmPwd} onChange={setConfirmPwd} />
      <div className="flex gap-2">
        <StyledInput placeholder="邮箱验证码" type="text" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} />
        <SendCodeBtn onClick={sendCode} busy={sending} />
      </div>
      <DevHint code={devCode} />
      <Msg text={msg} />
      <PrimaryBtn onClick={submit}>{busy ? "处理中…" : "保存新密码"}</PrimaryBtn>
    </>
  );
}

function EmailChangeForm({ currentEmail, onDone }: { currentEmail: string; onDone: () => void }) {
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
      <div style={{ fontSize: "13px", color: "#8C7B72", lineHeight: 1.7, padding: "10px 14px", background: "#E6F7FF", borderRadius: "10px" }}>
        当前邮箱：<strong style={{ color: "#38BDF8" }}>{currentEmail}</strong>
      </div>
      <StyledInput placeholder="新邮箱地址" type="email" value={newEmail} onChange={setNewEmail} />
      <div className="flex gap-2">
        <StyledInput placeholder="新邮箱验证码" type="text" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} />
        <SendCodeBtn onClick={sendCode} busy={sending} />
      </div>
      <DevHint code={devCode} />
      <StyledInput placeholder="当前登录密码" type="password" value={pwd} onChange={setPwd} />
      <Msg text={msg} />
      <PrimaryBtn onClick={submit}>{busy ? "处理中…" : "确认更换邮箱"}</PrimaryBtn>
    </>
  );
}

function StyledInput({ placeholder, type, value, onChange }: { placeholder: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", padding: "10px 14px", borderRadius: "10px",
        border: "1.5px solid rgba(56,189,248,0.2)", background: "#FFFDF8",
        fontSize: "14px", color: "#2D1F18", outline: "none", fontFamily: "'Nunito', sans-serif",
      }}
      onFocus={(e) => (e.target.style.borderColor = "#38BDF8")}
      onBlur={(e) => (e.target.style.borderColor = "rgba(56,189,248,0.2)")}
    />
  );
}

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2.5 rounded-xl font-bold transition-all hover:opacity-90 active:scale-95"
      style={{
        background: "linear-gradient(135deg, #38BDF8, #2DD4BF)", color: "#fff",
        fontSize: "15px", border: "none", cursor: "pointer",
        fontFamily: "'Nunito', sans-serif", boxShadow: "0 4px 16px rgba(56,189,248,0.3)",
      }}
    >
      {children}
    </button>
  );
}
