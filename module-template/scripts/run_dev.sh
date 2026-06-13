#!/usr/bin/env bash
# 本地独立调试模块后端（不经主站网关）。注意：没有主站签名 Header 时业务接口会按匿名拒绝。
set -e
cd "$(dirname "$0")/../backend"
python3 -m venv .venv 2>/dev/null || true
.venv/bin/pip install -q -r requirements.txt
MODULE_ID=welcome MODULE_SIGN_KEY="${MODULE_SIGN_KEY:-dev-insecure-key}" \
  .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
