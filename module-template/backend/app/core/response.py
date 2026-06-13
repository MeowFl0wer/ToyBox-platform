"""统一响应格式，与主站一致：{ code, message, data }。"""
from __future__ import annotations

from typing import Any

CODE_OK = 0
CODE_UNAUTHORIZED = 10001
CODE_FORBIDDEN = 10002
CODE_BAD_PARAM = 10004
CODE_SERVER_ERROR = 50000


def ok(data: Any = None, message: str = "ok") -> dict:
    return {"code": CODE_OK, "message": message, "data": data}


def fail(code: int, message: str, data: Any = None) -> dict:
    return {"code": code, "message": message, "data": data}


class ModuleError(Exception):
    def __init__(self, code: int, message: str, http_status: int = 400):
        self.code = code
        self.message = message
        self.http_status = http_status
        super().__init__(message)
