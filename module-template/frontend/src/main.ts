import { getGreeting } from "./api";

const app = document.getElementById("app")!;

function render(inner: string) {
  app.innerHTML = `
    <div style="font-family:system-ui,'PingFang SC',sans-serif;min-height:100vh;display:flex;
      align-items:center;justify-content:center;background:linear-gradient(135deg,#F5FCFF,#EFFFFB);padding:24px">
      <div style="background:#fff;border:1px solid rgba(56,189,248,0.28);border-radius:20px;
        box-shadow:0 16px 40px rgba(56,189,248,0.18);padding:40px;max-width:420px;text-align:center">
        ${inner}
      </div>
    </div>`;
}

// 通知主站模块已就绪（架构文档 6.6 postMessage 约定）
function notifyReady() {
  parent?.postMessage({ type: "module_ready", module_id: "welcome", payload: {} }, "*");
}

render(`<div style="font-size:40px">⏳</div><div style="color:#5E6B7A;font-weight:700;margin-top:8px">加载中…</div>`);

getGreeting()
  .then((greeting) => {
    render(`
      <div style="font-size:56px;margin-bottom:8px">🎉</div>
      <div style="font-size:28px;font-weight:800;color:#172033">${greeting}</div>
      <div style="font-size:14px;color:#5E6B7A;margin-top:12px;line-height:1.7">
        这是一个需要登录的示例模块，从主站获取当前用户身份并问好 👋
      </div>`);
    notifyReady();
  })
  .catch((e) => {
    render(`
      <div style="font-size:44px;margin-bottom:8px">🔒</div>
      <div style="font-size:18px;font-weight:800;color:#172033">${e.message || "加载失败"}</div>
      <div style="font-size:13px;color:#5E6B7A;margin-top:10px">请通过主站登录后进入本模块</div>`);
    parent?.postMessage({ type: "module_error", module_id: "welcome", payload: { message: String(e?.message ?? e) } }, "*");
  });
