#!/usr/bin/env bash
# 启动 ToyBox 主站后端（开发模式）
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "首次运行：创建虚拟环境并安装依赖…"
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip >/dev/null
  .venv/bin/pip install -r requirements.txt
fi

exec .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
