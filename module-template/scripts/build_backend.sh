#!/usr/bin/env bash
# 构建模块后端镜像（主站部署器执行；本地可用于验证 Dockerfile）
set -e
cd "$(dirname "$0")/.."
IMAGE="${1:-module-welcome:local}"
docker build -t "$IMAGE" backend
echo "✓ 后端镜像已构建：$IMAGE"
