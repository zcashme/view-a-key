// utils.js

export function shortenKey(key) {
  if (!key || key.length <= 16) return key || "";
  return key.slice(0, 6) + "…" + key.slice(-6);
}

export function shortenTxid(txid) {
  if (!txid || txid.length <= 18) return txid || "";
  return txid.slice(0, 8) + "…" + txid.slice(-8);
}

export function parseAmount(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function triggerDownload(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// CSV helpers
function csvEscape(value) {
  if (value == null) return "";
  const s = String(value).replace(/\r?\n|\r/g, " ");
  if (/[",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsvFromTransactions(txs) {
  const headers = [
    "txid",
    "mined_height",
    "mined_time",
    "amount",
    "fee",
    "note_summary",
    "output_index",
    "output_pool",
    "output_value",
    "output_account",
    "output_to",
    "output_memo",
  ];
  const rows = [headers.join(",")];

  txs.forEach((tx) => {
    const base = [
      tx.txid ?? "",
      tx.mined_height ?? "",
      tx.mined_time ?? "",
      tx.amount ?? "",
      tx.fee ?? "",
      tx.note_summary ?? "",
    ];
    if (Array.isArray(tx.outputs) && tx.outputs.length) {
      tx.outputs.forEach((out) => {
        const row = base.concat([
          out?.index ?? "",
          out?.pool ?? "",
          out?.value ?? "",
          out?.account ?? "",
          out?.to ?? "",
          out?.memo ?? "",
        ]);
        rows.push(row.map(csvEscape).join(","));
      });
    } else {
      const row = base.concat(["", "", "", "", "", ""]);
      rows.push(row.map(csvEscape).join(","));
    }
  });

  return rows.join("\r\n");
}

export function buildTextFromTransactions(txs) {
  const lines = [];

  txs.forEach((tx) => {
    lines.push(`txid: ${tx.txid ?? ""}`);

    const h = tx.mined_height;
    const t = tx.mined_time;
    if (h != null || t) {
      lines.push(
        "Mined: " + (h != null ? h : "") + (t ? ` ${t}` : "")
      );
    }

    if (tx.amount || tx.fee) {
      lines.push(
        `Amount: ${tx.amount ?? ""}` +
          (tx.fee ? ` (fee: ${tx.fee})` : "")
      );
    }

    if (tx.note_summary) {
      lines.push(`Notes: ${tx.note_summary}`);
    }

    if (Array.isArray(tx.outputs) && tx.outputs.length) {
      tx.outputs.forEach((out) => {
        const idx = out?.index != null ? `#${out.index}` : "";
        const pool = out?.pool ? ` (${out.pool})` : "";
        lines.push(`  Output ${idx}${pool}`);
        if (out?.value) lines.push(`    Value: ${out.value}`);
        if (out?.account) lines.push(`    Account: ${out.account}`);
        if (out?.to) lines.push(`    To: ${out.to}`);
        if (out?.memo) lines.push(`    Memo: ${out.memo}`);
      });
    }

    lines.push("");
  });

  return lines.join("\n");
}

// Export filename helper
export function baseFilename(ext, meta) {
  const slug = meta?.slug || "zcash-view";
  const birthday =
    meta?.birthday != null ? String(meta.birthday) : "";
  const safe = birthday ? `${slug}_${birthday}` : slug;
  return `${safe}.${ext}`;
}

// Map backend-ish errors into user-friendly UFVK message
export function prettifyErrorMessage(raw) {
  if (!raw) return "Something went wrong. Please try again.";
  const lower = raw.toLowerCase();

  if (
    lower.includes("backend tool failed") ||
    lower.includes("read_view_key.py") ||
    (lower.includes("invalid") &&
      (lower.includes("view") || lower.includes("key"))) ||
    lower.includes("viewing key")
  ) {
    return "Couldn’t read this UFVK. Please check that you pasted a full, valid unified viewing key and try again.";
  }

  return raw;
}
