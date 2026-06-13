"""独立 Deploy Worker（生产）：轮询 module_install_jobs，执行安装/重启/卸载。

生产部署时主站后端不持有 docker.sock；只有本 worker 通过 docker-socket-proxy 访问受限的 Docker API。
运行：python -m app.worker.deploy_worker
（开发态默认 TOYBOX_WORKER_INPROC=true，任务在主站进程内线程执行，无需本 worker。）
"""
from __future__ import annotations

import logging
import time

from ..core.database import Base, SessionLocal, engine
from ..models import InstallJob
from ..modules_runtime import dispatch

log = logging.getLogger("toybox.worker")


def run_worker_loop(poll: float = 2.0) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # 等待并确保表存在（与主站共享库）
    for _ in range(30):
        try:
            Base.metadata.create_all(bind=engine)
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
