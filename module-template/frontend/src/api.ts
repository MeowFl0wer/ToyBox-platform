// 模块前端在 sandbox(allow-scripts) 的不透明源中运行，不能直接联网/带 Cookie。
// 业务请求通过 postMessage 交给主站宿主代发（宿主用模块级 token 调网关 /api/modules/{id}/*）。
// 模块开发者只管调用下面的 call()/getGreeting()，无需关心鉴权与转发细节。

export interface ApiResp<T> {
  code: number;
  message: string;
  data: T;
}

let _seq = 0;
const _pending = new Map<string, (body: any) => void>();

window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data;
  if (!msg || msg.source !== "pt-host" || msg.type !== "api_result") return;
  const resolve = _pending.get(msg.reqId);
  if (resolve) {
    _pending.delete(msg.reqId);
    resolve(msg.body);
  }
});

/** 调用本模块后端接口（相对路径，如 "/greeting"）。返回主站统一响应体。 */
export function call<T = any>(method: string, path: string, body?: unknown, timeoutMs = 15000): Promise<ApiResp<T>> {
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
    parent?.postMessage({ source: "pt-module", type: "api", reqId, method, path, body }, "*");
  });
}

export async function getGreeting(): Promise<string> {
  const r = await call<{ greeting: string }>("GET", "/greeting");
  if (r.code !== 0) throw new Error(r.message || "请求失败");
  return r.data.greeting;
}
