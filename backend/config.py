import os
import string

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
FRONTEND_ASSETS_DIR = os.path.join(FRONTEND_DIR, "assets")

# Data dirs
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")
WALLETS_DIR = os.path.join(BASE_DIR, "wallets")

# CORS allowed origins
CORS_ORIGINS = [
    "https://zcashme.github.io",
    "https://zcashme.github.io/view-a-key",
    "http://view.zcash.me:5000",  # calling API directly over HTTP
    "https://view.zcash.me",      # future: when you put HTTPS in front
    "http://localhost:5000",
    "http://127.0.0.1:5000",
]

# Hex characters for txid detection
HEX_CHARS = set(string.hexdigits)


def ensure_directories():
    """Create exports/ and wallets/ if they do not exist."""
    os.makedirs(EXPORTS_DIR, exist_ok=True)
    os.makedirs(WALLETS_DIR, exist_ok=True)
