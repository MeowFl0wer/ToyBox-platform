import { useState } from "react";
import {
  Home,
  LayoutGrid,
  Settings,
  Info,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogIn,
  Shield,
  Zap,
} from "lucide-react";
import type { ThemePalette } from "../theme";
import type { ApiUser } from "../api/client";
import { fireConfetti } from "./anim";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isLoggedIn: boolean;
  isAdmin?: boolean;
  onOpenAuth: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  user?: ApiUser | null;
  palette: ThemePalette;
}

const baseNavItems = [
  { id: "home", label: "首页", icon: Home },
  { id: "features", label: "功能大厅", icon: LayoutGrid },
  { id: "settings", label: "设置", icon: Settings },
  { id: "about", label: "关于", icon: Info },
];

export function Sidebar({
  currentPage,
  onNavigate,
  isLoggedIn,
  isAdmin,
  onOpenAuth,
  collapsed,
  onToggleCollapse,
  user,
  palette,
}: SidebarProps) {
  const navItems = isAdmin ? [...baseNavItems, { id: "admin", label: "后台管理", icon: Shield }] : baseNavItems;
  const displayName = user?.nickname || user?.username || "ToyBox 用户";
  return (
    <aside
      className="relative flex flex-col h-full transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? "72px" : "240px",
        background: "#FFFFFF",
        borderRight: `1px solid ${palette.border}`,
        boxShadow: `2px 0 16px ${palette.glow}`,
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
        style={{
          background: palette.primary,
          color: "#fff",
          boxShadow: `0 2px 8px ${palette.glow}`,
          border: "2px solid #fff",
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: `1px solid ${palette.border}` }}
      >
        <button
          onClick={() => fireConfetti(palette)}
          title="点我有惊喜 🎉"
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{ background: palette.activeGradient, border: "none", cursor: "pointer" }}
        >
          <Zap size={18} color="#fff" fill="#fff" />
        </button>
        {!collapsed && (
          <div className="overflow-hidden">
            <div
              className="whitespace-nowrap"
              style={{ fontSize: "18px", fontWeight: 800, color: palette.ink, lineHeight: 1.2 }}
            >
              ToyBox
            </div>
            <div style={{ fontSize: "11px", color: palette.muted, fontWeight: 500 }}>Personal Toolbox</div>
          </div>
        )}
      </div>

      {/* User zone */}
      <div className="px-3 py-3" style={{ borderBottom: `1px solid ${palette.border}` }}>
        {isLoggedIn && user ? (
          <button
            onClick={() => onNavigate("settings")}
            className={`w-full flex items-center gap-3 rounded-xl px-2 py-2 transition-all hover:opacity-90 ${collapsed ? "justify-center" : ""}`}
            style={{ background: palette.soft, border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
            title="个人设置"
          >
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden"
              style={{ background: palette.activeGradient }}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            {!collapsed && (
              <div className="overflow-hidden text-left">
                <div className="truncate" style={{ fontSize: "14px", fontWeight: 700, color: palette.ink }}>
                  {displayName}
                </div>
                <div className="truncate" style={{ fontSize: "11px", color: palette.muted, fontWeight: 600 }}>
                  ID {user.uid_display}
                  {isAdmin ? " · 管理员" : ""}
                </div>
              </div>
            )}
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2 px-3 transition-all hover:opacity-90 active:scale-95"
            style={{
              background: palette.activeGradient,
              color: "#fff",
              fontSize: "14px",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
            }}
          >
            <LogIn size={15} />
            {!collapsed && <span>登录 / 注册</span>}
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-1">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 w-full text-left ${
                collapsed ? "justify-center" : ""
              }`}
              style={{
                background: active ? palette.activeGradient : "transparent",
                color: active ? "#fff" : palette.ink,
                fontSize: "14px",
                fontWeight: active ? 700 : 500,
                border: "none",
                cursor: "pointer",
              }}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom coming soon */}
      {!collapsed && (
        <div className="px-4 py-4" style={{ borderTop: `1px solid ${palette.border}` }}>
          <div
            className="rounded-xl px-3 py-3 text-center"
            style={{ background: palette.soft }}
          >
            <Sparkles size={16} style={{ color: palette.primary, margin: "0 auto 4px" }} />
            <div style={{ fontSize: "12px", color: palette.muted, fontWeight: 600, lineHeight: 1.4 }}>
              更多功能即将加入
            </div>
            <div style={{ fontSize: "11px", color: palette.primaryDark, fontWeight: 800 }}>Coming soon ✨</div>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="px-3 pb-4 flex justify-center">
          <Sparkles size={18} style={{ color: palette.secondary }} />
        </div>
      )}
    </aside>
  );
}
