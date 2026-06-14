"""统一响应格式与错误码（对应架构文档 14.4 / 14.5）。"""
from __future__ import annotations

from typing import Any


# 错误码
CODE_OK = 0
CODE_UNAUTHORIZED = 10001       # 未登录
CODE_FORBIDDEN = 10002          # 无权限
CODE_NOT_FOUND = 10003          # 资源不存在
CODE_BAD_PARAM = 10004          # 参数错误
CODE_CONFLICT = 10005           # 资源冲突（如用户名已存在）
CODE_RATE_LIMITED = 10006       # 请求过于频繁
CODE_NEED_VERIFY = 10007        # 需要额外验证（如登录失败过多后要求邮箱验证码）
CODE_MODULE_NOT_FOUND = 20001   # 模块不存在
CODE_MODULE_DISABLED = 20002    # 模块未启用
CODE_CONTENT_NOT_FOUND = 30001  # 内容不存在
CODE_SERVER_ERROR = 50000       # 服务器错误

# 错误码 -> HTTP 状态
_HTTP = {
    CODE_UNAUTHORIZED: 401,
    CODE_FORBIDDEN: 403,
    CODE_NOT_FOUND: 404,
    CODE_BAD_PARAM: 400,
    CODE_CONFLICT: 409,
    CODE_RATE_LIMITED: 429,
    CODE_NEED_VERIFY: 401,
    CODE_MODULE_NOT_FOUND: 404,
    CODE_MODULE_DISABLED: 403,
    CODE_CONTENT_NOT_FOUND: 404,
    CODE_SERVER_ERROR: 500,
}


def ok(data: Any = None, message: str = "ok") -> dict:
    return {"code": CODE_OK, "message": message, "data": data}


def fail(code: int, message: str, data: Any = None) -> dict:
    return {"code": code, "message": message, "data": data}


class APIError(Exception):
    """业务异常，由全局处理器转成统一响应体 + 合适的 HTTP 状态。"""

    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code
        self.message = message
        self.data = data
        self.http_status = _HTTP.get(code, 400)
        super().__init__(message)
