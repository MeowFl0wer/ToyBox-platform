# ToyBox 主站后端

FastAPI + SQLAlchemy + SQLite，实现架构文档中的「主站平台」务实可用子集：
统一登录注册（邮箱验证码）、用户体系、工具大厅模块注册表与收藏、内置「欢迎模块」、
后台管理（模块隐藏/卸载、即将上线发布、内容编辑、用户管理、审计日志）。

## 运行

```bash
cd server
bash run.sh          # 首次会自动建 venv 并装依赖，然后启动
# 或手动：
# python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# .venv/bin/uvicorn app.main:app --reload --port 8000
```

启动后：

- 健康检查：http://127.0.0.1:8000/api/health
- 交互式 API 文档：http://127.0.0.1:8000/api/docs
- 默认管理员：用户名 `admin` / 密码 `Admin@12345`（首次启动自动创建，请尽快修改）

数据与密钥都在 `server/data/`（已 gitignore）。删掉 `server/data/main.db` 即可重置。

## 关键设计

- **uid**：从 1 单调递增，展示为 `000001`；用户被禁用/注销不释放、绝不复用（用 `sequences` 计数器保证）。
- **邮箱验证**：注册、找回密码、修改邮箱、修改密码均需邮箱验证码。开发模式下验证码在接口返回字段 `dev_code` 并打印到控制台；上线设 `TOYBOX_DEV_MODE=false` 并配置 **Resend**（`TOYBOX_RESEND_API_KEY` / `TOYBOX_MAIL_FROM`）即可真正发信。
- **安全加固**：bcrypt 密码哈希、JWT 短期 access + HttpOnly Cookie 刷新令牌（轮换）、登录/注册/验证码限流、
  Pydantic 强校验 + 文本清洗、富文本/Markdown 用 bleach 白名单防 XSS、ORM 参数化查询防注入、安全响应头、CORS 白名单、管理操作审计。
- **统一响应**：`{ "code", "message", "data" }`，错误码见架构文档 14.5。

## 模块安装 / 部署

后台「模块部署」填 GitHub 仓库地址 → `clone` → 读 `module.yaml` 校验 → 构建前端（挂 `/module-assets`）
→ 部署后端 → `/health` 健康检查 → 注册上线。前端经 iframe 承载，业务 API 走网关
`/api/modules/{id}/*`（鉴权 + HMAC 签名用户上下文转发，与模块模板一致）。

部署方式可插拔（`TOYBOX_DEPLOY_MODE`）：

- **local（默认，开发）**：模块独立 venv + uvicorn 子进程；模块库用 SQLite。无需 Docker，本机可跑。
  用 pidfile 记录子进程，主站重启时先清理上一批进程，避免端口泄漏。
- **docker（生产）**：`docker build` 镜像 → 在 Postgres 实例建模块独立 `database`/`user` →（如需）容器内
  `alembic upgrade head` → `docker run` 加入内部网络 `TOYBOX_DOCKER_NETWORK`（不暴露公网端口）→ 健康检查。
  需主站后端容器与模块容器同处该网络；建库通过 `docker exec <TOYBOX_POSTGRES_CONTAINER> psql` 执行。
  数据库命名遵循架构文档 9.1：`module_<id>_db` / `module_<id>_user`（`-` 转 `_`）。

## 主要接口

```
POST /api/auth/register/send-code   发送邮箱验证码（开发模式直接返回）
POST /api/auth/register             校验验证码并注册
POST /api/auth/login                登录（设置刷新 Cookie，返回 access_token）
POST /api/auth/refresh              用 Cookie 刷新 access_token
POST /api/auth/logout               退出
GET  /api/auth/me                   当前用户
PUT  /api/auth/profile              改昵称/简介/头像
POST /api/auth/password/forgot      找回密码：发送重置验证码（未登录）
POST /api/auth/password/reset       用验证码重置密码（未登录）
POST /api/auth/email/send-code      修改邮箱：发送验证码到新邮箱（已登录）
PUT  /api/auth/email                验证码 + 密码 确认更换邮箱（已登录）
POST /api/auth/password/send-code   修改密码：发送验证码到当前邮箱（已登录）
PUT  /api/auth/password             旧密码 + 验证码 修改密码（已登录）

GET  /api/core/modules              工具大厅模块列表（按注册表，含收藏标记）
POST /api/core/modules/{id}/favorite  / DELETE  收藏 / 取消收藏
GET  /api/core/modules/welcome/greeting  欢迎模块：返回「欢迎 xxx！！」
GET  /api/core/site-contents?keys=...    站点内容渲染

GET  /api/admin/dashboard           概览
GET  /api/admin/modules             全部模块
POST /api/admin/modules             发布「即将上线」入口
PUT  /api/admin/modules/{id}        编辑模块
POST /api/admin/modules/{id}/hide | /unhide   隐藏 / 取消隐藏
DELETE /api/admin/modules/{id}      卸载（内置模块不可卸载）
GET  /api/admin/users               用户列表
POST /api/admin/users/{id}/disable | /enable
GET/PUT /api/admin/site-contents[/{key}]   内容编辑
```
