// 前端 API 客户端：统一处理 {code,message,data}、Bearer access token（内存）、401 自动刷新。
// access token 只放内存（不落 localStorage）；refresh token 由后端 HttpOnly Cookie 维护。

export interface ApiUser {
  id: string;
  uid: number;
  uid_display: string; // 000001
  username: string;
  nickname: string;
  email: string;
  avatar_url: string;
  bio: string;
  role: string; // user | admin
  status: string;
  created_at?: string | null;
}

export interface ApiModule {
  module_id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  auth_required: boolean;
  status: string; // active | coming_soon
  builtin: boolean;
  hidden: boolean;
  sort_order: number;
  favorite: boolean;
  pinned: boolean;
  last_used_at: string | null;
  use_count: number;
}

let accessToken: string | null = null;
export const setToken = (t: string | null) => {
  accessToken = t;
};

export class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    const json = await res.json();
    if (res.ok && json.code === 0) {
      accessToken = json.data.access_token;
      return true;
    }
  } catch {
    /* ignore */
  }
  accessToken = null;
  return false;
}

async function request<T = any>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(path, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    /* 空响应 */
  }
  // access 过期：自动刷新一次再重试（排除 auth 自身接口）
  if (json && json.code === 10001 && retry && !path.startsWith("/api/auth/refresh") && !path.startsWith("/api/auth/login")) {
    if (await tryRefresh()) return request<T>(method, path, body, false);
  }
  if (!res.ok || (json && json.code !== 0)) {
    throw new ApiError(json?.code ?? res.status, json?.message ?? `请求失败 (${res.status})`);
  }
  return json.data as T;
}

export const api = {
  // ---- auth ----
  sendCode: (email: string) => request("POST", "/api/auth/register/send-code", { email }),
  register: (b: { email: string; code: string; username: string; password: string; nickname?: string }) =>
    request<{ access_token: string; user: ApiUser }>("POST", "/api/auth/register", b),
  login: (account: string, password: string, remember = false, code?: string) =>
    request<{ access_token: string; user: ApiUser }>("POST", "/api/auth/login", { account, password, remember, code }),
  loginSendCode: (account: string) => request<{ dev_code?: string }>("POST", "/api/auth/login/send-code", { account }),
  logout: () => request("POST", "/api/auth/logout", {}),
  me: () => request<ApiUser>("GET", "/api/auth/me"),
  refresh: tryRefresh,
  updateProfile: (b: { nickname?: string; bio?: string; avatar_url?: string }) =>
    request<ApiUser>("PUT", "/api/auth/profile", b),

  // 找回密码（未登录）
  forgotPassword: (email: string) => request<{ dev_code?: string }>("POST", "/api/auth/password/forgot", { email }),
  resetPassword: (email: string, code: string, new_password: string) =>
    request("POST", "/api/auth/password/reset", { email, code, new_password }),

  // 修改邮箱（已登录，验证码发往新邮箱）
  emailSendCode: (new_email: string) => request<{ dev_code?: string }>("POST", "/api/auth/email/send-code", { new_email }),
  changeEmail: (new_email: string, code: string, password: string) =>
    request<ApiUser>("PUT", "/api/auth/email", { new_email, code, password }),

  // 修改密码（已登录，旧密码 + 邮箱验证码）
  passwordSendCode: () => request<{ dev_code?: string }>("POST", "/api/auth/password/send-code", {}),
  changePassword: (old_password: string, code: string, new_password: string) =>
    request("PUT", "/api/auth/password", { old_password, code, new_password }),

  // ---- core ----
  getModules: () => request<ApiModule[]>("GET", "/api/core/modules"),
  moduleToken: (id: string) => request<{ token: string; expires_in: number }>("POST", `/api/core/modules/${id}/token`, {}),
  favorite: (id: string) => request<ApiModule>("POST", `/api/core/modules/${id}/favorite`, {}),
  unfavorite: (id: string) => request<ApiModule>("DELETE", `/api/core/modules/${id}/favorite`),
  siteContents: (keys: string) => request<Record<string, any>>("GET", `/api/core/site-contents?keys=${encodeURIComponent(keys)}`),
  // 访问上报（遥测，失败静默）
  reportPageView: (path: string, module_id = "") =>
    request("POST", "/api/core/analytics/page-view", { path, module_id }).catch(() => null),

  // ---- admin ----
  adminDashboard: () => request("GET", "/api/admin/dashboard"),
  adminModules: () => request<ApiModule[]>("GET", "/api/admin/modules"),
  adminPublishComingSoon: (b: { module_id: string; name: string; description?: string; category?: string; icon?: string }) =>
    request<ApiModule>("POST", "/api/admin/modules", b),
  adminUpdateModule: (id: string, b: { name?: string; description?: string; category?: string; status?: string }) =>
    request<ApiModule>("PUT", `/api/admin/modules/${id}`, b),
  adminHide: (id: string) => request<ApiModule>("POST", `/api/admin/modules/${id}/hide`, {}),
  adminUnhide: (id: string) => request<ApiModule>("POST", `/api/admin/modules/${id}/unhide`, {}),
  adminUninstall: (id: string) => request("DELETE", `/api/admin/modules/${id}`),
  adminInstall: (repo_url: string, ref: string) => request<{ job_id: string }>("POST", "/api/admin/modules/install", { repo_url, ref }),
  adminInstallJob: (jobId: string) =>
    request<{ id: string; module_id: string; status: string; logs: string; error_message: string }>(
      "GET",
      `/api/admin/modules/install-jobs/${jobId}`,
    ),
  adminRestart: (id: string) => request<{ job_id: string }>("POST", `/api/admin/modules/${id}/restart`, {}),
  adminModuleLogs: (id: string) => request<{ logs: string }>("GET", `/api/admin/modules/${id}/logs`),
  adminSystemStatus: () => request<any>("GET", "/api/admin/system/status"),
  adminAnalyticsOverview: () => request<any>("GET", "/api/admin/analytics/overview"),
  adminAnalyticsPaths: () => request<{ path: string; count: number }[]>("GET", "/api/admin/analytics/paths"),
  adminAnalyticsModules: () => request<{ module_id: string; count: number }[]>("GET", "/api/admin/analytics/modules"),
  adminUsers: () => request<ApiUser[]>("GET", "/api/admin/users"),
  adminDisableUser: (id: string) => request<ApiUser>("POST", `/api/admin/users/${id}/disable`, {}),
  adminEnableUser: (id: string) => request<ApiUser>("POST", `/api/admin/users/${id}/enable`, {}),
  adminContents: () => request<any[]>("GET", "/api/admin/site-contents"),
  adminUpsertContent: (key: string, b: { title?: string; content_type: string; content_value: any; status?: string }) =>
    request("PUT", `/api/admin/site-contents/${encodeURIComponent(key)}`, b),
};
