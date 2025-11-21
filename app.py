import os
import sys
import subprocess
import hashlib
import logging
import string
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

app = Flask(__name__)

CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://zcashme.github.io",
            "https://zcashme.github.io/view-a-key",
            "http://view.zcash.me:5000",  # calling API directly over HTTP
            "https://view.zcash.me",      # future: when you put HTTPS in front
            "http://localhost:5000",
            "http://127.0.0.1:5000",
        ]
    }
})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")
WALLETS_DIR = os.path.join(BASE_DIR, "wallets")

os.makedirs(EXPORTS_DIR, exist_ok=True)
os.makedirs(WALLETS_DIR, exist_ok=True)

HEX_CHARS = set(string.hexdigits)


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def wallet_slug_from_key(view_key: str) -> str:
    """
    Derive a stable, filesystem-safe folder name from the viewing key.
    - Same key  -> same slug (same wallet dir, reused every time)
    - New key   -> new slug (separate wallet dir)
    """
    h = hashlib.sha256(view_key.encode("utf-8")).hexdigest()
    slug = "vk_" + h[:16]
    log.info("Derived wallet slug %s for viewing key (len=%d)", slug, len(view_key))
    return slug


def _looks_like_txid(line: str) -> bool:
    s = line.strip()
    if len(s) < 32:
        return False
    return all(c in HEX_CHARS for c in s)


def parse_list_tx_text(text: str):
    """
    Parse zcash-devtool 'list-tx' text into a structured list of transactions.

    It is intentionally tolerant: if something doesn't match, it just stores
    the raw line instead of failing.
    """
    lines = text.splitlines()
    txs = []

    current_tx = None
    current_output = None
    i = 0

    while i < len(lines):
        line = lines[i].rstrip("\n")

        if not line.strip():
            i += 1
            continue
        if line.strip().startswith("Transactions:"):
            i += 1
            continue

        if not line.startswith(" ") and _looks_like_txid(line):
            if current_tx:
                txs.append(current_tx)
            current_tx = {
                "txid": line.strip(),
                "outputs": [],
            }
        else:
            if current_tx is None:
                i += 1
                continue

            stripped = line.strip()

            if stripped.startswith("Mined:"):
                rest = stripped[len("Mined:"):].strip()
                parts = rest.split(" ", 1)
                if parts:
                    try:
                        current_tx["mined_height"] = int(parts[0])
                    except ValueError:
                        current_tx["mined_height_raw"] = parts[0]
                    if len(parts) > 1:
                        current_tx["mined_time"] = parts[1].strip("() ")
            elif stripped.startswith("Amount:"):
                current_tx["amount"] = stripped[len("Amount:"):].strip()
            elif stripped.startswith("Fee paid:"):
                current_tx["fee"] = stripped[len("Fee paid:"):].strip()
            elif stripped.startswith("Sent ") and "notes" in stripped and "memos" in stripped:
                current_tx["note_summary"] = stripped
            elif stripped.startswith("Output "):
                out = {"raw_header": stripped}
                tokens = stripped.split()
                if len(tokens) >= 2 and tokens[1].isdigit():
                    out["index"] = int(tokens[1])
                if "(" in stripped and ")" in stripped:
                    out["pool"] = stripped[stripped.find("(") + 1:stripped.find(")")]
                current_tx["outputs"].append(out)
                current_output = out
            elif stripped.startswith("Value:") and current_output is not None:
                current_output["value"] = stripped[len("Value:"):].strip()
            elif stripped.startswith("Received by account:") and current_output is not None:
                current_output["account"] = stripped[len("Received by account:"):].strip()
            elif stripped.startswith("To:") and current_output is not None:
                current_output["to"] = stripped[len("To:"):].strip()
            elif stripped.startswith("Memo:") and current_output is not None:
                memo_lines = [stripped[len("Memo:"):].strip()]
                j = i + 1
                while j < len(lines) and lines[j].startswith(" "):
                    memo_lines.append(lines[j].strip())
                    j += 1
                memo = " ".join(memo_lines)

                if "Memo::Text(" in memo:
                    start = memo.find("Memo::Text(") + len("Memo::Text(")
                    if memo[start:].startswith('"'):
                        start += 1
                    end = memo.rfind('")')
                    if end == -1:
                        end = len(memo)
                    memo = memo[start:end]
                current_output["memo"] = memo
                i = j - 1 

        i += 1

    if current_tx:
        txs.append(current_tx)

    return txs


def run_read_view_key(view_key: str, birthday: int, wallet_label: str):
    """
    Call read_view_key.py for THIS viewing key only.

    We rely on read_view_key.py to:
      - init wallet if it does not exist
      - otherwise, skip init and only sync/enhance/list-tx

    IMPORTANT: We DO NOT delete or recreate the wallet directory here.
    That means:
      - First time for a given key: slow (full scan)
      - Subsequent calls for same key: much faster (incremental sync)
    """
    slug = wallet_slug_from_key(view_key)

    wallet_dir = os.path.join(WALLETS_DIR, slug)
    output_prefix = os.path.join(EXPORTS_DIR, f"{slug}_txs")
    txt_path = output_prefix + ".txt"

    log.info("Starting read_view_key for slug=%s", slug)
    log.info("  wallet_dir     = %s", wallet_dir)
    log.info("  output_prefix  = %s", output_prefix)
    log.info("  txt_path       = %s", txt_path)
    log.info("  birthday       = %d", birthday)
    log.info("  wallet_label   = %s", wallet_label)

    if os.path.exists(txt_path):
        log.info("Removing old export file: %s", txt_path)
        os.remove(txt_path)

    cmd = [
        sys.executable,
        os.path.join(BASE_DIR, "read_view_key.py"),
        "--key", view_key,
        "--birthday", str(birthday),
        "--wallet-dir", wallet_dir,
        "--name", wallet_label,
        "--output-prefix", output_prefix,
    ]

    log.info("Running command: %s", " ".join(cmd))

    result = subprocess.run(cmd, capture_output=True, text=True)

    log.info("read_view_key.py finished with return code %s", result.returncode)
    if result.stdout:
        log.info("----- read_view_key.py STDOUT -----\n%s\n-------------------------", result.stdout)
    if result.stderr:
        log.info("----- read_view_key.py STDERR -----\n%s\n-------------------------", result.stderr)

    combined = (result.stdout or "") + "\n" + (result.stderr or "")

    if result.returncode != 0:
        if "GetTreeState" in combined or "InvalidArgument" in combined:
            raise RuntimeError(
                "zcash-devtool could not initialize this wallet.\n\n"
                f"Start (birthday) height {birthday} is not supported by the "
                "lightwalletd server (zec.rocks). Try a more recent height "
                "(for example around the time this wallet was first used)."
            )

        if "database is locked" in combined:
            raise RuntimeError(
                "Wallet database is locked.\n\n"
                "Another process (or a previous interrupted run) is holding "
                "the SQLite file open.\n\n"
                "Fix options:\n"
                "  • Make sure no other zcash-devtool or read_view_key.py is running.\n"
                "  • Restart this Flask app.\n"
                "  • If it still persists, you can delete the wallet folder:\n"
                f"      {wallet_dir}\n"
                "    and run this again (that will resync from scratch for this key)."
            )

        if "os error 2" in combined or "The system cannot find the file specified" in combined:
            raise RuntimeError(
                "zcash-devtool reported a missing file in this wallet directory.\n\n"
                "Most likely the wallet folder is in a corrupted or half-initialized state.\n\n"
                "You can fix it by removing this folder:\n"
                f"    {wallet_dir}\n"
                "and then running this again (it will re-create the wallet and rescan "
                "from the specified birthday)."
            )

        raise RuntimeError(
            "read_view_key.py failed.\n\n"
            "STDOUT:\n" + result.stdout + "\n\nSTDERR:\n" + result.stderr
        )

    if not os.path.exists(txt_path):
        raise RuntimeError(
            f"Expected output file not found at {txt_path}. "
            "Did read_view_key.py complete successfully?"
        )

    log.info("Export file created: %s", txt_path)
    return txt_path, slug


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.route("/")
def index():
    log.info("GET / from %s", request.remote_addr)
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/api/import", methods=["POST"])
def api_import():
    """
    Request JSON:
      {
        "view_key": "uview1...",
        "birthday": 3000000,
        "wallet_name": "test"
      }
    """
    log.info("POST /api/import from %s", request.remote_addr)

    try:
        data = request.get_json(force=True, silent=False)
        log.info("Request JSON: %r", data)
    except Exception as e:
        log.exception("Failed to parse JSON body")
        return jsonify({"status": "error", "error": f"Invalid JSON: {e}"}), 400

    data = data or {}

    view_key = (data.get("view_key") or "").strip()
    birthday = data.get("birthday")
    wallet_name = (data.get("wallet_name") or "webwallet").strip() or "webwallet"

    if not view_key:
        log.warning("Missing viewing key")
        return jsonify({"status": "error", "error": "Missing viewing key"}), 400

    if birthday is None:
        log.warning("Missing birthday height")
        return jsonify({"status": "error", "error": "Missing birthday height"}), 400

    try:
        birthday = int(birthday)
    except ValueError:
        log.warning("Invalid birthday (not an int): %r", birthday)
        return jsonify({"status": "error", "error": "Birthday must be an integer"}), 400

    if birthday < 1_000_000:
        log.warning("Birthday %d is too early", birthday)
        return jsonify({
            "status": "error",
            "error": (
                f"Birthday {birthday} is probably too early for zec.rocks.\n"
                "Use a more recent height (e.g. around when this wallet first had activity)."
            )
        }), 400

    try:
        txt_path, slug = run_read_view_key(view_key, birthday, wallet_name)
        with open(txt_path, "r", encoding="utf-8") as f:
            text = f.read()

        parsed = parse_list_tx_text(text)

        log.info("Successfully processed view key for slug %s", slug)

        return jsonify({
            "status": "ok",
            "wallet_name": wallet_name,
            "birthday": birthday,
            "slug": slug,
            "file": os.path.basename(txt_path),
            "raw_text": text,
            "transactions": parsed,
        })

    except Exception as e:
        log.exception("Error in /api/import")
        return jsonify({"status": "error", "error": str(e)}), 500


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

        return jsonify(
            {
                "status": "ok",
                "chain": "zec.rocks", 
                "height": int(height),
            }
        )

    except Exception as e:
        log.exception("Failed to fetch current ZEC height")
        return jsonify(
            {
                "status": "error",
                "chain": "zec.rocks",
                "height": None,
                "error": str(e),
            }
        ), 500

@app.route("/health", methods=["GET"])
def health():
    """Simple check to confirm the backend is running."""
    return jsonify({"status": "ok"})

@app.route('/favicon.png')
def favicon_png():
    return send_from_directory(
        BASE_DIR,
        'favicon.png',
        mimetype='image/png'
    )

@app.route('/favicon.ico')
def favicon_ico():
    return send_from_directory(
        BASE_DIR,
        'favicon.png', 
        mimetype='image/png'
    )

if __name__ == "__main__":
    log.info("Starting Flask dev server on http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
