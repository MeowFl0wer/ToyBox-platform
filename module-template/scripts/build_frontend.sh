#!/usr/bin/env bash
# 构建模块前端，产物在 frontend/dist（主站会复制到 /module-assets/{id}/current/）
set -e
cd "$(dirname "$0")/../frontend"
npm install
npm run build
echo "✓ 前端构建完成：frontend/dist"
