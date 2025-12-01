// hooks.js
import { formatDuration, parseAmount } from "./utils.js";

// ---- Tips "hook" ----
export function createTipsController(waitTipEl, tips) {
  let tipInterval = null;
  let tipIndex = 0;

  function start() {
    if (!waitTipEl || !tips.length) return;
    waitTipEl.style.display = "block";
    waitTipEl.textContent = tips[0];
    tipIndex = 0;
    if (tipInterval) clearInterval(tipInterval);
    tipInterval = setInterval(() => {
      tipIndex = (tipIndex + 1) % tips.length;
      waitTipEl.textContent = tips[tipIndex];
    }, 7000);
  }

  function stop() {
    if (tipInterval) {
      clearInterval(tipInterval);
      tipInterval = null;
    }
    if (waitTipEl) {
      waitTipEl.style.display = "none";
    }
  }

  return { start, stop };
}

// ---- Filtering + sorting hook ----
export function createFilterState() {
  return {
    filterText: "",
    sortMode: "height_desc",
    heightFrom: null,
    heightTo: null,

    apply(allTransactions) {
      let txs = Array.isArray(allTransactions) ? [...allTransactions] : [];

      // text filter
      if (this.filterText) {
        const q = this.filterText.toLowerCase();
        txs = txs.filter((tx) => {
          if (!tx) return false;
          const chunks = [];

          if (tx.txid) chunks.push(tx.txid);
          if (tx.amount) chunks.push(tx.amount);
          if (tx.fee) chunks.push(tx.fee);
          if (tx.mined_height != null) chunks.push(String(tx.mined_height));
          if (tx.mined_time) chunks.push(tx.mined_time);
          if (tx.note_summary) chunks.push(tx.note_summary);

          if (Array.isArray(tx.outputs)) {
            tx.outputs.forEach((out) => {
              if (!out) return;
              if (out.value) chunks.push(out.value);
              if (out.account) chunks.push(out.account);
              if (out.to) chunks.push(out.to);
              if (out.memo) chunks.push(out.memo);
            });
          }

          return chunks.some((v) => v && v.toLowerCase().includes(q));
        });
      }

      // height filter
      if (this.heightFrom != null || this.heightTo != null) {
        txs = txs.filter((tx) => {
          const h = tx.mined_height;
          if (typeof h !== "number") return false;
          if (this.heightFrom != null && h < this.heightFrom) return false;
          if (this.heightTo != null && h > this.heightTo) return false;
          return true;
        });
      }

      // sorting
      txs.sort((a, b) => {
        switch (this.sortMode) {
          case "height_asc":
            return (a.mined_height ?? 0) - (b.mined_height ?? 0);
          case "height_desc":
            return (b.mined_height ?? 0) - (a.mined_height ?? 0);
          case "amount_asc":
            return parseAmount(a.amount) - parseAmount(b.amount);
          case "amount_desc":
            return parseAmount(b.amount) - parseAmount(a.amount);
          case "time_asc":
            return (a.mined_time || "").localeCompare(b.mined_time || "");
          case "time_desc":
            return (b.mined_time || "").localeCompare(a.mined_time || "");
          default:
            return (b.mined_height ?? 0) - (a.mined_height ?? 0);
        }
      });

      return txs;
    },
  };
}

// ---- Pagination hook ----
export function createPaginationState(defaultPageSize = 10) {
  return {
    currentPage: 1,
    pageSize: defaultPageSize,
    showAll: false,

    reset() {
      this.currentPage = 1;
      this.pageSize = defaultPageSize;
      this.showAll = false;
    },

    totalPages(totalItems) {
      return Math.max(1, Math.ceil(totalItems / this.pageSize));
    },

    slice(items) {
      if (this.showAll) return items;
      const total = items.length;
      const pages = this.totalPages(total);
      if (this.currentPage > pages) this.currentPage = pages;
      if (this.currentPage < 1) this.currentPage = 1;
      const startIndex = (this.currentPage - 1) * this.pageSize;
      return items.slice(startIndex, startIndex + this.pageSize);
    },
  };
}

// Progress text helper (used by main)
export function buildProgressMessage(message, pct, elapsedSec) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  const elapsedText =
    typeof elapsedSec === "number"
      ? ` · ${formatDuration(elapsedSec)} elapsed`
      : "";
  return `${message} (${clamped}% complete${elapsedText})`;
}
