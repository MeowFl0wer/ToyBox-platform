import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { AuthModal } from "./components/AuthModal";
import { HomePage } from "./components/HomePage";
import { FeatureHall } from "./components/FeatureHall";
import { SettingsPage } from "./components/SettingsPage";
import { AboutPage } from "./components/AboutPage";
import { fireConfetti } from "./components/anim";
import { defaultPalette, themePalettes } from "./theme";

type Page = "home" | "features" | "settings" | "about";

interface User {
  name: string;
  email: string;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | undefined>(undefined);
  const [authOpen, setAuthOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePaletteId, setActivePaletteId] = useState(defaultPalette.id);

  const palette = themePalettes.find((item) => item.id === activePaletteId) ?? defaultPalette;

  // Apply dark mode
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const handleLogin = (u: User) => {
    setIsLoggedIn(true);
    setUser(u);
    fireConfetti(palette);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(undefined);
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
    setMobileMenuOpen(false);
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}
    >
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col flex-shrink-0" style={{ height: "100vh" }}>
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isLoggedIn={isLoggedIn}
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
          <div
            className="absolute left-0 top-0 h-full"
            style={{ width: "260px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              currentPage={currentPage}
              onNavigate={handleNavigate}
              isLoggedIn={isLoggedIn}
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
          style={{
            background: "#fff",
            borderBottom: `1px solid ${palette.border}`,
            boxShadow: `0 2px 8px ${palette.glow}`,
          }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink }}
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: palette.activeGradient }}
            >
              <span style={{ fontSize: "14px" }}>⚡</span>
            </div>
            <span style={{ fontSize: "17px", fontWeight: 900, color: palette.ink }}>ToyBox</span>
          </div>
          <button
            onClick={() => setAuthOpen(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.primaryDark, fontSize: "13px", fontWeight: 700, fontFamily: "'Nunito', sans-serif" }}
          >
            {isLoggedIn ? (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ background: palette.activeGradient }}
              >
                {user?.name.charAt(0) ?? "U"}
              </div>
            ) : "登录"}
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {currentPage === "home" && (
            <HomePage
              onNavigate={handleNavigate}
              palette={palette}
              activePaletteId={activePaletteId}
              onPaletteChange={setActivePaletteId}
            />
          )}
          {currentPage === "features" && (
            <FeatureHall palette={palette} />
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
          {currentPage === "about" && (
            <AboutPage palette={palette} />
          )}
        </div>

        {/* Mobile bottom nav */}
        <div
          className="flex md:hidden items-center justify-around py-2 flex-shrink-0"
          style={{
            background: "#fff",
            borderTop: `1px solid ${palette.border}`,
            boxShadow: `0 -2px 12px ${palette.glow}`,
          }}
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
                style={{
                  background: active ? palette.soft : "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                <span style={{ fontSize: "20px" }}>{item.emoji}</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: active ? 800 : 500,
                    color: active ? palette.primaryDark : palette.muted,
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onLogin={handleLogin} />
    </div>
  );
}
