import hashlib
import logging
import os
import subprocess
import sys
import threading
import time

from config import BASE_DIR, EXPORTS_DIR, WALLETS_DIR
from tx_parser import parse_list_tx_text, filter_txs_by_birthday
from wallet_utils import wallet_slug_from_key

log = logging.getLogger(__name__)

# In-memory job storage
JOBS = {}


def simulate_progress(job_id, stop_event, max_progress=80):
    """
    Slowly increase JOBS[job_id]['progress'] up to max_progress while
    the main sync is running. This is purely cosmetic, not 'real'.
    """
    try:
        p = 5
        while not stop_event.is_set() and p < max_progress:
            job = JOBS.get(job_id)
            if not job:
                break
            job["progress"] = p
            job.setdefault("message", "Syncing wallet…")
            time.sleep(2)  # bump every 2s
            p += 3
    except Exception:
        log.exception("simulate_progress crashed for job %s", job_id)


def background_sync_task(job_id, view_key, birthday, wallet_name):
    slug = wallet_slug_from_key(view_key)
    wallet_dir = os.path.join(WALLETS_DIR, slug)
    output_prefix = os.path.join(EXPORTS_DIR, f"{slug}_txs")
    txt_path = output_prefix + ".txt"

    log.info("Job %s: Starting sync for %s", job_id, slug)

    job = JOBS.get(job_id)
    if not job:
        return

    job["status"] = "running"
    job["message"] = "Starting wallet sync…"
    job["progress"] = 5

    cmd = [
        sys.executable,
        os.path.join(BASE_DIR, "read_view_key.py"),
        "--key", view_key,
        "--birthday", str(birthday),
        "--wallet-dir", wallet_dir,
        "--name", wallet_name,
        "--output-prefix", output_prefix,
    ]

    stop_event = threading.Event()
    prog_thread = threading.Thread(
        target=simulate_progress, args=(job_id, stop_event)
    )
    prog_thread.daemon = True
    prog_thread.start()

    try:
        job["message"] = "Syncing wallet…"
        job["progress"] = max(job.get("progress", 5), 20)
        result = subprocess.run(cmd, capture_output=True, text=True)

        # stop the simulated progress
        stop_event.set()
        prog_thread.join(timeout=1)

        if result.returncode != 0:
            log.error("Job %s failed: %s", job_id, result.stderr)
            job["status"] = "failed"
            job["error"] = "Backend tool failed. Check logs."
            job["progress"] = job.get("progress", 0)
            job["message"] = "Sync failed."
            return

        if not os.path.exists(txt_path):
            job["status"] = "failed"
            job["error"] = "Output file not found."
            job["progress"] = job.get("progress", 0)
            job["message"] = "Sync failed (no output)."
            return

        job["progress"] = 90
        job["message"] = "Parsing results…"

        with open(txt_path, "r", encoding="utf-8") as f:
            text = f.read()

        parsed = parse_list_tx_text(text)
        parsed = filter_txs_by_birthday(parsed, birthday)

        job["result"] = {
            "status": "ok",
            "wallet_name": wallet_name,
            "birthday": birthday,
            "slug": slug,
            "file": os.path.basename(txt_path),
            "raw_text": text,
            "transactions": parsed,
        }
        job["status"] = "done"
        job["progress"] = 100
        job["message"] = "Done."
        log.info("Job %s: Finished successfully with %d txs.", job_id, len(parsed))

    except Exception as e:
        stop_event.set()
        prog_thread.join(timeout=1)
        log.exception("Job %s crashed", job_id)
        job["status"] = "failed"
        job["error"] = str(e)
        job["message"] = "Sync crashed."


def create_job(view_key: str, birthday: int, wallet_name: str) -> str:
    """
    Create a new job entry and start the background thread.
    Returns the new job_id.
    """
    job_id = hashlib.sha256(f"{view_key}{time.time()}".encode()).hexdigest()[:12]
    JOBS[job_id] = {
        "status": "queued",
        "start_time": time.time(),
        "progress": 0,
        "message": "Queued…",
    }

    thread = threading.Thread(
        target=background_sync_task,
        args=(job_id, view_key, int(birthday), wallet_name),
    )
    thread.start()

    return job_id
