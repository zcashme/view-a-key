# **Zcash Viewing Key Explorer — Refactored**

A refactored version of the Zcash viewing-key explorer, split into a clear **backend** (Flask) and **frontend** (HTML/CSS/JS modules).

The UI lets you paste a **Unified Viewing Key (UFVK)**, pick a **birthday height**, and see parsed transactions in a modern, filterable interface.

---

# 📁 Project Structure

```text
zcash-viewer/
│
├── backend/
│   ├── app.py            # Flask app (API routes + static file serving)
│   ├── config.py         # Paths, constants, simple config helpers
│   ├── jobs.py           # Background job registry + helpers
│   ├── read_view_key.py  # Thin wrapper around zcash-devtool
│   ├── tx_parser.py      # Parses list-tx output into structured JSON
│   ├── wallet_utils.py   # Shared helpers (wallet slug, birthday filtering, etc.)
│   │
│   ├── exports/          # Auto-created. list-tx .txt exports go here
│   └── wallets/          # Auto-created. Per-UFVK wallet directories
│
├── frontend/
│   ├── index.html        # UI shell for the viewing key page
│   └── assets/
│       ├── css/
│       │   └── styles.css    # Full styling for the viewer UI
│       └── js/
│           ├── main.js       # Entry point, wires UI ↔ backend API
│           ├── api.js        # Small fetch helpers for /api/* endpoints
│           ├── components.js # DOM render helpers (cards, lists, etc.)
│           ├── hooks.js      # Light “state” + polling helpers
│           └── utils.js      # Formatting, helpers (duration, truncation, etc.)
│
└── README.md
```

---

# 🚀 Getting Started

## 1. Requirements

* Python **3.9+**
* `pip` (or `pipx`, `pipenv`, `poetry`, etc.)

### Python dependencies

From the **project root**:

```bash
pip install flask flask-cors requests
```

(Everything else is from the standard library.)

---

## 2. Running the Backend Server

From the **project root**, start the Flask app:

```bash
cd backend
python app.py
```

By default this will:

* Start the server on `http://127.0.0.1:5000/`
* Serve **`frontend/index.html`** at `/`
* Serve static assets from `frontend/assets/`
* Expose API endpoints under `/api/...`:

  * `GET /api/height` — current Zcash chain height (Blockchair)
  * `POST /api/import` — start a UFVK sync job
  * `GET  /api/job/<job_id>` — poll job status (progress, results)

Then open in your browser:

```text
http://127.0.0.1:5000/
```

You should see the **“Zcash Viewing Key”** page with a height indicator and a “Start importing” button.

---

# 🔧 zcash-devtool (Required for Real Transactions)

The backend does **not** ship with the actual Zcash wallet / decoder logic.
Instead, `read_view_key.py` shells out to an external tool:

✅ **`zcash-devtool`**

Because it’s large and platform-specific, it is **not included** in this repo.

Without it, imports will fail with an error similar to:

```text
Error: zcash-devtool path not found at: <project>/backend/zcash-devtool
Please make sure the 'zcash-devtool' folder is in the same directory as this script.
```

When that happens:

* The UI still works
* The **progress bar and “steps” indicators** still animate
* But the job ends with an error and **no transactions** are displayed

# 🖥 Using the Viewer

1. Open `http://127.0.0.1:5000/` in your browser.

2. You should see:

   * Current **height** at the top (from `/api/height`).
   * A **UFVK textarea**.
   * A **Start (birthday) height** input.
   * Sample UFVK cards at the bottom (“Lightwallet Donation UFVK”, “ZcashMe Verification UFVK”).

3. To test quickly:

   * Click one of the sample cards — it auto-fills the UFVK + birthday.
   * Click **“Start importing”**.

4. While the job runs:

   * The **button + inputs are disabled**.
   * A **progress bar** at the bottom of the form moves from ~5% up to ~80% (cosmetic).
   * A **step indicator** below the form shows:

     * Starting wallet
     * Scanning chain
     * Parsing results
     * Ready

5. When complete (and `zcash-devtool` is configured):

   * The **Transactions** card appears.
   * You can:

     * Filter by memo / txid / amount / address.
     * Filter by **height range** (From / To).
     * Sort by height, time, or amount.
     * Paginate (10/25/50 per page) or “Show all”.
     * Export to **JSON**, **CSV**, or raw **.txt**.
     * Toggle and copy the raw `list-tx` output.

If `zcash-devtool` is **not** installed, the UI still shows progress, but eventually a friendly error appears under the form (mapping the backend error into something human-readable).

---

# 🗂 Data & Caching

* **`backend/wallets/`**

  * One subfolder per viewing key (`vk_<hash>`).
  * Contains the wallet database and cache used by `zcash-devtool`.
  * Re-running with the same UFVK + higher birthday reuses the same folder and is much faster.

* **`backend/exports/`**

  * Raw `list-tx` output (`vk_<hash>_txs.txt`).
  * Used for parsing and for “Download .txt” from the UI.

You can safely delete either folder to force a full rescan (next import for that UFVK will be slower but clean).

---

# Key Frontend Files for Review

| File                               | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `frontend/index.html`              | Page shell, layout, and main form                    |
| `frontend/assets/css/styles.css`   | Complete visual design for the viewer                |
| `frontend/assets/js/main.js`       | Entry point; wires form, progress bar, results       |
| `frontend/assets/js/api.js`        | Helpers for `/api/height`, `/api/import`, `/api/job` |
| `frontend/assets/js/components.js` | Renders transaction cards, export buttons, etc.      |
| `frontend/assets/js/hooks.js`      | Polling + state helpers (jobs, filters)              |
| `frontend/assets/js/utils.js`      | Formatting (durations, truncation, CSV, etc.)        |














# Zcash Shielded Newsletter Tool

The Zcash Newsletter application allows organizations or individuals to send
private (“shielded”) broadcast messages to many recipients in a single
`z_sendmany` operation.

---

## How It Works

1. Enter the shielded or unified address you want to send from.
2. Set the default ZEC amount to send to each recipient.
3. Add one or more recipients:
   - Recipient Zcash address  
   - Optional custom memo (up to 504 characters per recipient)  
   - Optional custom amount per recipient
4. Click **Send via z_sendmany**.
5. The app submits a single `z_sendmany` request to your local Zcash node
   and waits for the operation result.

When the transaction completes, the sending status panel will display
success or failure along with the resulting TXID if available.

---

## Technical Notes

- All transactions are generated through the official Zcash RPC method:
  `z_sendmany`.
- Custom memos are UTF-8 encoded, truncated or padded to the Zcash memo limit
  (512 bytes).
- Transfers remain shielded when valid shielded or unified addresses are used.
- A single RPC call is used per newsletter send.

---

## Operational Limits

The maximum number of recipients per send is not fixed by the Zcash protocol,
but is restricted by practical constraints:

- **Transaction size limits** — large batches may exceed block limits.
- **Node memory & validation time** — large sends may stall or fail.
- **Available funds** — total ZEC required includes all recipient amounts and network fees.

### Recommendation

For reliability, limit each newsletter batch to:

**100–300 recipients per transaction**

For larger distributions, split your content into multiple sends.

---

## Funds Requirement

Your sending address must cover:



Total Required = (sum of all recipient amounts) + transaction fee



Typical failure occurs when funds are insufficient:



Insufficient funds: have X, need Y


---

## Troubleshooting

- **No recipients listed**  
  At least one valid address must be entered.

- **Invalid address error**  
  Only valid shielded (`zs…`) or unified (`u…`) addresses are accepted.

- **Operation timeout**  
  Large batches may take more than 90 seconds to finalize.

  Manual status check:


zcash-cli z_getoperationstatus

- **Funds errors**  
Ensure your sending address holds enough ZEC to cover total output + fee.

---

## Security Considerations

- Run this app only on a **trusted machine** with access to your Zcash RPC node.
- **Never expose RPC credentials** publicly.
- Apply proper firewall rules to restrict RPC access.
- **Do not use Flask debug mode in production.**

---

## Additional Zcash References

- Official Zcash Documentation:  
https://docs.zcash.me

- `z_sendmany` RPC Documentation:  
https://zcash.readthedocs.io/en/latest/rtd_pages/z_sendmany.html

- Zcash Core GitHub Repository:  
https://github.com/zcash/zcash

---

## About This Tool

This newsletter sender is designed as a lightweight operational solution for:

- Community announcements  
- Coordination campaigns  
- Resource distribution

All message delivery is handled using Zcash’s built-in privacy features.

For large-scale broadcasts, always test with smaller batches before deployment.
```


