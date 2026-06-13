// 模块前端在 iframe 中与主站同源；业务接口走主站网关：
//   /api/modules/{module_id}/{path}  ->  主站转发到模块后端 /{path}
// 本地独立开发时可用 VITE_API_BASE 指向模块后端（如 http://127.0.0.1:8001）。
const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "/api/modules/welcome";

export interface ApiResp<T> {
  code: number;
  message: string;
  data: T;
}

export async function getGreeting(): Promise<string> {
  const res = await fetch(`${API_BASE}/greeting`, { credentials: "include" });
  const json: ApiResp<{ greeting: string }> = await res.json();
  if (json.code !== 0) throw new Error(json.message || "请求失败");
  return json.data.greeting;
}
