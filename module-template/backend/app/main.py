"""模块后端入口（FastAPI）。

模块统一契约（架构文档 4.3 / 21.1）必须提供：
  GET /health     健康检查（部署器用）
  GET /manifest   返回 module.yaml 解析后的清单
  业务接口         通过主站网关 /api/modules/{module_id}/* 转发到这里
"""
from __future__ import annotations

import pathlib

import yaml
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .api.router import router
from .core.auth import MODULE_ID
from .core.response import CODE_SERVER_ERROR, ModuleError, fail

app = FastAPI(title=f"ToyBox 模块 · {MODULE_ID}", docs_url="/docs", openapi_url="/openapi.json")

# module.yaml 位于仓库根（相对本文件 ../../../module.yaml）
_MANIFEST_PATH = pathlib.Path(__file__).resolve().parents[2] / "module.yaml"


@app.exception_handler(ModuleError)
async def _module_error(_: Request, exc: ModuleError):
    return JSONResponse(status_code=exc.http_status, content=fail(exc.code, exc.message))


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception):
    return JSONResponse(status_code=500, content=fail(CODE_SERVER_ERROR, "模块内部错误"))


@app.get("/health")
def health():
    return {"status": "ok", "module_id": MODULE_ID}


@app.get("/manifest")
def manifest():
    try:
        return yaml.safe_load(_MANIFEST_PATH.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {"id": MODULE_ID}


# 业务路由（主站网关会把 /api/modules/{id}/greeting 转发到这里的 /greeting）
app.include_router(router)
