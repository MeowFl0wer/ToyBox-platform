import { getGreeting } from "./api";

const app = document.getElementById("app")!;

// 静态结构里不含任何业务数据；动态文本一律用 textContent 注入，杜绝 XSS。
app.innerHTML = `
  <div style="font-family:system-ui,'PingFang SC',sans-serif;min-height:100vh;display:flex;
    align-items:center;justify-content:center;background:linear-gradient(135deg,#F5FCFF,#EFFFFB);padding:24px">
    <div style="background:#fff;border:1px solid rgba(56,189,248,0.28);border-radius:20px;
      box-shadow:0 16px 40px rgba(56,189,248,0.18);padding:40px;max-width:420px;text-align:center">
      <div id="m-emoji" style="font-size:56px;margin-bottom:8px">⏳</div>
      <div id="m-title" style="font-size:28px;font-weight:800;color:#172033">加载中…</div>
      <div id="m-sub" style="font-size:14px;color:#5E6B7A;margin-top:12px;line-height:1.7"></div>
    </div>
  </div>`;

const emojiEl = document.getElementById("m-emoji")!;
const titleEl = document.getElementById("m-title")!;
const subEl = document.getElementById("m-sub")!;

function notifyReady() {
  parent?.postMessage({ type: "module_ready", module_id: "welcome", payload: {} }, "*");
}

getGreeting()
  .then((greeting) => {
    emojiEl.textContent = "🎉";
    titleEl.textContent = greeting; // textContent：即使昵称含 HTML 也不会执行
    subEl.textContent = "这是一个需要登录的示例模块，从主站获取当前用户身份并问好 👋";
    notifyReady();
  })
  .catch((e) => {
    emojiEl.textContent = "🔒";
    titleEl.textContent = (e && e.message) || "加载失败";
    subEl.textContent = "请通过主站登录后进入本模块";
    parent?.postMessage({ type: "module_error", module_id: "welcome", payload: { message: String(e?.message ?? e) } }, "*");
  });
