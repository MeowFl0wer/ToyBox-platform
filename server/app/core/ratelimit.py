"""极简内存滑动窗口限流。用于注册/验证码/登录等敏感接口，缓解暴力破解与刷码。
注意：进程内存实现，单实例够用；多实例生产需换 Redis。"""
from __future__ import annotations

import threading
import time

_lock = threading.Lock()
_hits: dict[str, list[float]] = {}


def allow(key: str, limit: int, window_s: int) -> bool:
    now = time.time()
    with _lock:
        bucket = [t for t in _hits.get(key, []) if now - t < window_s]
        if len(bucket) >= limit:
            _hits[key] = bucket
            return False
        bucket.append(now)
        _hits[key] = bucket
        return True
