# 🧰 ToyBox · 个人工具盒

> 一个可以慢慢加功能的小盒子 —— 收纳工具、游戏、灵感实验和生活记录的个人空间。

ToyBox 是一个日系 q 版风格的个人主页 / 工具站模板：清爽的首页、功能大厅、设置与关于页，配上手绘风的可爱插画、可切换的配色主题、流动背景与细腻的入场动画。可直接作为个人站点或后台框架的起点。

## ✨ 特性

- 🎨 **3 套配色主题**，一键切换（蓝绿 / 暖黄 / 暖绿），全站颜色由调色板驱动
- 🐱 **原创日系 q 版插画**（猫、云、星星、史莱姆、水晶、精灵等），纯 SVG、跟随主题变色
- 🌊 **流动渐变背景** + ✨ **入场 / 滚动渐显动画** + 🎈 **插画漂浮**
- 🎉 **撒花彩蛋**（登录、保存设置、点 Logo 触发）
- 📱 **响应式布局**，桌面侧边栏 / 移动端底部导航
- 🌙 浅色 / 深色模式开关
- ♿ 全部动效适配 `prefers-reduced-motion`（系统开启「减少动态」时自动降级）

## 🧱 技术栈

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) 构建
- [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) / [shadcn/ui](https://ui.shadcn.com/)
- [Motion](https://motion.dev/)（Framer Motion）动画
- [canvas-confetti](https://github.com/catdad/canvas-confetti) 撒花
- [lucide-react](https://lucide.dev/) 图标

## 🚀 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器（默认 http://localhost:5173）
npm run build    # 生产构建，产物在 dist/
```

## 📁 目录结构

```
src/
├─ main.tsx                  # 入口
├─ app/
│  ├─ App.tsx                # 根组件、页面切换（状态驱动）
│  ├─ theme.ts               # 配色主题定义
│  └─ components/
│     ├─ Sidebar.tsx         # 侧边导航
│     ├─ HomePage.tsx        # 首页
│     ├─ FeatureHall.tsx     # 功能大厅
│     ├─ SettingsPage.tsx    # 设置
│     ├─ AboutPage.tsx       # 关于（版本 / 免责声明 / 反馈）
│     ├─ AuthModal.tsx       # 登录注册弹窗
│     ├─ chibi.tsx           # q 版插画（SVG）
│     ├─ DoodleLayer.tsx     # 插画布局层（位置 / 浮动 / 入场）
│     ├─ anim.tsx            # 动效助手（Reveal / CountUp / 撒花）
│     └─ ui/                 # shadcn/ui 组件
└─ styles/                   # 全局样式与流动背景动画
```

## 🎨 自定义

| 想改什么 | 改哪里 |
| --- | --- |
| 配色主题 | [`src/app/theme.ts`](src/app/theme.ts) 的 `themePalettes` |
| 首页插画的位置 / 大小 / 浮动 | [`HomePage.tsx`](src/app/components/HomePage.tsx) 的 `HOME_DOODLES`（关于页见 `ABOUT_DOODLES`） |
| 新增 / 修改插画造型 | [`src/app/components/chibi.tsx`](src/app/components/chibi.tsx) |
| 反馈邮箱 / 仓库地址 | [`AboutPage.tsx`](src/app/components/AboutPage.tsx) 顶部的 `FEEDBACK_EMAIL` / `GITHUB_URL` |
| 动画快慢 / 幅度 | [`anim.tsx`](src/app/components/anim.tsx)、`DoodleLayer.tsx`，以及 `src/styles/index.css` 里的 `.bg-flow` |

> 插画配置说明：`{ id, type, xPct, yPct, w, opacity, rotate?, float? }`。坐标为容器百分比（响应式下相对位置不变）；`float: true` 即让该插画持续上下漂浮。

## 🗂️ 关于 `.backup-before-animation/`

加入动画前的源码快照备份，方便对照与回滚：

```bash
rm -rf src && mv .backup-before-animation/src src
```

## 🙏 致谢

- 组件基于 [shadcn/ui](https://ui.shadcn.com/)（MIT）
- 详见 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)
- 插画为原创设计，借鉴了奇幻冒险题材的轻盈气质，不含任何具体 IP 角色

---

用 ❤️ 慢慢搭建。
