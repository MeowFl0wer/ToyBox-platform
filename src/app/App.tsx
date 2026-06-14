import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { AuthModal } from "./components/AuthModal";
import { HomePage } from "./components/HomePage";
import { FeatureHall } from "./components/FeatureHall";
import { SettingsPage } from "./components/SettingsPage";
import { AboutPage } from "./components/AboutPage";
import { ModuleHostPage } from "./components/ModuleHostPage";
import { AdminPage } from "./components/AdminPage";
import { fireConfetti } from "./components/anim";
import { useAuth } from "./api/auth";
import { api, type ApiModule } from "./api/client";
import { defaultPalette, resolvePalette, themePalettes } from "./theme";

type Page = "home" | "features" | "settings" | "about" | "module" | "admin";

export default function App() {
  const { user, isLoggedIn, isAdmin, logout, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [activeModule, setActiveModule] = useState<ApiModule | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePaletteId, setActivePaletteId] = useState(defaultPalette.id);

  const basePalette = themePalettes.find((item) => item.id === activePaletteId) ?? defaultPalette;
  const palette = resolvePalette(basePalette, isDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // 首次进入上报访问
  useEffect(() => {
    api.reportPageView("/home");
  }, []);

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
    setMobileMenuOpen(false);
    api.reportPageView("/" + page);
  };

  const openModule = (m: ApiModule) => {
    setActiveModule(m);
    setCurrentPage("module");
    setMobileMenuOpen(false);
    api.reportPageView(`/tools/${m.module_id}`, m.module_id);
  };

  const onAuthed = () => {
    fireConfetti(palette);
    setAuthOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setCurrentPage("home");
  };

  const displayInitial = (user?.nickname || user?.username || "U").charAt(0).toUpperCase();

  // 刷新时先用 HttpOnly Cookie 静默恢复登录态，恢复期间显示极简启动屏：
  // 既不闪一下「未登录」，也绝不弹出任何登录窗口（满足「刷新仍登录、不弹窗」）。
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: palette.activeGradient }}>
            <span style={{ fontSize: "22px" }}>⚡</span>
          </div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: palette.muted }}>ToyBox 加载中…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col flex-shrink-0" style={{ height: "100vh" }}>
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isLoggedIn={isLoggedIn}
          isAdmin={isAdmin}
          onOpenAuth={() => setAuthOpen(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          user={user}
          palette={palette}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(45,31,24,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="absolute left-0 top-0 h-full" style={{ width: "260px" }} onClick={(e) => e.stopPropagation()}>
            <Sidebar
              currentPage={currentPage}
              onNavigate={handleNavigate}
              isLoggedIn={isLoggedIn}
              isAdmin={isAdmin}
              onOpenAuth={() => { setAuthOpen(true); setMobileMenuOpen(false); }}
              collapsed={false}
              onToggleCollapse={() => setMobileMenuOpen(false)}
              user={user}
              palette={palette}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div
          className="flex md:hidden items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: palette.surface, borderBottom: `1px solid ${palette.border}`, boxShadow: `0 2px 8px ${palette.glow}` }}
        >
          <button onClick={() => setMobileMenuOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink }}>
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: palette.activeGradient }}>
              <span style={{ fontSize: "14px" }}>⚡</span>
            </div>
            <span style={{ fontSize: "17px", fontWeight: 900, color: palette.ink }}>ToyBox</span>
          </div>
          <button
            onClick={() => (isLoggedIn ? handleNavigate("settings") : setAuthOpen(true))}
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.primaryDark, fontSize: "13px", fontWeight: 700, fontFamily: "'Nunito', sans-serif" }}
          >
            {isLoggedIn ? (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: palette.activeGradient }}>
                {displayInitial}
              </div>
            ) : "登录"}
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {currentPage === "home" && (
            <HomePage
              onNavigate={handleNavigate}
              onOpenModule={openModule}
              isLoggedIn={isLoggedIn}
              onOpenAuth={() => setAuthOpen(true)}
              palette={palette}
              activePaletteId={activePaletteId}
              onPaletteChange={setActivePaletteId}
            />
          )}
          {currentPage === "features" && (
            <FeatureHall palette={palette} isLoggedIn={isLoggedIn} onOpenAuth={() => setAuthOpen(true)} onOpenModule={openModule} />
          )}
          {currentPage === "settings" && (
            <SettingsPage
              isLoggedIn={isLoggedIn}
              onOpenAuth={() => setAuthOpen(true)}
              onLogout={handleLogout}
              isDark={isDark}
              onToggleDark={() => setIsDark(!isDark)}
              user={user}
              palette={palette}
            />
          )}
          {currentPage === "about" && <AboutPage palette={palette} />}
          {currentPage === "module" && activeModule && (
            <ModuleHostPage
              module={activeModule}
              palette={palette}
              isLoggedIn={isLoggedIn}
              onBack={() => setCurrentPage("features")}
              onOpenAuth={() => setAuthOpen(true)}
            />
          )}
          {currentPage === "admin" && isAdmin && <AdminPage palette={palette} onExit={() => setCurrentPage("home")} />}
        </div>

        {/* Mobile bottom nav */}
        <div
          className="flex md:hidden items-center justify-around py-2 flex-shrink-0"
          style={{ background: palette.surface, borderTop: `1px solid ${palette.border}`, boxShadow: `0 -2px 12px ${palette.glow}` }}
        >
          {[
            { id: "home", label: "首页", emoji: "🏠" },
            { id: "features", label: "大厅", emoji: "🎪" },
            { id: "settings", label: "设置", emoji: "⚙️" },
            { id: "about", label: "关于", emoji: "💡" },
          ].map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl transition-all"
                style={{ background: active ? palette.soft : "transparent", border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
              >
                <span style={{ fontSize: "20px" }}>{item.emoji}</span>
                <span style={{ fontSize: "11px", fontWeight: active ? 800 : 500, color: active ? palette.primaryDark : palette.muted }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={onAuthed} palette={palette} />
    </div>
  );
}
