# 主站后端 + Deploy Worker 共用镜像。docker 部署模式下，安装模块需要：git（clone）、
# node/npm（构建模块前端）、docker CLI（构建/运行模块容器）。
# 注意：backend 容器本身**不**挂载 docker.sock；只有 deploy_worker（用本镜像）通过 docker CLI
# 经 socket-proxy（DOCKER_HOST=tcp://toybox-socket-proxy:2375）访问受限 Docker API。
# 详见 deploy/docker-compose.yml。
FROM python:3.12-slim

# 系统依赖：git、node 20（docker CLI 单独按官方静态二进制安装，见下）
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates curl gnupg tar \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI：用官方静态二进制（仅客户端，不含 daemon），跨 amd64/arm64 可靠，避免 Debian
# docker.io 包在某些环境（如 ARM64）装不出可用的 docker 命令。装完即 `docker --version` 自检，
# 装不上就让镜像构建失败（绝不让「运行时才报 docker 找不到」的镜像上线）。
# 运行时通过 DOCKER_HOST=tcp://toybox-socket-proxy:2375 连接受限 Docker API，本镜像不跑 daemon。
ARG DOCKER_CLI_VERSION=27.3.1
RUN set -eux; \
    arch="$(uname -m)"; \
    curl -fsSL "https://download.docker.com/linux/static/stable/${arch}/docker-${DOCKER_CLI_VERSION}.tgz" -o /tmp/docker.tgz; \
    tar -xzf /tmp/docker.tgz -C /tmp docker/docker; \
    install -m 0755 /tmp/docker/docker /usr/local/bin/docker; \
    rm -rf /tmp/docker /tmp/docker.tgz; \
    docker --version

WORKDIR /app

COPY server/requirements.txt server/requirements.txt
# psycopg 用于连接生产 PostgreSQL 主库
RUN pip install --no-cache-dir -r server/requirements.txt "psycopg[binary]"

COPY server /app/server

WORKDIR /app/server
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
