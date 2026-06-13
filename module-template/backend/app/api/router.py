"""模块业务接口。需登录的接口用 require_user 依赖拿到当前用户上下文。

【开发新模块时】：在这里写你的业务路由；如需数据库，所有业务表必须带 user_id，
且查询/写入都用 ctx.sub 强制隔离不同用户的数据（架构文档 9.4 / 21.3）。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..core.auth import UserContext, require_user
from ..core.response import ok

router = APIRouter()


@router.get("/greeting")
def greeting(ctx: UserContext = Depends(require_user)):
    name = ctx.username or "朋友"
    return ok({"greeting": f"欢迎 {name}！！", "username": name})
