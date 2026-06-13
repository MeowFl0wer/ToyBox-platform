import { defineConfig } from "vite";

export default defineConfig({
  // 相对路径打包：产物会被主站挂在 /module-assets/{module_id}/current/ 下
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
});
