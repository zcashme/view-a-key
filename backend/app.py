import logging
import time

import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from config import (
    BASE_DIR,
    FRONTEND_DIR,
    FRONTEND_ASSETS_DIR,
    EXPORTS_DIR,
    WALLETS_DIR,
    CORS_ORIGINS,
    ensure_directories,
)
from jobs import JOBS, create_job

# --------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)  # we'll serve assets ourselves

    # Make sure data dirs exist
    ensure_directories()

    # CORS for /api/*
    CORS(app, resources={r"/api/*": {"origins": CORS_ORIGINS}})

    # ----------------------------------------------------------------------
    # Frontend routes
    # ----------------------------------------------------------------------
    @app.route("/")
    def index():
        log.info("GET / from %s", request.remote_addr)
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/assets/<path:filename>")
    def frontend_assets(filename):
        """
        Serve frontend assets (CSS, JS, favicon, etc).
        """
        return send_from_directory(FRONTEND_ASSETS_DIR, filename)

    @app.route("/favicon.ico")
    def favicon_ico():
        # Point favicon.ico -> our PNG in assets/img
        return send_from_directory(
            FRONTEND_ASSETS_DIR + "/img",
            "favicon.png",
            mimetype="image/png",
        )

    # ----------------------------------------------------------------------
    # API routes
    # ----------------------------------------------------------------------
    @app.route("/api/import", methods=["POST"])
    def api_import():
        """
        Starts the import process in the background and returns a Job ID.
        Does NOT wait for the scan to finish.
        """
        try:
            data = request.get_json(force=True, silent=False) or {}
            view_key = (data.get("view_key") or "").strip()
            birthday = data.get("birthday")
            wallet_name = (data.get("wallet_name") or "webwallet").strip()

            if not view_key or not birthday:
                return jsonify({"status": "error", "error": "Missing key or birthday"}), 400

            job_id = create_job(view_key, int(birthday), wallet_name)
            return jsonify({"status": "ok", "job_id": job_id})

        except Exception as e:
            log.exception("Error starting job")
            return jsonify({"status": "error", "error": str(e)}), 500

    @app.route("/api/job/<job_id>", methods=["GET"])
    def api_job_status(job_id):
        job = JOBS.get(job_id)
        if not job:
            return jsonify({"status": "error", "error": "Job not found"}), 404

        elapsed = int(time.time() - job.get("start_time", time.time()))

        if job["status"] == "done":
            result = job["result"]
            del JOBS[job_id]
            return jsonify(result)

        elif job["status"] == "failed":
            error_msg = job.get("error", "Unknown error")
            progress = job.get("progress", 0)
            message = job.get("message", "Sync failed.")
            del JOBS[job_id]
            return jsonify(
                {
                    "status": "error",
                    "error": error_msg,
                    "progress": progress,
                    "message": message,
                    "elapsed": elapsed,
                }
            )

        else:
            return jsonify(
                {
                    "status": "pending",
                    "progress": job.get("progress", 0),
                    "message": job.get("message", "Working…"),
                    "elapsed": elapsed,
                }
            )

    @app.route("/api/height", methods=["GET"])
    def api_height():
        """
        Return current Zcash block height for display in the UI.

        This uses Blockchair's public Zcash stats API. It does NOT affect where
        your wallet syncs – wallet operations still go to zec.rocks via
        zcash-devtool; this endpoint is only for showing "height: #######".
        """
        log.info("GET /api/height from %s", request.remote_addr)
        try:
            resp = requests.get("https://api.blockchair.com/zcash/stats", timeout=5)
            resp.raise_for_status()
            data = resp.json()

            height = data.get("data", {}).get("blocks")
            if height is None:
                raise RuntimeError("Could not find 'blocks' field in Blockchair response")

            return jsonify({"status": "ok", "chain": "zec.rocks", "height": int(height)})

        except Exception as e:
            log.exception("Failed to fetch current ZEC height")
            return (
                jsonify(
                    {
                        "status": "error",
                        "chain": "zec.rocks",
                        "height": None,
                        "error": str(e),
                    }
                ),
                500,
            )

    @app.route("/health", methods=["GET"])
    def health():
        """Simple check to confirm the backend is running."""
        return jsonify({"status": "ok"})

    return app


app = create_app()

if __name__ == "__main__":
    # Only HTTP from Nginx / Cloudflare
    app.run(host="127.0.0.1", port=8080, debug=True)
