# 主站后端镜像。docker 部署模式下，安装模块需要：git（clone）、node/npm（构建模块前端）、
# docker CLI（构建/运行模块容器，配合挂载的 docker.sock）。
FROM python:3.12-slim

# 系统依赖：git、docker CLI、node 20
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates curl gnupg docker.io \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/requirements.txt server/requirements.txt
# psycopg 用于连接生产 PostgreSQL 主库
RUN pip install --no-cache-dir -r server/requirements.txt "psycopg[binary]"

COPY server /app/server

WORKDIR /app/server
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
