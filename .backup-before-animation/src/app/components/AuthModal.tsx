import { useState } from "react";
import { X, Mail, Lock, User, Eye, EyeOff, ArrowLeft, Zap } from "lucide-react";

type AuthView = "login" | "register" | "verify-code" | "forgot-password";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: (user: { name: string; email: string }) => void;
}

export function AuthModal({ open, onClose, onLogin }: AuthModalProps) {
  const [view, setView] = useState<AuthView>("login");
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [code, setCode] = useState("");

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px 10px 40px",
    borderRadius: "10px",
    border: "1.5px solid rgba(56,189,248,0.2)",
    background: "#FFFDF8",
    fontSize: "14px",
    color: "#2D1F18",
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.15s",
  };

  const handleLogin = () => {
    onLogin({ name: name || "ToyBox 用户", email: email || "user@example.com" });
    onClose();
  };

  const handleRegister = () => {
    setView("verify-code");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(45,31,24,0.35)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
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
        <div
          className="px-6 pt-6 pb-5"
          style={{ background: "linear-gradient(135deg, #38BDF8 0%, #2DD4BF 100%)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(view === "verify-code" || view === "forgot-password") && (
                <button
                  onClick={() => setView(view === "verify-code" ? "register" : "login")}
                  className="mr-1 opacity-80 hover:opacity-100"
                  style={{ color: "#fff", background: "none", border: "none", cursor: "pointer" }}
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.25)" }}
              >
                <Zap size={16} color="#fff" fill="#fff" />
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: "18px", lineHeight: 1.1 }}>
                  {view === "login" && "欢迎回来"}
                  {view === "register" && "加入 ToyBox"}
                  {view === "verify-code" && "验证邮箱"}
                  {view === "forgot-password" && "重置密码"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "12px" }}>
                  {view === "login" && "登录你的账号继续探索"}
                  {view === "register" && "创建账号，开始有趣之旅"}
                  {view === "verify-code" && "请输入发送至邮箱的验证码"}
                  {view === "forgot-password" && "重置你的账号密码"}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/20"
              style={{ color: "#fff", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Form body */}
        <div className="px-6 py-5 flex flex-col gap-3">
          {view === "login" && (
            <>
              <InputField icon={<Mail size={15} />} placeholder="邮箱地址" type="email" value={email} onChange={setEmail} />
              <InputField icon={<Lock size={15} />} placeholder="密码" type={showPwd ? "text" : "password"} value={password} onChange={setPassword}
                suffix={
                  <button onClick={() => setShowPwd(!showPwd)} style={{ color: "#8C7B72", background: "none", border: "none", cursor: "pointer" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <div className="flex justify-end">
                <button onClick={() => setView("forgot-password")} style={{ fontSize: "12px", color: "#38BDF8", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  忘记密码？
                </button>
              </div>
              <PrimaryButton onClick={handleLogin}>登录</PrimaryButton>
              <div className="text-center" style={{ fontSize: "13px", color: "#8C7B72" }}>
                还没有账号？{" "}
                <button onClick={() => setView("register")} style={{ color: "#38BDF8", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                  立即注册
                </button>
              </div>
            </>
          )}

          {view === "register" && (
            <>
              <InputField icon={<User size={15} />} placeholder="用户昵称" type="text" value={name} onChange={setName} />
              <InputField icon={<Mail size={15} />} placeholder="邮箱地址" type="email" value={email} onChange={setEmail} />
              <InputField icon={<Lock size={15} />} placeholder="设置密码" type={showPwd ? "text" : "password"} value={password} onChange={setPassword}
                suffix={
                  <button onClick={() => setShowPwd(!showPwd)} style={{ color: "#8C7B72", background: "none", border: "none", cursor: "pointer" }}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <InputField icon={<Lock size={15} />} placeholder="确认密码" type="password" value={confirmPwd} onChange={setConfirmPwd} />
              <PrimaryButton onClick={handleRegister}>注册并验证邮箱</PrimaryButton>
              <div className="text-center" style={{ fontSize: "13px", color: "#8C7B72" }}>
                已有账号？{" "}
                <button onClick={() => setView("login")} style={{ color: "#38BDF8", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                  直接登录
                </button>
              </div>
            </>
          )}

          {view === "verify-code" && (
            <>
              <div style={{ fontSize: "13px", color: "#8C7B72", textAlign: "center", lineHeight: 1.6 }}>
                验证码已发送至 <span style={{ color: "#38BDF8", fontWeight: 700 }}>{email || "your@email.com"}</span>，请在 10 分钟内输入
              </div>
              <div className="flex gap-2 justify-center my-2">
                {[0,1,2,3,4,5].map(i => (
                  <input
                    key={i}
                    maxLength={1}
                    className="w-10 h-12 text-center rounded-xl text-lg font-bold"
                    style={{
                      border: "2px solid rgba(56,189,248,0.25)",
                      background: "#FFFDF8",
                      color: "#2D1F18",
                      outline: "none",
                      fontFamily: "'Nunito', sans-serif",
                    }}
                  />
                ))}
              </div>
              <PrimaryButton onClick={handleLogin}>验证并完成注册</PrimaryButton>
              <div className="text-center" style={{ fontSize: "12px", color: "#8C7B72" }}>
                没收到？{" "}
                <button style={{ color: "#38BDF8", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                  重新发送
                </button>
              </div>
            </>
          )}

          {view === "forgot-password" && (
            <>
              <div style={{ fontSize: "13px", color: "#8C7B72", lineHeight: 1.6 }}>
                输入注册邮箱，我们将发送重置链接
              </div>
              <InputField icon={<Mail size={15} />} placeholder="邮箱地址" type="email" value={email} onChange={setEmail} />
              <PrimaryButton onClick={() => setView("verify-code")}>发送重置验证码</PrimaryButton>
              <div className="text-center" style={{ fontSize: "13px", color: "#8C7B72" }}>
                想起密码了？{" "}
                <button onClick={() => setView("login")} style={{ color: "#38BDF8", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
                  返回登录
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({
  icon, placeholder, type, value, onChange, suffix
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
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</span>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2.5 rounded-xl font-bold transition-all hover:opacity-90 active:scale-95"
      style={{
        background: "linear-gradient(135deg, #38BDF8, #2DD4BF)",
        color: "#fff",
        fontSize: "15px",
        border: "none",
        cursor: "pointer",
        fontFamily: "'Nunito', sans-serif",
        boxShadow: "0 4px 16px rgba(56,189,248,0.3)",
      }}
    >
      {children}
    </button>
  );
}
