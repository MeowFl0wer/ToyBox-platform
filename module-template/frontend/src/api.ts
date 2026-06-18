// 模块前端在 sandbox(allow-scripts) 的不透明源中运行，不能直接联网/带 Cookie。
// 所有请求通过 postMessage 交给主站宿主代发，模块开发者只管调用下面封装好的方法：
//   call()/getGreeting() —— 后端模块（container/lazy_container）的业务接口（经网关）
//   storage.*            —— 平台托管存储（platform_storage 模块，无需自带后端/数据库）
//   getCurrentUser()     —— 当前登录用户的展示信息（只读，不能作为业务权限依据）

export interface ApiResp<T> {
  code: number;
  message: string;
  data: T;
}

let _seq = 0;
const _pending = new Map<string, (body: any) => void>();

// 宿主对各类请求统一回 {source:"pt-host", type:"*_result", reqId, body}；按 reqId 兑现即可
window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data;
  if (!msg || msg.source !== "pt-host" || typeof msg.reqId !== "string") return;
  const resolve = _pending.get(msg.reqId);
  if (resolve) {
    _pending.delete(msg.reqId);
    resolve(msg.body);
  }
});

function _rpc<T = any>(type: string, extra: Record<string, unknown>, timeoutMs = 15000): Promise<ApiResp<T>> {
  const reqId = `r${++_seq}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pending.delete(reqId);
      reject(new Error("请求超时"));
    }, timeoutMs);
    _pending.set(reqId, (b) => {
      clearTimeout(timer);
      resolve(b as ApiResp<T>);
    });
    parent?.postMessage({ source: "pt-module", type, reqId, ...extra }, "*");
  });
}

/** 调用本模块后端接口（相对路径，如 "/greeting"）。返回主站统一响应体。 */
export function call<T = any>(method: string, path: string, body?: unknown, timeoutMs = 15000): Promise<ApiResp<T>> {
  return _rpc<T>("api", { method, path, body }, timeoutMs);
}

export async function getGreeting(): Promise<string> {
  const r = await call<{ greeting: string }>("GET", "/greeting");
  if (r.code !== 0) throw new Error(r.message || "请求失败");
  return r.data.greeting;
}

/** 平台托管存储：按 (当前用户, 本模块, key) 隔离地存少量 JSON 数据，无需模块自带后端。
 *  仅 module.yaml 里 runtime.mode=platform_storage 的模块可用。 */
export const storage = {
  async get<T = unknown>(key: string, fallback?: T): Promise<T> {
    const r = await _rpc<T>("storage", { op: "get", key, fallback });
    if (r.code !== 0) throw new Error(r.message || "读取失败");
    return (r.data ?? (fallback as T)) as T;
  },
  async set(key: string, value: unknown): Promise<void> {
    const r = await _rpc("storage", { op: "set", key, value });
    if (r.code !== 0) throw new Error(r.message || "保存失败");
  },
  async remove(key: string): Promise<void> {
    const r = await _rpc("storage", { op: "remove", key });
    if (r.code !== 0) throw new Error(r.message || "删除失败");
  },
  async list(prefix = ""): Promise<{ key: string; value: unknown; updated_at: string }[]> {
    const r = await _rpc<{ key: string; value: unknown; updated_at: string }[]>("storage", { op: "list", prefix });
    if (r.code !== 0) throw new Error(r.message || "列举失败");
    return r.data || [];
  },
};

export interface CurrentUser {
  uid: number;
  uid_display: string;
  username: string;
  nickname: string;
  display_name: string;
  avatar_url: string;
  roles: string[];
}

/** 当前登录用户的展示信息（只读）。注意：不要据此做业务权限判断，权限应由后端签名上下文决定。 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const r = await _rpc<CurrentUser>("profile", {});
  if (r.code !== 0) throw new Error(r.message || "获取用户信息失败");
  return r.data;
}

export interface UserHit {
  uid: number;
  uid_display: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

/** 按用户名/昵称/UID 搜索用户（最小公开资料），供模块「定向分享」选人。
 *  模块拿不到全站用户目录，由宿主用当前登录态代调主站只读接口；返回不含邮箱等敏感字段。 */
export async function searchUsers(q: string): Promise<UserHit[]> {
  const r = await _rpc<UserHit[]>("user_search", { q });
  if (r.code !== 0) throw new Error(r.message || "搜索失败");
  return r.data || [];
}
