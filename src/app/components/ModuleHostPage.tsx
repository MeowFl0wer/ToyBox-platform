import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Lock, LogIn } from "lucide-react";
import type { ThemePalette } from "../theme";
import { api, type ApiModule } from "../api/client";
import { moduleEmoji } from "../api/moduleIcon";
import { Reveal } from "./anim";

interface ModuleHostPageProps {
  module: ApiModule;
  palette: ThemePalette;
  isLoggedIn: boolean;
  onBack: () => void;
  onOpenAuth: () => void;
}

export function ModuleHostPage({ module, palette, isLoggedIn, onBack, onOpenAuth }: ModuleHostPageProps) {
  const comingSoon = module.status === "coming_soon";
  const needLogin = module.auth_required && !isLoggedIn;

  return (
    <div className="min-h-full bg-flow flex flex-col" style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}>
      <div className="px-6 md:px-10 pt-6 pb-5 flex-shrink-0" style={{ borderBottom: `1px solid ${palette.border}` }}>
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5"
          style={{ color: palette.primaryDark, fontWeight: 700, fontSize: "14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
        >
          <ArrowLeft size={16} /> 返回工具大厅
        </button>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ background: palette.soft }}>
            {moduleEmoji(module)}
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: palette.ink }}>{module.name}</div>
            <div className="flex flex-wrap items-center gap-2 mt-1" style={{ fontSize: "12px", fontWeight: 700, color: palette.muted }}>
              <span>{module.description}</span>
              {module.version && <Badge palette={palette}>v{module.version}</Badge>}
              <Badge palette={palette}>{module.category}</Badge>
              {module.auth_required && <Badge palette={palette}><Lock size={11} /> 需要登录</Badge>}
              <Badge palette={palette}>{comingSoon ? "即将上线" : "运行中"}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-10 py-6 min-h-0">
        {comingSoon ? (
          <Centered><ComingSoon palette={palette} /></Centered>
        ) : needLogin ? (
          <Centered><NeedLogin palette={palette} onOpenAuth={onOpenAuth} /></Centered>
        ) : (
          <ModuleFrame module={module} palette={palette} />
        )}
      </div>
    </div>
  );
}

/**
 * 模块承载：iframe 用 sandbox(allow-scripts) 成为不透明源 —— 拿不到主站 Cookie/不能同源访问 /api/auth/refresh。
 * 模块前端不直接联网，而是通过 postMessage 把 API 请求发给本宿主；宿主用「模块级短期 token」
 * 调用网关 /api/modules/{id}/* 并把结果回传。token 只在宿主，且只能访问本模块。
 */
function ModuleFrame({ module, palette }: { module: ApiModule; palette: ThemePalette }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef<string | null>(null);
  const [ready, setReady] = useState(!module.auth_required); // 匿名模块无需 token，直接就绪
  const [err, setErr] = useState("");

  // 取模块级 token（仅需登录模块）
  useEffect(() => {
    if (!module.auth_required) return;
    let alive = true;
    api
      .moduleToken(module.module_id)
      .then((d) => {
        if (!alive) return;
        tokenRef.current = d.token;
        setReady(true);
      })
      .catch(() => alive && setErr("获取模块访问令牌失败"));
    return () => {
      alive = false;
    };
  }, [module.module_id, module.auth_required]);

  // postMessage RPC 代理：只代发本模块网关路径，带模块 token
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      const win = iframeRef.current?.contentWindow;
      if (!win || e.source !== win) return; // 只接受本 iframe 的消息
      const msg = e.data;
      if (!msg || msg.source !== "pt-module" || msg.type !== "api") return;
      const reply = (status: number, body: unknown) =>
        win.postMessage({ source: "pt-host", type: "api_result", reqId: msg.reqId, status, body }, "*");
      // 仅允许相对子路径，拼到本模块网关下
      const sub = typeof msg.path === "string" && msg.path.startsWith("/") && !msg.path.includes("://") ? msg.path : null;
      if (!sub) {
        reply(0, { code: 10004, message: "非法请求路径", data: null });
        return;
      }
      try {
        const headers: Record<string, string> = {};
        if (msg.body !== undefined && msg.body !== null) headers["Content-Type"] = "application/json";
        if (tokenRef.current) headers["Authorization"] = `Bearer ${tokenRef.current}`;
        const res = await fetch(`/api/modules/${module.module_id}${sub}`, {
          method: (msg.method || "GET").toUpperCase(),
          headers,
          credentials: "omit", // 不带 Cookie，纯 token 鉴权
          body: msg.body !== undefined && msg.body !== null ? JSON.stringify(msg.body) : undefined,
        });
        let json: unknown = {};
        try {
          json = await res.json();
        } catch {
          /* 空响应 */
        }
        reply(res.status, json);
      } catch {
        reply(0, { code: 50000, message: "网络错误", data: null });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [module.module_id]);

  if (err) {
    return <Centered><CardBox palette={palette}><div style={{ fontSize: "16px", color: "#D14343", fontWeight: 700 }}>{err}</div></CardBox></Centered>;
  }
  if (!ready) {
    return <Centered><CardBox palette={palette}><div style={{ fontSize: "44px" }}>⏳</div><div style={{ color: palette.muted, fontWeight: 700, marginTop: "8px" }}>正在准备模块…</div></CardBox></Centered>;
  }
  return (
    <iframe
      ref={iframeRef}
      title={module.name}
      src={`/module-assets/${module.module_id}/index.html`}
      sandbox="allow-scripts"
      style={{
        width: "100%",
        height: "calc(100vh - 200px)",
        minHeight: "420px",
        border: `1px solid ${palette.border}`,
        borderRadius: "16px",
        background: "#fff",
        boxShadow: `0 12px 30px ${palette.glow}`,
      }}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-center pt-6">{children}</div>;
}

function Badge({ children, palette }: { children: React.ReactNode; palette: ThemePalette }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5"
      style={{ background: palette.cardAlt, border: `1px solid ${palette.border}`, color: palette.primaryDark, fontSize: "11px", fontWeight: 800 }}
    >
      {children}
    </span>
  );
}

function CardBox({ children, palette }: { children: React.ReactNode; palette: ThemePalette }) {
  return (
    <Reveal
      immediate
      className="w-full max-w-md rounded-2xl border p-8 text-center"
      style={{ background: "rgba(255,255,255,0.95)", borderColor: palette.border, boxShadow: `0 16px 40px ${palette.glow}` }}
    >
      {children}
    </Reveal>
  );
}

function ComingSoon({ palette }: { palette: ThemePalette }) {
  return (
    <CardBox palette={palette}>
      <Clock size={44} style={{ color: palette.secondary, margin: "0 auto 12px" }} />
      <div style={{ fontSize: "22px", fontWeight: 900, color: palette.ink }}>即将上线</div>
      <div style={{ fontSize: "14px", color: palette.muted, fontWeight: 600, marginTop: "10px", lineHeight: 1.7 }}>
        这个功能正在开发中，做好后会出现在这里，敬请期待 ✨
      </div>
    </CardBox>
  );
}

function NeedLogin({ palette, onOpenAuth }: { palette: ThemePalette; onOpenAuth: () => void }) {
  return (
    <CardBox palette={palette}>
      <Lock size={40} style={{ color: palette.primary, margin: "0 auto 12px" }} />
      <div style={{ fontSize: "20px", fontWeight: 900, color: palette.ink }}>该模块需要登录</div>
      <div style={{ fontSize: "14px", color: palette.muted, fontWeight: 600, margin: "10px 0 18px", lineHeight: 1.7 }}>
        登录后即可进入并使用。
      </div>
      <button
        onClick={onOpenAuth}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
        style={{ background: palette.activeGradient, color: "#fff", fontSize: "15px", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
      >
        <LogIn size={16} /> 登录 / 注册
      </button>
    </CardBox>
  );
}
