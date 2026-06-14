import { useState } from "react";
import { X, Mail, Lock, User, AtSign, Eye, EyeOff, ArrowLeft, Zap, ShieldCheck, KeyRound } from "lucide-react";
import type { ThemePalette } from "../theme";
import { api, ApiError } from "../api/client";
import { useAuth } from "../api/auth";

type AuthView = "login" | "register" | "verify-code" | "forgot" | "reset" | "totp-enroll" | "totp-verify" | "totp-recovery";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void; // 登录/注册成功后回调（用于撒花 + 关闭）
  palette: ThemePalette;
}

export function AuthModal({ open, onClose, onAuthed, palette }: AuthModalProps) {
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
  const [needCode, setNeedCode] = useState(false);
  const [loginCode, setLoginCode] = useState("");
  const [loginDevCode, setLoginDevCode] = useState("");
  const [totpCode, setTotpCode] = useState("");                 // 管理员动态口令
  const [totpInfo, setTotpInfo] = useState<any>(null);          // 首次绑定时的密钥/配对串
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]); // 绑定成功后一次性展示
  const [recoveryMode, setRecoveryMode] = useState(false);      // 验证页：改用恢复码登录
  const [recoveryInput, setRecoveryInput] = useState("");

  if (!open) return null;

  const reset = () => {
    setView("login");
    setAccount(""); setUsername(""); setNickname(""); setEmail("");
    setPassword(""); setConfirmPwd(""); setCode(""); setDevCode("");
    setError(""); setNotice(""); setBusy(false); setShowPwd(false); setRemember(true);
    setNeedCode(false); setLoginCode(""); setLoginDevCode("");
    setTotpCode(""); setTotpInfo(null); setCopied(false);
    setRecoveryCodes([]); setRecoveryMode(false); setRecoveryInput("");
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

  const doLogin = async () => {
    setError("");
    setNotice("");
    if (!account.trim() || !password) {
      setError("请输入账号和密码");
      return;
    }
    if (needCode && !/^\d{6}$/.test(loginCode)) {
      setError("请输入 6 位邮箱验证码");
      return;
    }
    setBusy(true);
    try {
      const data = await api.login(
        account.trim(), password, remember,
        needCode ? loginCode : undefined,
        recoveryMode ? undefined : (totpCode || undefined),
        recoveryMode ? (recoveryInput.trim() || undefined) : undefined,
      );
      applyAuth(data);
      if (data.recovery_codes?.length) {
        // 刚完成绑定 → 展示一次性恢复码，确认保存后再进入
        setRecoveryCodes(data.recovery_codes);
        setView("totp-recovery");
      } else {
        success();
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 10007) {
        setNeedCode(true); // 失败过多 → 需要邮箱验证码（不再硬锁正确密码）
        setError(e.message);
      } else if (e instanceof ApiError && e.code === 10008) {
        // 管理员首次登录：需绑定 Authenticator（展示密钥）
        setTotpInfo(e.data);
        setError(totpCode ? e.message : "");  // 仅在输错动态码重试时提示
        setView("totp-enroll");
      } else if (e instanceof ApiError && e.code === 10009) {
        // 管理员已绑定：需输入动态码
        setError(totpCode ? e.message : "");
        setView("totp-verify");
      } else {
        setError(e instanceof ApiError ? e.message : "网络错误，请稍后再试");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendLoginCode = () =>
    run(async () => {
      if (!account.trim()) throw new ApiError(0, "请输入账号");
      const d = await api.loginSendCode(account.trim());
      if (d?.dev_code) {
        setLoginDevCode(d.dev_code);
        setLoginCode(d.dev_code);
      }
      setNotice("验证码已发送到该账号邮箱");
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

  // 6 位验证码输入框的共用样式（随主题/深浅模式变化）
  const codeInputStyle = (big: boolean): React.CSSProperties => ({
    padding: big ? "12px" : "10px",
    border: `${big ? 2 : 1.5}px solid ${palette.border}`,
    background: palette.inputBg,
    color: palette.ink,
    outline: "none",
    fontFamily: "'Nunito', sans-serif",
    fontSize: big ? "22px" : "16px",
    fontWeight: 800,
    letterSpacing: big ? "8px" : "4px",
  });

  const linkStyle: React.CSSProperties = {
    color: palette.primaryDark,
    fontWeight: 700,
    background: "none",
    border: "none",
    cursor: "pointer",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(45,31,24,0.35)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: palette.surface,
          boxShadow: `0 24px 64px ${palette.glow}, 0 4px 16px rgba(0,0,0,0.18)`,
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        {/* Header gradient bar */}
        <div className="px-6 pt-6 pb-5" style={{ background: palette.activeGradient }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(view === "verify-code" || view === "forgot" || view === "reset" || view === "totp-enroll" || view === "totp-verify") && (
                <button
                  onClick={() => { setTotpCode(""); setError(""); setView(view === "verify-code" ? "register" : view === "reset" ? "forgot" : "login"); }}
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
                  {view === "totp-enroll" && "绑定动态验证器"}
                  {view === "totp-verify" && "管理员二次验证"}
                  {view === "totp-recovery" && "保存恢复码"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.78)", fontSize: "12px" }}>
                  {view === "login" && "登录你的账号继续探索"}
                  {view === "register" && "创建账号，开始有趣之旅"}
                  {view === "verify-code" && "请输入发送至邮箱的验证码"}
                  {view === "forgot" && "输入邮箱获取重置验证码"}
                  {view === "reset" && "输入验证码并设置新密码"}
                  {view === "totp-enroll" && "用 Authenticator 扫码或手动添加"}
                  {view === "totp-verify" && "请输入 Authenticator 动态验证码"}
                  {view === "totp-recovery" && "丢失验证器时用它登录，仅显示这一次"}
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
              <InputField palette={palette} icon={<User size={15} />} placeholder="用户名或邮箱" type="text" value={account} onChange={setAccount} />
              <InputField
                palette={palette}
                icon={<Lock size={15} />}
                placeholder="密码"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={setPassword}
                suffix={
                  <button onClick={() => setShowPwd(!showPwd)} style={{ color: palette.muted, background: "none", border: "none", cursor: "pointer" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5" style={{ fontSize: "12px", color: palette.muted, cursor: "pointer", fontWeight: 600 }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: palette.primary, cursor: "pointer" }} />
                  在此设备记住我
                </label>
                <button onClick={() => { setError(""); setNotice(""); setView("forgot"); }} style={{ fontSize: "12px", color: palette.primaryDark, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  忘记密码？
                </button>
              </div>
              {needCode && (
                <>
                  {loginDevCode && (
                    <div style={{ fontSize: "12px", color: "#9B6A16", background: "#FFF4C9", borderRadius: "10px", padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>
                      开发模式验证码：{loginDevCode}（已自动填入）
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={loginCode}
                      onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="邮箱验证码"
                      className="flex-1 rounded-xl text-center"
                      style={codeInputStyle(false)}
                    />
                    <button
                      onClick={sendLoginCode}
                      disabled={busy}
                      className="rounded-xl px-3 flex-shrink-0"
                      style={{ background: palette.soft, color: palette.primaryDark, border: `1.5px solid ${palette.border}`, fontSize: "13px", fontWeight: 800, cursor: busy ? "not-allowed" : "pointer", fontFamily: "'Nunito', sans-serif", whiteSpace: "nowrap" }}
                    >
                      发送验证码
                    </button>
                  </div>
                </>
              )}
              <PrimaryButton palette={palette} onClick={doLogin} busy={busy}>登录</PrimaryButton>
              <div className="text-center" style={{ fontSize: "13px", color: palette.muted }}>
                还没有账号？{" "}
                <button onClick={() => { setError(""); setView("register"); }} style={linkStyle}>
                  立即注册
                </button>
              </div>
            </>
          )}

          {view === "register" && (
            <>
              <InputField palette={palette} icon={<User size={15} />} placeholder="用户名（唯一，字母/数字/下划线）" type="text" value={username} onChange={setUsername} />
              <InputField palette={palette} icon={<AtSign size={15} />} placeholder="昵称（可选，展示用）" type="text" value={nickname} onChange={setNickname} />
              <InputField palette={palette} icon={<Mail size={15} />} placeholder="邮箱地址" type="email" value={email} onChange={setEmail} />
              <InputField
                palette={palette}
                icon={<Lock size={15} />}
                placeholder="设置密码（至少 8 位）"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={setPassword}
                suffix={
                  <button onClick={() => setShowPwd(!showPwd)} style={{ color: palette.muted, background: "none", border: "none", cursor: "pointer" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <InputField palette={palette} icon={<Lock size={15} />} placeholder="确认密码" type="password" value={confirmPwd} onChange={setConfirmPwd} />
              <PrimaryButton palette={palette} onClick={doSendCode} busy={busy}>发送验证码</PrimaryButton>
              <div className="text-center" style={{ fontSize: "13px", color: palette.muted }}>
                已有账号？{" "}
                <button onClick={() => { setError(""); setView("login"); }} style={linkStyle}>
                  直接登录
                </button>
              </div>
            </>
          )}

          {view === "verify-code" && (
            <>
              <div style={{ fontSize: "13px", color: palette.muted, textAlign: "center", lineHeight: 1.6 }}>
                验证码已发送至 <span style={{ color: palette.primaryDark, fontWeight: 700 }}>{email}</span>，请在 10 分钟内输入
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
                style={codeInputStyle(true)}
              />
              <PrimaryButton palette={palette} onClick={doRegister} busy={busy}>验证并完成注册</PrimaryButton>
              <div className="text-center" style={{ fontSize: "12px", color: palette.muted }}>
                没收到？{" "}
                <button onClick={doSendCode} disabled={busy} style={linkStyle}>
                  重新发送
                </button>
              </div>
            </>
          )}

          {view === "forgot" && (
            <>
              <div style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.6 }}>输入注册邮箱，我们会发送重置验证码</div>
              <InputField palette={palette} icon={<Mail size={15} />} placeholder="邮箱地址" type="email" value={email} onChange={setEmail} />
              <PrimaryButton palette={palette} onClick={doForgot} busy={busy}>发送重置验证码</PrimaryButton>
              <div className="text-center" style={{ fontSize: "13px", color: palette.muted }}>
                想起来了？{" "}
                <button onClick={() => { setError(""); setView("login"); }} style={linkStyle}>
                  返回登录
                </button>
              </div>
            </>
          )}

          {view === "reset" && (
            <>
              <div style={{ fontSize: "13px", color: palette.muted, textAlign: "center", lineHeight: 1.6 }}>
                验证码已发送至 <span style={{ color: palette.primaryDark, fontWeight: 700 }}>{email}</span>
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
                style={codeInputStyle(true)}
              />
              <InputField
                palette={palette}
                icon={<Lock size={15} />}
                placeholder="新密码（至少 8 位）"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={setPassword}
                suffix={
                  <button onClick={() => setShowPwd(!showPwd)} style={{ color: palette.muted, background: "none", border: "none", cursor: "pointer" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <PrimaryButton palette={palette} onClick={doReset} busy={busy}>重置密码</PrimaryButton>
            </>
          )}

          {view === "totp-enroll" && (
            <>
              <div className="flex items-start gap-2" style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.6 }}>
                <ShieldCheck size={16} style={{ color: palette.primaryDark, flexShrink: 0, marginTop: "2px" }} />
                <span>管理员账号需开启二次验证。请在 <b style={{ color: palette.ink }}>Authenticator</b>（Google / Microsoft Authenticator、Authy、1Password 等）里选择「手动添加 / 输入设置密钥」，再输入下方生成的 6 位动态码完成绑定。</span>
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 800, color: palette.muted, marginBottom: "4px" }}>账户名</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: palette.ink, marginBottom: "8px" }}>{totpInfo?.issuer || "ToyBox"} ({totpInfo?.account})</div>
                <div style={{ fontSize: "12px", fontWeight: 800, color: palette.muted, marginBottom: "4px" }}>设置密钥（Setup key）</div>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(totpInfo?.secret || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="w-full text-left rounded-xl px-3 py-2.5"
                  title="点击复制"
                  style={{ background: palette.inputBg, border: `1.5px solid ${palette.border}`, color: palette.ink, fontFamily: "monospace", fontSize: "15px", fontWeight: 800, letterSpacing: "2px", wordBreak: "break-all", cursor: "pointer" }}
                >
                  {totpInfo?.secret}
                </button>
                <div style={{ fontSize: "11px", color: copied ? "#0E8A6A" : palette.muted, marginTop: "4px" }}>{copied ? "✓ 已复制到剪贴板" : "点击密钥可复制；算法 SHA1 · 6 位 · 30 秒"}</div>
              </div>
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                placeholder="输入 App 上的 6 位动态码"
                className="w-full text-center rounded-xl"
                style={codeInputStyle(true)}
              />
              <PrimaryButton palette={palette} onClick={doLogin} busy={busy}>绑定并登录</PrimaryButton>
            </>
          )}

          {view === "totp-verify" && (
            <>
              <div className="flex items-center gap-2" style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.6 }}>
                <KeyRound size={16} style={{ color: palette.primaryDark, flexShrink: 0 }} />
                <span>{recoveryMode
                  ? <>验证器丢了？输入一条绑定时保存的<b style={{ color: palette.ink }}>一次性恢复码</b>登录（每条仅一次）。</>
                  : <>请打开 Authenticator，输入 <b style={{ color: palette.ink }}>{account}</b> 当前的 6 位动态码。</>}</span>
              </div>
              {recoveryMode ? (
                <input
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value.slice(0, 40))}
                  placeholder="恢复码，如 1a2b-3c4d"
                  className="w-full text-center rounded-xl"
                  style={{ padding: "12px", border: `2px solid ${palette.border}`, background: palette.inputBg, color: palette.ink, outline: "none", fontFamily: "monospace", fontSize: "18px", fontWeight: 800, letterSpacing: "2px" }}
                  autoFocus
                />
              ) : (
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="6 位动态码"
                  className="w-full text-center rounded-xl"
                  style={codeInputStyle(true)}
                  autoFocus
                />
              )}
              <PrimaryButton palette={palette} onClick={doLogin} busy={busy}>{recoveryMode ? "用恢复码登录" : "验证并登录"}</PrimaryButton>
              <div className="text-center" style={{ fontSize: "12px", color: palette.muted }}>
                <button onClick={() => { setRecoveryMode(!recoveryMode); setError(""); setTotpCode(""); setRecoveryInput(""); }} style={linkStyle}>
                  {recoveryMode ? "改用动态验证码" : "丢失验证器？用恢复码登录"}
                </button>
              </div>
            </>
          )}

          {view === "totp-recovery" && (
            <>
              <div className="flex items-start gap-2" style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.6 }}>
                <ShieldCheck size={16} style={{ color: palette.primaryDark, flexShrink: 0, marginTop: "2px" }} />
                <span>绑定成功！请把下面的 <b style={{ color: palette.ink }}>一次性恢复码</b> 保存到安全的地方。丢失验证器时，可用其中任意一条登录（每条仅能用一次）。<b style={{ color: palette.ink }}>它们只显示这一次。</b></span>
              </div>
              <div className="grid grid-cols-1 gap-1.5" style={{ maxHeight: "240px", overflowY: "auto" }}>
                {recoveryCodes.map((c) => (
                  <div key={c} style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 800, color: palette.ink, background: palette.inputBg, border: `1px solid ${palette.border}`, borderRadius: "8px", padding: "7px 10px", textAlign: "center", letterSpacing: "1px" }}>{c}</div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(recoveryCodes.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                style={{ ...linkStyle, fontSize: "13px", color: copied ? "#0E8A6A" : palette.primaryDark }}
              >
                {copied ? "✓ 已复制全部" : "复制全部恢复码"}
              </button>
              <PrimaryButton palette={palette} onClick={success} busy={busy}>我已保存，进入</PrimaryButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({
  icon, placeholder, type, value, onChange, suffix, palette,
}: {
  icon: React.ReactNode;
  placeholder: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: React.ReactNode;
  palette: ThemePalette;
}) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: palette.secondary }}>
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
          border: `1.5px solid ${palette.border}`,
          background: palette.inputBg,
          fontSize: "14px",
          color: palette.ink,
          outline: "none",
          fontFamily: "'Nunito', sans-serif",
        }}
        onFocus={(e) => (e.target.style.borderColor = palette.primary)}
        onBlur={(e) => (e.target.style.borderColor = palette.border)}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</span>}
    </div>
  );
}

function PrimaryButton({ children, onClick, busy, palette }: { children: React.ReactNode; onClick: () => void; busy?: boolean; palette: ThemePalette }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full py-2.5 rounded-xl font-bold transition-all hover:opacity-90 active:scale-95"
      style={{
        background: palette.activeGradient,
        color: "#fff",
        fontSize: "15px",
        border: "none",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.7 : 1,
        fontFamily: "'Nunito', sans-serif",
        boxShadow: `0 4px 16px ${palette.glow}`,
      }}
    >
      {busy ? "处理中…" : children}
    </button>
  );
}
