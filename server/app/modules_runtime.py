"""模块安装 / 部署流水线 + 运行管理。

可插拔 Runner（按 TOYBOX_DEPLOY_MODE 选择）：
  - LocalRunner（local，默认）：模块独立 venv + uvicorn 子进程；模块库用 SQLite。开发态可跑、无需 Docker。
    用 pidfile 记录子进程，主站重启时先清理上一批孤儿进程，杜绝端口泄漏。
  - DockerRunner（docker，生产）：docker build 镜像 → 在 Postgres 实例建模块独立 database/user →
    （如需）容器内执行 alembic 迁移 → docker run 加入内部网络（不暴露公网端口）→ 健康检查。

链路（runner 无关的部分共享）：clone → 读 module.yaml 校验 → 构建前端(挂 /module-assets)
  → runner.deploy（建后端 + 建库迁移 + 起服务）→ /health 健康检查 → 注册上线。
网关只认 internal_backend_url，与运行方式无关。
"""
from __future__ import annotations

import logging
import os
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import yaml
from sqlalchemy.orm import Session

from .core.config import DATA_DIR, settings
from .core.database import SessionLocal
from .core.security import module_sign_key_for
from .models import InstalledModule, InstallJob

log = logging.getLogger("toybox.deploy")

MODULES_DIR = DATA_DIR / "modules"
STAGING = MODULES_DIR / "staging"
INSTALLED = MODULES_DIR / "installed"
ASSETS = MODULES_DIR / "assets"
for _d in (STAGING, INSTALLED, ASSETS):
    _d.mkdir(parents=True, exist_ok=True)

ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")

# 本地方式：module_id -> {"proc": Popen, "port": int}
_procs: dict[str, dict] = {}
_lock = threading.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _run(cmd: list[str], cwd: str | None, logs: list[str], timeout: int = 900) -> None:
    logs.append(f"$ {' '.join(cmd)}")
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    if r.stdout.strip():
        logs.append(r.stdout.strip()[-1500:])
    if r.returncode != 0:
        logs.append((r.stderr or "").strip()[-1500:])
        raise RuntimeError(f"命令失败({r.returncode})：{' '.join(cmd)}")


# ---------- runtime 运行策略（架构：模块分级 static/platform_storage/container/lazy_container）----------
VALID_RUNTIME_MODES = {"static", "platform_storage", "container", "lazy_container"}
_BACKEND_MODES = {"container", "lazy_container"}


def _mem_to_bytes(s: str) -> int:
    """解析 256m / 1g / 1024k / 1048576 等内存字符串为字节；非法返回 -1。"""
    m = re.fullmatch(r"\s*(\d+)\s*([bkmg]?)\s*", str(s).lower())
    if not m:
        return -1
    return int(m.group(1)) * {"": 1, "b": 1, "k": 1024, "m": 1024 ** 2, "g": 1024 ** 3}[m.group(2)]


def runtime_mode_for(manifest: dict) -> str:
    """模块运行模式：显式 runtime.mode 优先；否则按旧契约推断
    （声明后端→container，否则→static），保证旧模块零改动兼容。"""
    if not isinstance(manifest, dict):
        return "static"
    mode = (manifest.get("runtime") or {}).get("mode")
    if mode in VALID_RUNTIME_MODES:
        return mode
    return "container" if bool((manifest.get("backend") or {}).get("enabled")) else "static"


def module_has_backend(manifest: dict) -> bool:
    """是否需要部署独立后端容器/进程：仅 container / lazy_container 且 backend.enabled。"""
    return runtime_mode_for(manifest) in _BACKEND_MODES and bool((manifest.get("backend") or {}).get("enabled"))


def uses_platform_storage(manifest: dict) -> bool:
    return runtime_mode_for(manifest) == "platform_storage"


def resource_limits_for(manifest: dict) -> dict:
    """读取 runtime.resources 并按主站上限钳制（缺省用主站默认）。仅容器模式生效。"""
    res = ((manifest.get("runtime") or {}) if isinstance(manifest, dict) else {}).get("resources") or {}
    mem = str(res.get("memory") or settings.module_default_memory)
    if _mem_to_bytes(mem) <= 0 or _mem_to_bytes(mem) > _mem_to_bytes(settings.module_max_memory):
        mem = settings.module_max_memory if _mem_to_bytes(mem) > _mem_to_bytes(settings.module_max_memory) else settings.module_default_memory
    try:
        cpus = min(float(res.get("cpus") or settings.module_default_cpus), settings.module_max_cpus)
    except (TypeError, ValueError):
        cpus = settings.module_default_cpus
    try:
        pids = min(int(res.get("pids") or settings.module_default_pids), settings.module_max_pids)
    except (TypeError, ValueError):
        pids = settings.module_default_pids
    return {"memory": mem, "cpus": cpus, "pids": pids}


def _validate_runtime(m: dict) -> None:
    rt = m.get("runtime")
    if rt is None:
        return
    if not isinstance(rt, dict):
        raise ValueError("module.yaml: runtime 必须是对象")
    mode = rt.get("mode")
    if mode is not None and mode not in VALID_RUNTIME_MODES:
        raise ValueError(f"module.yaml: runtime.mode 非法，应为 {sorted(VALID_RUNTIME_MODES)} 之一")
    res = rt.get("resources")
    if res is not None:
        if not isinstance(res, dict):
            raise ValueError("module.yaml: runtime.resources 必须是对象")
        if "memory" in res and _mem_to_bytes(res["memory"]) <= 0:
            raise ValueError("module.yaml: runtime.resources.memory 非法（如 256m / 1g）")
        if "cpus" in res and not (isinstance(res["cpus"], (int, float)) and not isinstance(res["cpus"], bool) and res["cpus"] > 0):
            raise ValueError("module.yaml: runtime.resources.cpus 必须是正数")
        if "pids" in res and not (isinstance(res["pids"], int) and not isinstance(res["pids"], bool) and res["pids"] > 0):
            raise ValueError("module.yaml: runtime.resources.pids 必须是正整数")
    it = rt.get("idle_timeout")
    if it is not None and not (isinstance(it, int) and not isinstance(it, bool) and it > 0):
        raise ValueError("module.yaml: runtime.idle_timeout 必须是正整数")

    # 显式声明 runtime.mode 时，必须与 backend.enabled 一致，避免「声明成后端模块但部署器不起后端」之类的矛盾。
    if mode in VALID_RUNTIME_MODES:
        be = bool((m.get("backend") or {}).get("enabled"))
        if mode in _BACKEND_MODES and not be:
            raise ValueError(f"module.yaml: runtime.mode={mode} 必须同时 backend.enabled: true")
        if mode not in _BACKEND_MODES and be:
            raise ValueError(f"module.yaml: runtime.mode={mode}（纯前端）不能声明 backend.enabled: true")


def _validate_manifest(m: dict) -> str:
    mid = m.get("id")
    if not mid or not ID_RE.match(str(mid)):
        raise ValueError("module.yaml 的 id 非法（只能小写字母/数字/下划线/连字符）")
    if not m.get("version"):
        raise ValueError("module.yaml 缺少 version")
    fd = str((m.get("entry") or {}).get("frontend_dist", "frontend/dist"))
    df = str((m.get("backend") or {}).get("dockerfile", "backend/Dockerfile"))
    hp = str((m.get("backend") or {}).get("health_path", "/health"))
    if ".." in fd or fd.startswith("/") or ".." in df or df.startswith("/"):
        raise ValueError("module.yaml 路径不合法（不允许 .. 或绝对路径）")
    if not hp.startswith("/"):
        raise ValueError("health_path 必须以 / 开头")

    _validate_runtime(m)  # runtime.mode / resources / idle_timeout 校验

    # 网关白名单强校验（防类型写错绕过 fail-closed）。仅对实际会部署后端的模块要求 allow_paths。
    gw = m.get("gateway") or {}
    if not isinstance(gw, dict):
        raise ValueError("module.yaml: gateway 必须是对象")
    if "legacy_allow_all" in gw and not isinstance(gw["legacy_allow_all"], bool):
        raise ValueError("module.yaml: gateway.legacy_allow_all 必须是布尔值")
    if module_has_backend(m) and gw.get("legacy_allow_all") is not True:
        allow = gw.get("allow_paths")
        if not isinstance(allow, list) or not allow or not all(isinstance(p, str) for p in allow):
            raise ValueError("module.yaml: gateway.allow_paths 必须是非空字符串列表（或显式 legacy_allow_all: true）")
        for p in allow:
            if not p.startswith("/") or p == "/" or ".." in p or "://" in p:
                raise ValueError(f"module.yaml: gateway.allow_paths 路径非法：{p}")
    return str(mid)


_CROSSORIGIN_RE = re.compile(r"\s+crossorigin(=([\"'][^\"']*[\"']|\S+))?")


def _strip_crossorigin(asset_dir: Path, logs: list[str] | None = None) -> None:
    """去掉构建产物 HTML 里 <script>/<link> 的 crossorigin 属性。
    模块前端在 sandbox="allow-scripts"（不透明源 = "null"）的 iframe 中加载；带 crossorigin 的
    模块脚本会触发 CORS 请求（Origin: null），静态服务无 Access-Control-Allow-Origin → 脚本被拦截 →
    页面空白。去掉后按 no-cors 同 URL 加载即可正常执行。"""
    for html in asset_dir.glob("*.html"):
        try:
            text = html.read_text(encoding="utf-8")
            new = _CROSSORIGIN_RE.sub("", text)
            if new != text:
                html.write_text(new, encoding="utf-8")
                if logs is not None:
                    logs.append(f"已移除 {html.name} 中的 crossorigin 属性（iframe 沙箱兼容）")
        except Exception:  # noqa: BLE001
            pass


def _health_ok(internal_url: str, health_path: str, tries: int = 30) -> bool:
    for _ in range(tries):
        time.sleep(1)
        try:
            with urllib.request.urlopen(internal_url + health_path, timeout=3) as r:
                if r.status == 200:
                    return True
        except Exception:  # noqa: BLE001
            pass
    return False


@dataclass
class DeployCtx:
    module_id: str
    manifest: dict
    dest: Path  # installed/<id>
    logs: list[str] = field(default_factory=list)

    @property
    def src(self) -> Path:
        return self.dest / "source"

    @property
    def backend_dir(self) -> Path:
        return self.src / "backend"

    @property
    def db_enabled(self) -> bool:
        return bool((self.manifest.get("database") or {}).get("enabled"))

    @property
    def health_path(self) -> str:
        return str((self.manifest.get("backend") or {}).get("health_path", "/health"))

    @property
    def version(self) -> str:
        return str(self.manifest.get("version", "latest"))


# ======================= LocalRunner（本地进程） =======================
class LocalRunner:
    name = "local"

    def _pidfile(self, module_id: str) -> Path:
        return INSTALLED / module_id / "backend.pid"

    def _ensure_venv(self, ctx: DeployCtx) -> Path:
        venv = ctx.dest / ".venv"
        if not (venv / "bin" / "uvicorn").exists():
            _run([sys.executable, "-m", "venv", str(venv)], None, ctx.logs, timeout=120)
            req = ctx.backend_dir / "requirements.txt"
            if req.exists():
                _run([str(venv / "bin" / "pip"), "install", "-q", "-r", str(req)], None, ctx.logs, timeout=900)
        return venv

    def _db_url(self, ctx: DeployCtx) -> str | None:
        return f"sqlite:///{(ctx.dest / 'module.db').as_posix()}" if ctx.db_enabled else None

    def _migrate(self, ctx: DeployCtx, db_url: str) -> None:
        alembic_dir = ctx.backend_dir / "alembic"
        if not alembic_dir.exists():
            return
        env = os.environ.copy()
        env["DATABASE_URL"] = db_url
        env["MODULE_ID"] = ctx.module_id
        try:
            subprocess.run([str(ctx.dest / ".venv" / "bin" / "alembic"), "upgrade", "head"],
                           cwd=str(ctx.backend_dir), env=env, capture_output=True, text=True, timeout=300)
        except Exception as e:  # noqa: BLE001
            ctx.logs.append(f"迁移告警：{e}")

    def _start_proc(self, ctx: DeployCtx, db_url: str | None) -> str:
        self.stop(ctx.module_id)  # 先停旧进程/孤儿（必须在加锁前）
        venv = ctx.dest / ".venv"
        env = os.environ.copy()
        env["MODULE_ID"] = ctx.module_id
        env["MODULE_SIGN_KEY"] = module_sign_key_for(ctx.module_id)  # 每模块独立密钥
        if db_url:
            env["DATABASE_URL"] = db_url
        port = _free_port()
        logf = open(ctx.dest / "backend.log", "a")  # noqa: SIM115
        proc = subprocess.Popen(
            [str(venv / "bin" / "uvicorn"), "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=str(ctx.backend_dir), env=env, stdout=logf, stderr=subprocess.STDOUT,
        )
        self._pidfile(ctx.module_id).write_text(str(proc.pid))
        with _lock:
            _procs[ctx.module_id] = {"proc": proc, "port": port}
        return f"http://127.0.0.1:{port}"

    def deploy(self, ctx: DeployCtx) -> str:
        self._ensure_venv(ctx)
        db_url = self._db_url(ctx)
        if db_url:
            self._migrate(ctx, db_url)
        return self._start_proc(ctx, db_url)

    def ensure_running(self, ctx: DeployCtx) -> str:
        return self.deploy(ctx)  # 本地：重启进程即可（venv 已存在则跳过装依赖）

    def stop(self, module_id: str) -> None:
        with _lock:
            info = _procs.pop(module_id, None)
        if info and info["proc"].poll() is None:
            info["proc"].terminate()
            try:
                info["proc"].wait(timeout=8)
            except subprocess.TimeoutExpired:
                info["proc"].kill()
        # 兜底：按 pidfile 杀掉可能残留的孤儿进程（如主站重启后）
        pidf = self._pidfile(module_id)
        if pidf.exists():
            try:
                pid = int(pidf.read_text().strip())
                os.kill(pid, signal.SIGTERM)
            except (ProcessLookupError, ValueError, PermissionError):
                pass
            pidf.unlink(missing_ok=True)

    def cleanup_stale(self) -> None:
        """主站启动时清理上一批遗留的模块子进程（pidfile），杜绝端口泄漏。"""
        for pidf in INSTALLED.glob("*/backend.pid"):
            try:
                pid = int(pidf.read_text().strip())
                os.kill(pid, signal.SIGTERM)
                log.info("清理遗留模块进程 pid=%s (%s)", pid, pidf.parent.name)
            except (ProcessLookupError, ValueError, PermissionError):
                pass
            except Exception:  # noqa: BLE001
                pass
            pidf.unlink(missing_ok=True)
        with _lock:
            _procs.clear()


# ======================= DockerRunner（生产） =======================
class DockerRunner:
    name = "docker"

    def _safe(self, mid: str) -> str:
        return mid.replace("-", "_")

    def _image(self, ctx: DeployCtx) -> str:
        return f"{settings.module_image_prefix}{ctx.module_id}:{ctx.version}"

    def _container(self, module_id: str) -> str:
        return f"{settings.module_container_prefix}{module_id}"

    def _db_name(self, mid: str) -> str:
        return f"module_{self._safe(mid)}_db"

    def _db_user(self, mid: str) -> str:
        return f"module_{self._safe(mid)}_user"

    def _internal_port(self, ctx: DeployCtx) -> int:
        return int((ctx.manifest.get("backend") or {}).get("internal_port", 8000))

    def _provision_db(self, ctx: DeployCtx) -> str | None:
        """用 psycopg 以超管直连 Postgres 建模块独立库/用户（不再 docker exec，socket 代理无需开放 EXEC）。"""
        if not ctx.db_enabled:
            return None
        import psycopg  # 仅生产镜像含 psycopg
        mid = ctx.module_id
        db, user = self._db_name(mid), self._db_user(mid)  # 由已校验的 module_id 派生，标识符安全
        pw_file = ctx.dest / "db_password"
        pw = pw_file.read_text().strip() if pw_file.exists() else secrets.token_urlsafe(24)
        ctx.logs.append(f"[docker] 直连 Postgres 创建模块库 {db}")
        conn = psycopg.connect(host=settings.postgres_host, port=settings.postgres_port,
                               user=settings.postgres_superuser, password=settings.postgres_password,
                               dbname="postgres", autocommit=True)
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (user,))
            if not cur.fetchone():
                cur.execute(f'CREATE ROLE "{user}" LOGIN PASSWORD %s', (pw,))
            cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (db,))
            if not cur.fetchone():
                cur.execute(f'CREATE DATABASE "{db}" OWNER "{user}"')
            cur.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{db}" TO "{user}"')
        finally:
            conn.close()
        pw_file.write_text(pw)
        pw_file.chmod(0o600)
        return f"postgresql://{user}:{pw}@{settings.postgres_host}:{settings.postgres_port}/{db}"

    def _build_image(self, ctx: DeployCtx) -> None:
        df = str((ctx.manifest.get("backend") or {}).get("dockerfile", "backend/Dockerfile"))
        build_ctx = (ctx.src / df).parent
        # 给 docker build 加内存/CPU 上限，避免在小机器（如 A1）上构建吃满资源（best-effort：
        # BuildKit 可能忽略部分参数，彻底隔离请按文档 phase 4 把镜像构建移到 GitHub Actions）。
        build_lim = [
            "--memory", str(settings.module_build_memory),
            "--cpu-period", "100000", "--cpu-quota", str(int(settings.module_build_cpus * 100000)),
        ]
        _run(["docker", "build", *build_lim, "-t", self._image(ctx), "-f", str(ctx.src / df), str(build_ctx)],
             None, ctx.logs, timeout=1800)

    def _migrate(self, ctx: DeployCtx, db_url: str) -> None:
        if not (ctx.backend_dir / "alembic").exists():
            return
        # 迁移容器同样限制资源 + 安全加固（与运行容器一致）
        lim = resource_limits_for(ctx.manifest)
        _run(["docker", "run", "--rm", "--network", settings.docker_network,
              "--memory", str(lim["memory"]), "--memory-swap", str(lim["memory"]),
              "--cpus", str(lim["cpus"]), "--pids-limit", str(lim["pids"]),
              "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
              "-e", f"DATABASE_URL={db_url}", "-e", f"MODULE_ID={ctx.module_id}",
              "-e", f"MODULE_SIGN_KEY={module_sign_key_for(ctx.module_id)}",
              self._image(ctx), "alembic", "upgrade", "head"], None, ctx.logs, timeout=600)

    def deploy(self, ctx: DeployCtx) -> str:
        self._build_image(ctx)
        db_url = self._provision_db(ctx)
        if db_url:
            self._migrate(ctx, db_url)
        cont = self._container(ctx.module_id)
        subprocess.run(["docker", "rm", "-f", cont], capture_output=True, text=True)
        env_args = ["-e", f"MODULE_ID={ctx.module_id}", "-e", f"MODULE_SIGN_KEY={module_sign_key_for(ctx.module_id)}"]
        if db_url:
            env_args += ["-e", f"DATABASE_URL={db_url}"]
        # 资源限制 + 安全加固：限内存/CPU/进程数，丢弃所有 capability、禁止提权，/tmp 用 tmpfs（不可执行）。
        lim = resource_limits_for(ctx.manifest)
        limit_args = [
            "--memory", str(lim["memory"]), "--memory-swap", str(lim["memory"]),
            "--cpus", str(lim["cpus"]), "--pids-limit", str(lim["pids"]),
            "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
        ]
        ctx.logs.append(f"[runtime] 资源限制 memory={lim['memory']} cpus={lim['cpus']} pids={lim['pids']}")
        # 不暴露公网端口，仅加入内部网络，主站网关按容器名访问
        _run(["docker", "run", "-d", "--name", cont, "--network", settings.docker_network,
              "--restart", "unless-stopped", *limit_args, *env_args, self._image(ctx)], None, ctx.logs, timeout=120)
        return f"http://{cont}:{self._internal_port(ctx)}"

    def ensure_running(self, ctx: DeployCtx) -> str:
        cont = self._container(ctx.module_id)
        r = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", cont], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip() != "true":
            subprocess.run(["docker", "start", cont], capture_output=True, text=True)  # 容器存在但停了 → 启动
        elif r.returncode != 0:
            return self.deploy(ctx)  # 容器不存在 → 重新部署
        return f"http://{cont}:{self._internal_port(ctx)}"

    def stop(self, module_id: str) -> None:
        subprocess.run(["docker", "rm", "-f", self._container(module_id)], capture_output=True, text=True)

    def cleanup_stale(self) -> None:
        # Docker 容器以 --restart unless-stopped 独立存活，主站重启无需清理
        pass


def get_runner():
    return DockerRunner() if settings.deploy_mode == "docker" else LocalRunner()


RUNNER = get_runner()


def stop_module(module_id: str) -> None:
    RUNNER.stop(module_id)


def _ctx(module_id: str, manifest: dict) -> DeployCtx:
    return DeployCtx(module_id=module_id, manifest=manifest, dest=INSTALLED / module_id)


def _register(db: Session, manifest: dict, mid: str, internal_url: str, source_url: str, source_ref: str) -> None:
    m = db.query(InstalledModule).filter(InstalledModule.module_id == mid).first()
    if not m:
        m = InstalledModule(module_id=mid)
        db.add(m)
    m.name = str(manifest.get("name", mid))
    m.description = str(manifest.get("description", ""))
    m.category = str(manifest.get("category", "工具"))
    m.icon = str(manifest.get("icon", "sparkles"))
    m.auth_required = bool((manifest.get("auth") or {}).get("required", True))
    m.version = str(manifest.get("version", ""))
    m.entry_type = str((manifest.get("entry") or {}).get("type", "iframe"))
    m.internal_backend_url = internal_url
    m.manifest = manifest
    m.source_url = source_url
    m.source_ref = source_ref
    m.builtin = False
    m.status = "active"
    m.hidden = False
    db.commit()


# ---------- 任务队列（install / restart / uninstall 都走任务，主站可不碰 docker）----------
def _enqueue(job_type: str, *, module_id: str = "", repo_url: str = "", ref: str = "", created_by: str | None = None) -> str:
    db = SessionLocal()
    try:
        job = InstallJob(job_type=job_type, module_id=module_id, source_url=repo_url, source_ref=ref or "",
                         status="pending", created_by=created_by)
        db.add(job)
        db.commit()
        jid = job.id
    finally:
        db.close()
    # 本地/开发：进程内线程立即执行；生产：worker_inproc=false，由独立 Deploy Worker 轮询执行
    if settings.worker_inproc:
        threading.Thread(target=dispatch, args=(jid,), daemon=True).start()
    return jid


def start_install(repo_url: str, ref: str, created_by: str | None) -> str:
    return _enqueue("install", repo_url=repo_url, ref=ref, created_by=created_by)


def start_restart(module_id: str, created_by: str | None = None) -> str:
    return _enqueue("restart", module_id=module_id, created_by=created_by)


def start_uninstall(module_id: str, created_by: str | None = None) -> str:
    return _enqueue("uninstall", module_id=module_id, created_by=created_by)


# 安装任务的「进行中」状态（非 pending/success/failed）。崩溃后会卡在这些状态。
_INFLIGHT_JOB_STATUSES = (
    "processing", "cloning", "validating", "building_frontend",
    "building_backend", "migrating", "starting_container", "health_checking",
)


def reclaim_stale_install_jobs() -> int:
    """回收因执行进程崩溃而中断、卡在「进行中」状态的安装任务，标记为 failed，避免永久卡死。
    在执行方（独立 deploy_worker，或 worker_inproc 时的主站）启动时调用：单执行进程模型下，
    启动那一刻任何处于进行中状态的任务都已随上次进程消亡，可安全判失败。"""
    db = SessionLocal()
    try:
        n = (
            db.query(InstallJob)
            .filter(InstallJob.status.in_(_INFLIGHT_JOB_STATUSES))
            .update(
                {
                    "status": "failed",
                    "error_message": "部署进程重启，上一次任务被中断，请重试",
                    "finished_at": _now(),
                },
                synchronize_session=False,
            )
        )
        db.commit()
        if n:
            log.warning("回收 %d 个中断的安装任务（标记为 failed）", n)
        return n
    finally:
        db.close()


def dispatch(job_id: str) -> None:
    """按 job_type 分发执行（被进程内线程或独立 worker 调用）。"""
    db = SessionLocal()
    try:
        job = db.get(InstallJob, job_id)
        jt = job.job_type if job else ""
    finally:
        db.close()
    if jt == "install":
        _do_install(job_id)
    elif jt == "restart":
        _do_restart(job_id)
    elif jt == "uninstall":
        _do_uninstall(job_id)


def _set(db: Session, job: InstallJob, status: str, logs: list[str], error: str = "") -> None:
    job.status = status
    job.logs = "\n".join(logs)[-8000:]
    if error:
        job.error_message = error
    db.commit()


def _do_install(job_id: str) -> None:
    db = SessionLocal()
    job = db.get(InstallJob, job_id)
    if not job:
        db.close()
        return
    logs: list[str] = []
    try:
        # 1) clone
        _set(db, job, "cloning", logs)
        staging = STAGING / job_id
        if staging.exists():
            shutil.rmtree(staging)
        clone_cmd = ["git", "clone", "--depth", "1"]
        if job.source_ref:
            clone_cmd += ["-b", job.source_ref]
        clone_cmd += [job.source_url, str(staging)]
        _run(clone_cmd, None, logs, timeout=300)

        # 2) 读 module.yaml + 校验
        _set(db, job, "validating", logs)
        manifest = yaml.safe_load((staging / "module.yaml").read_text(encoding="utf-8"))
        mid = _validate_manifest(manifest)
        job.module_id = mid
        db.commit()
        existing = db.query(InstalledModule).filter(InstalledModule.module_id == mid).first()
        if existing and existing.builtin:
            raise RuntimeError(f"已存在同名内置模块 {mid}，不能覆盖")

        # 落地 installed/<id>/source
        dest = INSTALLED / mid
        RUNNER.stop(mid)
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
        shutil.move(str(staging), str(dest / "source"))
        ctx = DeployCtx(module_id=mid, manifest=manifest, dest=dest, logs=logs)

        # 3) 构建前端 → assets/<id>
        fd = str((manifest.get("entry") or {}).get("frontend_dist", "frontend/dist"))
        fe_dir = ctx.src / "frontend"
        if fe_dir.exists():
            _set(db, job, "building_frontend", logs)
            _run(["npm", "install", "--no-audit", "--no-fund", "--silent"], str(fe_dir), logs, timeout=900)
            _run(["npm", "run", "build"], str(fe_dir), logs, timeout=900)
            dist = ctx.src / fd
            if not dist.exists():
                raise RuntimeError(f"前端构建产物不存在：{fd}")
            asset_dir = ASSETS / mid
            if asset_dir.exists():
                shutil.rmtree(asset_dir)
            shutil.copytree(dist, asset_dir)
            _strip_crossorigin(asset_dir, logs)

        # 4) runner 部署后端（建后端/镜像 + 建库迁移 + 起服务）→ 健康检查
        #    仅 container / lazy_container 模式部署后端；static / platform_storage 纯前端，跳过。
        internal_url = ""
        mode = runtime_mode_for(manifest)
        logs.append(f"[runtime] mode={mode}")
        if module_has_backend(manifest):
            if mode == "lazy_container":
                logs.append("[runtime] lazy_container 暂作常驻容器运行（懒启动为后续阶段）")
            _set(db, job, "building_backend", logs)
            logs.append(f"[runner={RUNNER.name}] 开始部署后端")
            _set(db, job, "starting_container", logs)
            internal_url = RUNNER.deploy(ctx)
            _set(db, job, "health_checking", logs)
            if not _health_ok(internal_url, ctx.health_path):
                raise RuntimeError("模块健康检查失败（/health 未在限时内返回 200）")

        # 5) 注册上线
        _register(db, manifest, mid, internal_url, job.source_url, job.source_ref)
        logs.append(f"✓ 模块 {mid} 已部署上线（{RUNNER.name}）")
        _set(db, job, "success", logs)
        job.finished_at = _now()
        db.commit()
        log.info("模块 %s 安装成功（%s）", mid, RUNNER.name)
    except Exception as e:  # noqa: BLE001
        logs.append(f"ERROR: {e}")
        _set(db, job, "failed", logs, error=str(e))
        job.finished_at = _now()
        db.commit()
        log.error("安装任务 %s 失败：%s", job_id, e)
    finally:
        db.close()


def _do_restart(job_id: str) -> None:
    db = SessionLocal()
    job = db.get(InstallJob, job_id)
    if not job:
        db.close()
        return
    logs = [f"restart {job.module_id}"]
    try:
        m = db.query(InstalledModule).filter(InstalledModule.module_id == job.module_id).first()
        if not m or not m.manifest or not module_has_backend(m.manifest):
            raise RuntimeError("该模块无后端，无需重启")
        ctx = DeployCtx(module_id=m.module_id, manifest=m.manifest, dest=INSTALLED / m.module_id, logs=logs)
        RUNNER.stop(m.module_id)
        url = RUNNER.ensure_running(ctx)
        if not _health_ok(url, ctx.health_path, tries=20):
            raise RuntimeError("重启后健康检查失败")
        m.internal_backend_url = url
        _set(db, job, "success", logs)
        job.finished_at = _now()
        db.commit()
    except Exception as e:  # noqa: BLE001
        logs.append(f"ERROR: {e}")
        _set(db, job, "failed", logs, error=str(e))
        job.finished_at = _now()
        db.commit()
    finally:
        db.close()


def _do_uninstall(job_id: str) -> None:
    db = SessionLocal()
    job = db.get(InstallJob, job_id)
    if not job:
        db.close()
        return
    logs = [f"uninstall {job.module_id}"]
    try:
        uninstall_module(job.module_id)
        logs.append("✓ 已停止并清理")
        _set(db, job, "success", logs)
        job.finished_at = _now()
        db.commit()
    except Exception as e:  # noqa: BLE001
        logs.append(f"ERROR: {e}")
        _set(db, job, "failed", logs, error=str(e))
        job.finished_at = _now()
        db.commit()
    finally:
        db.close()


def module_logs(module_id: str, tail: int = 200) -> str:
    if RUNNER.name == "docker":
        try:
            r = subprocess.run(["docker", "logs", "--tail", str(tail), f"{settings.module_container_prefix}{module_id}"],
                               capture_output=True, text=True, timeout=15)
            return (((r.stdout or "") + (r.stderr or "")).strip() or "（暂无日志）")[-8000:]
        except Exception as e:  # noqa: BLE001
            return f"（docker 模式日志请在服务器/worker 侧查看：{e}）"
    logf = INSTALLED / module_id / "backend.log"
    if logf.exists():
        return "\n".join(logf.read_text(errors="replace").splitlines()[-tail:])[-8000:]
    return "（暂无日志）"


def uninstall_module(module_id: str) -> None:
    """停服务（进程/容器）并删除安装目录与前端资源。"""
    RUNNER.stop(module_id)
    for p in (INSTALLED / module_id, ASSETS / module_id):
        if p.exists():
            shutil.rmtree(p, ignore_errors=True)


def relaunch_active_modules() -> None:
    """主站启动时：清理遗留（本地进程，防端口泄漏）。docker 模式容器独立存活、无需重拉。"""
    RUNNER.cleanup_stale()
    if RUNNER.name == "docker":
        return
    db = SessionLocal()
    try:
        mods = (
            db.query(InstalledModule)
            .filter(InstalledModule.status == "active", InstalledModule.builtin == False)  # noqa: E712
            .all()
        )
        for m in mods:
            if not m.manifest or not module_has_backend(m.manifest):
                continue
            if not (INSTALLED / m.module_id / "source" / "backend").exists():
                continue
            try:
                ctx = _ctx(m.module_id, m.manifest)
                internal_url = RUNNER.ensure_running(ctx)
                if _health_ok(internal_url, ctx.health_path, tries=20):
                    m.internal_backend_url = internal_url
                    db.commit()
                    log.info("重新拉起模块 %s -> %s", m.module_id, internal_url)
                else:
                    log.warning("模块 %s 重新拉起后健康检查失败", m.module_id)
            except Exception as e:  # noqa: BLE001
                log.error("重新拉起模块 %s 失败：%s", m.module_id, e)
    finally:
        db.close()
