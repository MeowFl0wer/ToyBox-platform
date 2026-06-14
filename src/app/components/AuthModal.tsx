import { useState } from "react";
import { X, Mail, Lock, User, AtSign, Eye, EyeOff, ArrowLeft, Zap } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../api/auth";

type AuthView = "login" | "register" | "verify-code" | "forgot" | "reset";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void; // 登录/注册成功后回调（用于撒花 + 关闭）
}

export function AuthModal({ open, onClose, onAuthed }: AuthModalProps) {
  const { applyAuth } = useAuth();
  const [view, setView] = useState<AuthView>("login");
  const [showPwd, setShowPwd] = useState(false);
  const [account, setAccount] = useState(""); // 登录：用户名或邮箱
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  if (!open) return null;

  const reset = () => {
    setView("login");
    setAccount(""); setUsername(""); setNickname(""); setEmail("");
    setPassword(""); setConfirmPwd(""); setCode(""); setDevCode("");
    setError(""); setNotice(""); setBusy(false); setShowPwd(false); setRemember(true);
  };
  const close = () => { reset(); onClose(); };
  const success = () => { reset(); onAuthed(); };

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "网络错误，请稍后再试");
    } finally {
      setBusy(false);
    }
  };

  const doLogin = () =>
    run(async () => {
      if (!account.trim() || !password) throw new ApiError(0, "请输入账号和密码");
      const data = await api.login(account.trim(), password, remember);
      applyAuth(data);
      success();
    });

  const doSendCode = () =>
    run(async () => {
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new ApiError(0, "用户名为 3-20 位字母/数字/下划线");
      if (!email.trim()) throw new ApiError(0, "请输入邮箱");
      if (password.length < 8) throw new ApiError(0, "密码至少 8 位");
      if (password !== confirmPwd) throw new ApiError(0, "两次输入的密码不一致");
      const data: any = await api.sendCode(email.trim());
      if (data?.dev_code) {
        setDevCode(data.dev_code);
        setCode(data.dev_code); // 开发模式自动填入，便于测试
      }
      setView("verify-code");
    });

  const doRegister = () =>
    run(async () => {
      if (!/^\d{6}$/.test(code)) throw new ApiError(0, "请输入 6 位验证码");
      const data = await api.register({ email: email.trim(), code, username, password, nickname: nickname.trim() });
      applyAuth(data);
      success();
    });

  const doForgot = () =>
    run(async () => {
      if (!email.trim()) throw new ApiError(0, "请输入邮箱");
      const data = await api.forgotPassword(email.trim());
      if (data?.dev_code) {
        setDevCode(data.dev_code);
        setCode(data.dev_code);
      }
      setPassword("");
      setView("reset");
    });

  const doReset = () =>
    run(async () => {
      if (!/^\d{6}$/.test(code)) throw new ApiError(0, "请输入 6 位验证码");
      if (password.length < 8) throw new ApiError(0, "新密码至少 8 位");
      await api.resetPassword(email.trim(), code, password);
      // 重置成功 → 回登录页并提示
      setView("login");
      setAccount(email.trim());
      setPassword(""); setCode(""); setDevCode("");
      setNotice("密码已重置，请用新密码登录");
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(45,31,24,0.35)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 24px 64px rgba(56,189,248,0.18), 0 4px 16px rgba(0,0,0,0.1)",
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        {/* Header gradient bar */}
        <div className="px-6 pt-6 pb-5" style={{ background: "linear-gradient(135deg, #38BDF8 0%, #2DD4BF 100%)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(view === "verify-code" || view === "forgot" || view === "reset") && (
                <button
                  onClick={() => setView(view === "verify-code" ? "register" : view === "reset" ? "forgot" : "login")}
                  className="mr-1 opacity-80 hover:opacity-100"
                  style={{ color: "#fff", background: "none", border: "none", cursor: "pointer" }}
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.25)" }}>
                <Zap size={16} color="#fff" fill="#fff" />
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: "18px", lineHeight: 1.1 }}>
                  {view === "login" && "欢迎回来"}
                  {view === "register" && "加入 ToyBox"}
                  {view === "verify-code" && "验证邮箱"}
                  {view === "forgot" && "找回密码"}
                  {view === "reset" && "重置密码"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "12px" }}>
                  {view === "login" && "登录你的账号继续探索"}
                  {view === "register" && "创建账号，开始有趣之旅"}
                  {view === "verify-code" && "请输入发送至邮箱的验证码"}
                  {view === "forgot" && "输入邮箱获取重置验证码"}
                  {view === "reset" && "输入验证码并设置新密码"}
                </div>
              </div>
            </div>
            <button
              onClick={close}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/20"
              style={{ color: "#fff", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Form body */}
        <div className="px-6 py-5 flex flex-col gap-3">
          {error && (
            <div style={{ fontSize: "13px", color: "#D14343", background: "#FDECEC", borderRadius: "10px", padding: "8px 12px", fontWeight: 600 }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{ fontSize: "13px", color: "#0E8A6A", background: "#E7F8F1", borderRadius: "10px", padding: "8px 12px", fontWeight: 600 }}>
              {notice}
            </div>
          )}

          {view === "login" && (
            <>
              <InputField icon={<User size={15} />} placeholder="用户名或邮箱" type="text" value={account} onChange={setAccount} />
              <InputField
                icon={<Lock size={15} />}
                placeholder="密码"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={setPassword}
                suffix={
                  <button onClick={() => setShowPwd(!showPwd)} style={{ color: "#8C7B72", background: "none", border: "none", cursor: "pointer" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5" style={{ fontSize: "12px", color: "#8C7B72", cursor: "pointer", fontWeight: 600 }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: "#38BDF8", cursor: "pointer" }} />
                  在此设备记住我
                </label>
                <button onClick={() => { setError(""); setNotice(""); setView("forgot"); }} style={{ fontSize: "12px", color: "#38BDF8", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  忘记密码？
                </button>
              </div>
              <PrimaryButton onClick={doLogin} busy={busy}>登录</PrimaryButton>
              <div className="text-center" style={{ fontSize: "13px", color: "#8C7B72" }}>
                还没有账号？{" "}
                <button onClick={() => { setError(""); setView("register"); }} style={{ color: "#38BDF8", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                  立即注册
                </button>
              </div>
            </>
          )}

          {view === "register" && (
            <>
              <InputField icon={<User size={15} />} placeholder="用户名（唯一，字母/数字/下划线）" type="text" value={username} onChange={setUsername} />
              <InputField icon={<AtSign size={15} />} placeholder="昵称（可选，展示用）" type="text" value={nickname} onChange={setNickname} />
              <InputField icon={<Mail size={15} />} placeholder="邮箱地址" type="email" value={email} onChange={setEmail} />
              <InputField
                icon={<Lock size={15} />}
                placeholder="设置密码（至少 8 位）"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={setPassword}
                suffix={
                  <button onClick={() => setShowPwd(!showPwd)} style={{ color: "#8C7B72", background: "none", border: "none", cursor: "pointer" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <InputField icon={<Lock size={15} />} placeholder="确认密码" type="password" value={confirmPwd} onChange={setConfirmPwd} />
              <PrimaryButton onClick={doSendCode} busy={busy}>发送验证码</PrimaryButton>
              <div className="text-center" style={{ fontSize: "13px", color: "#8C7B72" }}>
                已有账号？{" "}
                <button onClick={() => { setError(""); setView("login"); }} style={{ color: "#38BDF8", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                  直接登录
                </button>
              </div>
            </>
          )}

          {view === "verify-code" && (
            <>
              <div style={{ fontSize: "13px", color: "#8C7B72", textAlign: "center", lineHeight: 1.6 }}>
                验证码已发送至 <span style={{ color: "#38BDF8", fontWeight: 700 }}>{email}</span>，请在 10 分钟内输入
              </div>
              {devCode && (
                <div style={{ fontSize: "12px", color: "#9B6A16", background: "#FFF4C9", borderRadius: "10px", padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>
                  开发模式验证码：{devCode}（已自动填入）
                </div>
              )}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                placeholder="6 位验证码"
                className="w-full text-center rounded-xl"
                style={{
                  padding: "12px", border: "2px solid rgba(56,189,248,0.25)", background: "#FFFDF8",
                  color: "#2D1F18", outline: "none", fontFamily: "'Nunito', sans-serif",
                  fontSize: "22px", fontWeight: 800, letterSpacing: "8px",
                }}
              />
              <PrimaryButton onClick={doRegister} busy={busy}>验证并完成注册</PrimaryButton>
              <div className="text-center" style={{ fontSize: "12px", color: "#8C7B72" }}>
                没收到？{" "}
                <button onClick={doSendCode} disabled={busy} style={{ color: "#38BDF8", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                  重新发送
                </button>
              </div>
            </>
          )}

          {view === "forgot" && (
            <>
              <div style={{ fontSize: "13px", color: "#8C7B72", lineHeight: 1.6 }}>输入注册邮箱，我们会发送重置验证码</div>
              <InputField icon={<Mail size={15} />} placeholder="邮箱地址" type="email" value={email} onChange={setEmail} />
              <PrimaryButton onClick={doForgot} busy={busy}>发送重置验证码</PrimaryButton>
              <div className="text-center" style={{ fontSize: "13px", color: "#8C7B72" }}>
                想起来了？{" "}
                <button onClick={() => { setError(""); setView("login"); }} style={{ color: "#38BDF8", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                  返回登录
                </button>
              </div>
            </>
          )}

          {view === "reset" && (
            <>
              <div style={{ fontSize: "13px", color: "#8C7B72", textAlign: "center", lineHeight: 1.6 }}>
                验证码已发送至 <span style={{ color: "#38BDF8", fontWeight: 700 }}>{email}</span>
              </div>
              {devCode && (
                <div style={{ fontSize: "12px", color: "#9B6A16", background: "#FFF4C9", borderRadius: "10px", padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>
                  开发模式验证码：{devCode}（已自动填入）
                </div>
              )}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                placeholder="6 位验证码"
                className="w-full text-center rounded-xl"
                style={{ padding: "12px", border: "2px solid rgba(56,189,248,0.25)", background: "#FFFDF8", color: "#2D1F18", outline: "none", fontFamily: "'Nunito', sans-serif", fontSize: "22px", fontWeight: 800, letterSpacing: "8px" }}
              />
              <InputField
                icon={<Lock size={15} />}
                placeholder="新密码（至少 8 位）"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={setPassword}
                suffix={
                  <button onClick={() => setShowPwd(!showPwd)} style={{ color: "#8C7B72", background: "none", border: "none", cursor: "pointer" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <PrimaryButton onClick={doReset} busy={busy}>重置密码</PrimaryButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({
  icon, placeholder, type, value, onChange, suffix,
}: {
  icon: React.ReactNode;
  placeholder: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#2DD4BF" }}>
        {icon}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: suffix ? "10px 38px 10px 36px" : "10px 14px 10px 36px",
          borderRadius: "10px",
          border: "1.5px solid rgba(56,189,248,0.2)",
          background: "#FFFDF8",
          fontSize: "14px",
          color: "#2D1F18",
          outline: "none",
          fontFamily: "'Nunito', sans-serif",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#38BDF8")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(56,189,248,0.2)")}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</span>}
    </div>
  );
}

function PrimaryButton({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full py-2.5 rounded-xl font-bold transition-all hover:opacity-90 active:scale-95"
      style={{
        background: "linear-gradient(135deg, #38BDF8, #2DD4BF)",
        color: "#fff",
        fontSize: "15px",
        border: "none",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.7 : 1,
        fontFamily: "'Nunito', sans-serif",
        boxShadow: "0 4px 16px rgba(56,189,248,0.3)",
      }}
    >
      {busy ? "处理中…" : children}
    </button>
  );
}
