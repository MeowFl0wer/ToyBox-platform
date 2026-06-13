"""ToyBox 主站后端入口（FastAPI）。"""
from __future__ import annotations

import logging

import threading

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from . import modules_runtime
from .api import admin, auth, core_api, gateway
from .core.config import settings
from .core.response import APIError, CODE_BAD_PARAM, CODE_SERVER_ERROR, fail
from .seed import run_seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("toybox")

app = FastAPI(title=settings.app_name, docs_url="/api/docs", openapi_url="/api/openapi.json")


# ---------- 安全响应头 ----------
class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "SAMEORIGIN"
        resp.headers["Referrer-Policy"] = "no-referrer"
        resp.headers["X-XSS-Protection"] = "0"
        resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return resp


app.add_middleware(SecurityHeaders)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # 显式来源，配合 Cookie 凭证（不能用 *）
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ---------- 统一异常 -> 统一响应体 ----------
@app.exception_handler(APIError)
async def _api_error(_: Request, exc: APIError):
    return JSONResponse(status_code=exc.http_status, content=fail(exc.code, exc.message, exc.data))


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    msg = first.get("msg", "参数错误")
    return JSONResponse(status_code=400, content=fail(CODE_BAD_PARAM, msg))


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception):
    log.exception("未处理异常: %s", exc)
    return JSONResponse(status_code=500, content=fail(CODE_SERVER_ERROR, "服务器内部错误"))


app.include_router(auth.router)
app.include_router(core_api.router)
app.include_router(admin.router)
app.include_router(gateway.router)

# 模块前端静态资源（iframe 承载）：/module-assets/{module_id}/...
app.mount("/module-assets", StaticFiles(directory=str(modules_runtime.ASSETS), html=True), name="module-assets")


@app.get("/api/health")
def health():
    return {"code": 0, "message": "ok", "data": {"status": "up"}}


def _check_production_config() -> None:
    """生产模式（dev_mode=false）发现不安全的默认值则拒绝启动。"""
    if settings.dev_mode:
        return
    problems = []
    if settings.admin_password == "Admin@12345":
        problems.append("默认管理员密码")
    for value, name in ((settings.secret_key, "SECRET_KEY"), (settings.module_sign_key, "MODULE_SIGN_KEY")):
        if "change-me" in value or "change-this" in value:
            problems.append(f"占位的 {name}")
    if problems:
        raise RuntimeError(
            "生产模式检测到不安全的默认配置：" + "、".join(problems) + "。请通过环境变量设置强随机值后再启动。"
        )


@app.on_event("startup")
def _startup():
    _check_production_config()
    run_seed()
    # 后台重新拉起已安装的 active 模块（建 venv/健康检查较慢，放线程不阻塞启动）
    threading.Thread(target=modules_runtime.relaunch_active_modules, daemon=True).start()
    log.info("%s 已启动", settings.app_name)
