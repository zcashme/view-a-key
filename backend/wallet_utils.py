import hashlib
import logging
import os
import subprocess
import sys

from config import BASE_DIR, EXPORTS_DIR, WALLETS_DIR

log = logging.getLogger(__name__)


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


def run_read_view_key(view_key: str, birthday: int, wallet_label: str):
    """
    Synchronous helper that calls read_view_key.py for THIS viewing key only.
    Not used by the HTTP API, but useful as a CLI helper.
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
