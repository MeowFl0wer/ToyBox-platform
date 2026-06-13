"""模块安装 / 部署流水线 + 运行进程管理（开发态：本地进程方式，无需 Docker）。

链路：后台填仓库地址 → clone → 读 module.yaml 校验 → 构建前端（产物挂到 assets）
      →（本地方式）建模块独立 venv 装依赖、按需建库迁移 → 起后端进程 → /health 健康检查 → 注册上线。

生产可换 Docker 方式（docker build / docker run），网关只认 internal_backend_url，与运行方式无关。
进程注册表在内存中；主站重启后会自动重新拉起 active 模块。
"""
from __future__ import annotations

import logging
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import yaml
from sqlalchemy.orm import Session

from .core.config import DATA_DIR, settings
from .core.database import SessionLocal
from .models import InstalledModule, InstallJob

log = logging.getLogger("toybox.deploy")

MODULES_DIR = DATA_DIR / "modules"
STAGING = MODULES_DIR / "staging"
INSTALLED = MODULES_DIR / "installed"
ASSETS = MODULES_DIR / "assets"
for _d in (STAGING, INSTALLED, ASSETS):
    _d.mkdir(parents=True, exist_ok=True)

ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")

# module_id -> {"proc": Popen, "port": int}
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
    return str(mid)


# ---------- 进程管理 ----------
def stop_module(module_id: str) -> None:
    with _lock:
        info = _procs.pop(module_id, None)
    if info and info["proc"].poll() is None:
        info["proc"].terminate()
        try:
            info["proc"].wait(timeout=8)
        except subprocess.TimeoutExpired:
            info["proc"].kill()


def module_port(module_id: str) -> int | None:
    info = _procs.get(module_id)
    if info and info["proc"].poll() is None:
        return info["port"]
    return None


def _ensure_backend(dest: Path, manifest: dict, logs: list[str]) -> Path:
    """确保模块独立 venv 并装好依赖，返回 venv 路径。"""
    be_dir = dest / "source" / "backend"
    venv = dest / ".venv"
    if not (venv / "bin" / "uvicorn").exists():
        _run([sys.executable, "-m", "venv", str(venv)], None, logs, timeout=120)
        req = be_dir / "requirements.txt"
        if req.exists():
            _run([str(venv / "bin" / "pip"), "install", "-q", "-r", str(req)], None, logs, timeout=900)
    return venv


def _start_backend_process(module_id: str, dest: Path, manifest: dict) -> tuple[int, str]:
    """启动模块后端 uvicorn 子进程，返回 (port, internal_url)。"""
    be_dir = dest / "source" / "backend"
    venv = dest / ".venv"
    env = os.environ.copy()
    env["MODULE_ID"] = module_id
    env["MODULE_SIGN_KEY"] = settings.module_sign_key
    if (manifest.get("database") or {}).get("enabled"):
        env["DATABASE_URL"] = f"sqlite:///{(dest / 'module.db').as_posix()}"
    stop_module(module_id)  # 先停旧进程（自身会取锁，故必须在加锁之前调用）
    port = _free_port()
    logf = open(dest / "backend.log", "a")  # noqa: SIM115
    proc = subprocess.Popen(
        [str(venv / "bin" / "uvicorn"), "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(be_dir),
        env=env,
        stdout=logf,
        stderr=subprocess.STDOUT,
    )
    with _lock:
        _procs[module_id] = {"proc": proc, "port": port}
    return port, f"http://127.0.0.1:{port}"


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


# ---------- 安装任务 ----------
def start_install(repo_url: str, ref: str, created_by: str | None) -> str:
    db = SessionLocal()
    try:
        job = InstallJob(source_url=repo_url, source_ref=ref or "", status="pending", created_by=created_by)
        db.add(job)
        db.commit()
        jid = job.id
    finally:
        db.close()
    threading.Thread(target=_run_job, args=(jid,), daemon=True).start()
    return jid


def _set(db: Session, job: InstallJob, status: str, logs: list[str], error: str = "") -> None:
    job.status = status
    job.logs = "\n".join(logs)[-8000:]
    if error:
        job.error_message = error
    db.commit()


def _run_job(job_id: str) -> None:
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

        # 落地到 installed/<id>/source
        dest = INSTALLED / mid
        stop_module(mid)
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
        shutil.move(str(staging), str(dest / "source"))
        src = dest / "source"

        # 3) 构建前端 → assets/<id>
        fd = str((manifest.get("entry") or {}).get("frontend_dist", "frontend/dist"))
        fe_dir = src / "frontend"
        if fe_dir.exists():
            _set(db, job, "building_frontend", logs)
            _run(["npm", "install", "--no-audit", "--no-fund", "--silent"], str(fe_dir), logs, timeout=900)
            _run(["npm", "run", "build"], str(fe_dir), logs, timeout=900)
            dist = src / fd
            if not dist.exists():
                raise RuntimeError(f"前端构建产物不存在：{fd}")
            asset_dir = ASSETS / mid
            if asset_dir.exists():
                shutil.rmtree(asset_dir)
            shutil.copytree(dist, asset_dir)

        # 4) 后端：建 venv 装依赖（+ 可选迁移）→ 起进程 → 健康检查
        internal_url = ""
        be = manifest.get("backend") or {}
        if be.get("enabled"):
            _set(db, job, "building_backend", logs)
            _ensure_backend(dest, manifest, logs)
            if (manifest.get("database") or {}).get("enabled"):
                _set(db, job, "migrating", logs)
                alembic_dir = src / "backend" / "alembic"
                if alembic_dir.exists():
                    try:
                        env = os.environ.copy()
                        env["DATABASE_URL"] = f"sqlite:///{(dest / 'module.db').as_posix()}"
                        subprocess.run([str(dest / ".venv" / "bin" / "alembic"), "upgrade", "head"],
                                       cwd=str(src / "backend"), env=env, capture_output=True, text=True, timeout=300)
                    except Exception as e:  # noqa: BLE001
                        logs.append(f"迁移告警：{e}")
            _set(db, job, "starting_container", logs)
            _, internal_url = _start_backend_process(mid, dest, manifest)
            _set(db, job, "health_checking", logs)
            if not _health_ok(internal_url, str(be.get("health_path", "/health"))):
                raise RuntimeError("模块健康检查失败（/health 未在限时内返回 200）")

        # 5) 注册上线
        _register(db, manifest, mid, internal_url, job.source_url, job.source_ref)
        logs.append(f"✓ 模块 {mid} 已部署上线")
        _set(db, job, "success", logs)
        job.finished_at = _now()
        db.commit()
        log.info("模块 %s 安装成功", mid)
    except Exception as e:  # noqa: BLE001
        logs.append(f"ERROR: {e}")
        _set(db, job, "failed", logs, error=str(e))
        job.finished_at = _now()
        db.commit()
        log.error("安装任务 %s 失败：%s", job_id, e)
    finally:
        db.close()


def uninstall_module(module_id: str) -> None:
    """停进程并删除安装目录与前端资源。"""
    stop_module(module_id)
    for p in (INSTALLED / module_id, ASSETS / module_id):
        if p.exists():
            shutil.rmtree(p, ignore_errors=True)


def relaunch_active_modules() -> None:
    """主站启动时重新拉起所有 active 的已安装模块后端。"""
    db = SessionLocal()
    try:
        mods = (
            db.query(InstalledModule)
            .filter(InstalledModule.status == "active", InstalledModule.builtin == False)  # noqa: E712
            .all()
        )
        for m in mods:
            dest = INSTALLED / m.module_id
            if not (dest / "source" / "backend").exists() or not m.manifest:
                continue
            if not (m.manifest.get("backend") or {}).get("enabled"):
                continue
            try:
                logs: list[str] = []
                _ensure_backend(dest, m.manifest, logs)
                _, internal_url = _start_backend_process(m.module_id, dest, m.manifest)
                if _health_ok(internal_url, str((m.manifest.get("backend") or {}).get("health_path", "/health")), tries=20):
                    m.internal_backend_url = internal_url
                    db.commit()
                    log.info("重新拉起模块 %s -> %s", m.module_id, internal_url)
                else:
                    log.warning("模块 %s 重新拉起后健康检查失败", m.module_id)
            except Exception as e:  # noqa: BLE001
                log.error("重新拉起模块 %s 失败：%s", m.module_id, e)
    finally:
        db.close()
