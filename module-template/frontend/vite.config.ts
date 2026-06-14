import { defineConfig, type Plugin } from "vite";

// 模块前端在主站 sandbox="allow-scripts"（不透明源 = "null"）的 iframe 中加载。
// Vite 默认给入口 <script>/<link> 加 crossorigin，会让脚本以 CORS（Origin: null）方式请求，
// 静态服务没有 Access-Control-Allow-Origin → 脚本被浏览器拦截 → 页面空白。
// 这里在生成 HTML 时去掉 crossorigin，改为同 URL no-cors 加载即可正常执行。
function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(=("[^"]*"|'[^']*'|\S+))?/g, "");
    },
  };
}

export default defineConfig({
  // 相对路径打包：产物会被主站挂在 /module-assets/{module_id}/current/ 下
  base: "./",
  plugins: [stripCrossorigin()],
  build: { outDir: "dist", emptyOutDir: true },
});
