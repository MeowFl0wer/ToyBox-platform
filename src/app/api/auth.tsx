import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken, type ApiUser } from "./client";

interface AuthContextValue {
  user: ApiUser | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  loading: boolean;
  setUser: (u: ApiUser | null) => void;
  applyAuth: (data: { access_token: string; user: ApiUser }) => void;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null!);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 页面加载时尝试用 HttpOnly 刷新 Cookie 恢复登录态
  useEffect(() => {
    (async () => {
      if (await api.refresh()) {
        try {
          setUser(await api.me());
        } catch {
          /* ignore */
        }
      }
      setLoading(false);
    })();
  }, []);

  const applyAuth = (data: { access_token: string; user: ApiUser }) => {
    setToken(data.access_token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  };

  const refreshMe = async () => {
    try {
      setUser(await api.me());
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAdmin: user?.role === "admin",
        loading,
        setUser,
        applyAuth,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
