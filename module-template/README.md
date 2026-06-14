# ToyBox 功能模块模板 · 欢迎小屋（personal-tool-module-welcome）

这是 ToyBox 主站的**标准功能模块模板**，本身实现了「欢迎小屋」示例模块：
登录后从主站获取当前用户身份，向你问好（`欢迎 xxx！！`）。

**两个用途：**
1. 将来主站实现「GitHub 一键安装/部署」后，用它来**测试整条安装→构建→部署→上线流程**。
2. **开发新模块时复制本模板**，按统一接口契约填业务逻辑，避免接口弄错。

> 模块是独立应用，拥有自己的仓库、前端、后端、（可选）数据库；通过 iframe 承载，
> 业务 API 经主站网关 `/api/modules/{module_id}/*` 转发，并由主站签名用户上下文识别用户。

## 目录结构

```
personal-tool-module-welcome/
├── module.yaml            # 模块清单（主站安装时读取/校验）
├── frontend/              # 模块前端（Vite，构建到 frontend/dist，iframe 承载）
│   ├── index.html
│   └── src/{main.ts, api.ts}
├── backend/               # 模块后端（FastAPI）
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py        # /health、/manifest、挂载业务路由
│       ├── core/{auth.py, response.py}
│       └── api/router.py  # 业务接口（/greeting）
├── scripts/{build_frontend.sh, build_backend.sh, run_dev.sh}
└── README.md
```

## 模块必须实现的统一契约

| 项 | 说明 |
| --- | --- |
| `module.yaml` | 模块清单：id、版本、入口、display、backend、database、auth、权限等 |
| `GET /health` | 健康检查，部署器据此判断模块是否就绪 |
| `GET /manifest` | 返回 `module.yaml` 解析结果 |
| 业务接口 | 经主站网关 `/api/modules/{id}/*` 转发到模块后端 `/* ` |
| 统一响应 | 所有接口返回 `{ "code": 0, "message": "ok", "data": {...} }` |
| 签名用户上下文 | 信任主站签名 Header，**绝不信任前端传来的 user_id** |

## 主站签名用户上下文（关键契约，架构文档 10.2）

主站网关转发请求到模块后端时附带三个请求头：

```
X-PT-Module-Id:      welcome
X-PT-User-Context:   base64url( JSON.stringify(payload, 紧凑, key 排序) )
X-PT-User-Signature: hmac_sha256_hex( MODULE_SIGN_KEY, X-PT-User-Context )
```

`payload` 形如（已登录用户）：

```json
{ "sub": "用户UUID", "uid": 7, "uid_display": "000007",
  "username": "alice", "nickname": "小爱", "display_name": "小爱",
  "avatar_url": "/api/core/avatar/用户UUID", "roles": ["user"],
  "ver": 0, "module_id": "welcome", "auth_required": true, "exp": 1730000000 }
```

- `username` 是登录名（唯一），`display_name` 是展示名（主站已做「昵称→用户名」回退）。
- `avatar_url` 为站内相对路径；模块前端与主站同源，可直接 `<img src>` 加载。
- **`email` 默认不下发**，仅当模块在 `module.yaml` 声明 `auth.request_email: true` 时主站才附带（最小权限）。
- `ver` 绑定用户 token 版本；主站在改密码 / 重置 2FA 后会让旧上下文及模块 token 立即失效。

模块用 `MODULE_SIGN_KEY`（主站部署时通过环境变量注入，与主站 `TOYBOX_MODULE_SIGN_KEY` 一致）
重算签名并恒定时间比对，通过后再 base64 解码取用户。校验逻辑见 [`backend/app/core/auth.py`](backend/app/core/auth.py)：

```python
ctx = Depends(require_user)   # 需登录接口：匿名/无 sub 直接 401
ctx.sub          # 内部用户 id（业务数据隔离用，绝不信任前端传来的 id）
ctx.display_name # 展示名（已回退）
ctx.uid_display  # 000007
ctx.avatar_url   # 头像（站内相对路径）
ctx.email        # 仅当 module.yaml 设 auth.request_email: true 才有值
```

匿名模块（`auth.required=false`）会收到 `anonymous=true / persistence_allowed=false`，**不得持久化任何业务数据**。

## 本地调试

```bash
# 后端（无主站签名时业务接口按匿名拒绝，可单独验证 /health、/manifest）
bash scripts/run_dev.sh        # http://127.0.0.1:8001/health

# 前端
cd frontend && npm install && npm run dev
# 独立联调可设 VITE_API_BASE 指向模块后端
```

## 用本模板开发新模块

1. 复制本仓库为 `personal-tool-module-<your-id>`。
2. 改 `module.yaml` 的 `id / name / description / category / icon / permissions`。
3. 在 `backend/app/api/router.py` 写业务接口，需登录的用 `Depends(require_user)`。
4. **如需数据库**：把 `module.yaml` 的 `database.enabled` 设为 `true`，新增 `backend/alembic` 迁移；
   主站会为模块创建独立 PostgreSQL 库并注入 `DATABASE_URL`。
   所有业务表必须含 `user_id`，且查询/写入都用 `ctx.sub` 强制隔离（架构文档 9.4 / 21.3）。
5. 在 `frontend/` 写界面（可换成任意框架，构建到 `frontend/dist` 即可）。
6. 推到 GitHub → 主站后台「模块管理 → 安装新模块」填仓库地址，一键部署。

## 模块不能做（架构文档 21.2）

不能访问主站数据库 / 其它模块数据库；不能自行处理主站登录；不能信任前端传来的 user_id；
不能暴露公网端口（仅主站网关可达）。
