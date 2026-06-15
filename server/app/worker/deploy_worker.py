"""独立 Deploy Worker（生产）：轮询 module_install_jobs，执行安装/重启/卸载。

生产部署时主站后端不持有 docker.sock；只有本 worker 通过 docker-socket-proxy 访问受限的 Docker API。
运行：python -m app.worker.deploy_worker
（开发态默认 TOYBOX_WORKER_INPROC=true，任务在主站进程内线程执行，无需本 worker。）
"""
from __future__ import annotations

import logging
import time

from ..core.database import SessionLocal
from ..models import InstallJob
from ..modules_runtime import dispatch
from ..seed import run_seed

log = logging.getLogger("toybox.worker")


def run_worker_loop(poll: float = 2.0) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # 等待数据库就绪，并执行「建表 + 轻量迁移 + 基础数据」（run_seed 幂等，与主站后端一致）：
    # worker 可能比 backend 先处理任务，这里跑迁移可避免旧库升级时缺列。
    for _ in range(30):
        try:
            run_seed()
            break
        except Exception as e:  # noqa: BLE001
            log.warning("等待数据库就绪：%s", e)
            time.sleep(2)
    log.info("Deploy Worker 已启动，轮询间隔 %.1fs", poll)

    while True:
        jid = None
        db = SessionLocal()
        try:
            job = (
                db.query(InstallJob)
                .filter(InstallJob.status == "pending")
                .order_by(InstallJob.created_at.asc())
                .first()
            )
            if job:
                jid = job.id
                job.status = "processing"  # 认领，避免重复选取
                db.commit()
        except Exception as e:  # noqa: BLE001
            log.error("轮询任务失败：%s", e)
        finally:
            db.close()

        if jid:
            try:
                dispatch(jid)
            except Exception as e:  # noqa: BLE001
                log.error("任务 %s 执行异常：%s", jid, e)
        else:
            time.sleep(poll)


if __name__ == "__main__":
    run_worker_loop()
