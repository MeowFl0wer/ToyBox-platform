import { ArrowLeft, Clock, Lock, LogIn } from "lucide-react";
import type { ThemePalette } from "../theme";
import type { ApiModule } from "../api/client";
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
      {/* ModuleHeader：图标 / 名称 / 简介 / 状态 / 登录要求 */}
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

      {/* ModuleFrameContainer：iframe 承载模块前端（业务 API 经主站网关 /api/modules/{id}/* 转发） */}
      <div className="flex-1 px-6 md:px-10 py-6 min-h-0">
        {comingSoon ? (
          <Centered><ComingSoon palette={palette} /></Centered>
        ) : needLogin ? (
          <Centered><NeedLogin palette={palette} onOpenAuth={onOpenAuth} /></Centered>
        ) : (
          <iframe
            title={module.name}
            src={`/module-assets/${module.module_id}/index.html`}
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
        )}
      </div>
    </div>
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
