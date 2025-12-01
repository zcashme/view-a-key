// main.js

// === DOM ELEMENTS =====================================================

const heightStatus = document.getElementById("heightStatus");
const refreshHeightBtn = document.getElementById("refreshHeightBtn");

const vkForm = document.getElementById("vkForm");
const viewKeyInput = document.getElementById("viewKey");
const birthdayInput = document.getElementById("birthday");
const walletNameInput = document.getElementById("walletName");
const startBtn = document.getElementById("startBtn");
const statusMsg = document.getElementById("statusMsg");

const outputSection = document.getElementById("outputSection");
const outputMeta = document.getElementById("outputMeta");
const structuredOutput = document.getElementById("structuredOutput");
const rawOutputWrapper = document.getElementById("rawOutput");
const rawOutput = rawOutputWrapper.querySelector("code");
const toggleRawBtn = document.getElementById("toggleRawBtn");

const presetRow = document.getElementById("presetRow");
const presetStatus = document.getElementById("presetStatus");
const progressWrapper = document.getElementById("progressWrapper");
const progressBar = progressWrapper.querySelector(".progress-bar");

// filter / sort controls
const filterInput = document.getElementById("filterInput");
const sortSelect = document.getElementById("sortSelect");
const heightFromInput = document.getElementById("heightFromInput");
const heightToInput = document.getElementById("heightToInput");

// export controls
const copyRawBtn = document.getElementById("copyRawBtn");
const downloadRawBtn = document.getElementById("downloadRawBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadRawFullBtn = document.getElementById("downloadRawFullBtn");

// pagination elements
const paginationEl = document.getElementById("pagination");
const firstPageBtn = document.getElementById("firstPageBtn");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const lastPageBtn = document.getElementById("lastPageBtn");
const pageInfo = document.getElementById("pageInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const showAllCheckbox = document.getElementById("showAllCheckbox");

// state
let allTransactions = [];
let currentPage = 1;
let pageSize = 10;
let showAll = false;
const DEFAULT_PAGE_SIZE = 10;

let filterText = "";
let sortMode = "height_desc";
let heightFromFilter = null;
let heightToFilter = null;

let lastResultMeta = null;

// === demo / presets ===================================================

const DEMO_VIEW_KEY =
  "uview19dtdmw4m87e780c838v0etahyq3umv2gjvlcgyugxx8vf37h7kp38m9x8p7xgmmyh2vuapa84v2v4vxmzkwsf6q4z693acwk67029szwt4dy5x6aq49ru3h2m2fwa79luk9qwskkc9tksahn5znd0w2nhsahdrghfavaepxtwf9qrk86f00l6r088lcy2jdhssvhr74xjt5s03xxuvu6k95cfkx9n9dm4yld9hx9g8qq0us37vnw78xsk6u9n7uek5avw5cnzvx8nyhc6jrlpty9ndtluhm0tf70tnrz3lmj2ry0j5q62hns875cj6lrleeqr98eqtyj8pdeftlhe2x6ea7e4dtnu6h2uf7j92d70ev7relr8j2y3g8pm05pn7y43l32acc2l7762u99qm06zv8hy0dgessegp3duzqcxva0knlgjayfdsp50ga23gjlerxcy354mr2hgt5p6gpaehg4xkrxmhedd58pdlswcfeldculn4jf";
const DEMO_BIRTHDAY = "2600000";

const PRESET_KEYS = [
  {
    id: "lightDonation",
    name: "Lightwallet Donation UFVK",
    ufvk: DEMO_VIEW_KEY,
    birthday: DEMO_BIRTHDAY,
  },
  {
    id: "zcashmeVerify",
    name: "ZcashMe Verification UFVK",
    ufvk:
      "uview1kpje83w0xm0309p3894frds587gqdsad6ghu3hcy0s9x5yzr3t85dgfkpqghezk5nhl0v2pn5gavun4rzh8hcgqwqqr8r7vfsd3nzdmrqhxnuuv6jwfsg4cppylx9mkpcjd22yngfy78esvxqls7centpanuj4dcupxntnfkee0pzjja4ymcddl2fx9x3ucceeqxh9kj068p3gw7u2lggye0qem89vy3jgsa338tafazyllu7z882hhfcnmhmm8mw9rz8nu44rydcvjmufr7dgprc7yq3t9hnpxn58dzhpfy9ul46e7qnayrwmzw523307pwkh65rx7p3r69823ejs49yvql0cylt4t9c45r4a53ddf3jac9k2ej0aammsvpmv05ecqhey99s",
    birthday: "3000000",
  },
];

const waitTipEl = document.getElementById("waitTip");

const WAIT_TIPS = [
  "First import can take a while. Next ones are much faster.",
  "You can safely reuse this viewing key later without full rescan.",
  "Tip: pick a birthday near the first use of the wallet to speed things up.",
  "We’re only reading a viewing key – your spending keys never leave your device.",
];

let tipInterval = null;
let tipIndex = 0;

// === helpers ==========================================================

function startTips() {
  if (!waitTipEl) return;
  waitTipEl.style.display = "block";
  waitTipEl.textContent = WAIT_TIPS[0];
  tipIndex = 0;
  if (tipInterval) clearInterval(tipInterval);
  tipInterval = setInterval(() => {
    tipIndex = (tipIndex + 1) % WAIT_TIPS.length;
    waitTipEl.textContent = WAIT_TIPS[tipIndex];
  }, 7000);
}

function stopTips() {
  if (tipInterval) {
    clearInterval(tipInterval);
    tipInterval = null;
  }
  if (waitTipEl) {
    waitTipEl.style.display = "none";
  }
}

function shortenKey(key) {
  if (!key || key.length <= 16) return key || "";
  return key.slice(0, 6) + "…" + key.slice(-6);
}

function shortenTxid(txid) {
  if (!txid || txid.length <= 18) return txid || "";
  return txid.slice(0, 8) + "…" + txid.slice(-8);
}

function setStatus(msg, isError = false) {
  statusMsg.textContent = msg || "";
  statusMsg.classList.toggle("error", !!isError);
}

function setPresetStatus(msg) {
  if (presetStatus) presetStatus.textContent = msg || "";
}

function showProgress() {
  if (progressWrapper) progressWrapper.style.display = "block";
}

function hideProgress() {
  if (progressWrapper) progressWrapper.style.display = "none";
}

// steps line
function updateSteps(progress) {
  const stepsEl = document.getElementById("steps");
  if (!stepsEl) return;

  const pct = Math.max(
    0,
    Math.min(100, typeof progress === "number" ? progress : 0)
  );

  const steps = [
    { label: "1. Starting wallet", threshold: 1 },
    { label: "2. Scanning chain", threshold: 25 },
    { label: "3. Parsing results", threshold: 70 },
    { label: "4. Ready", threshold: 100 },
  ];

  const html = steps
    .map((step, idx) => {
      let cls = "step";
      let symbol = "•";
      const prevThreshold = idx === 0 ? 0 : steps[idx - 1].threshold;

      if (pct >= step.threshold || pct === 100) {
        cls += " step-done";
        symbol = "✔";
      } else if (pct >= prevThreshold && pct < step.threshold) {
        cls += " step-current";
        symbol = "⟳";
      }

      return `<span class="${cls}">${symbol} ${step.label}</span>`;
    })
    .join(" ");

  stepsEl.innerHTML = html;
}

function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function updateProgress(pct, message, elapsedSec) {
  if (typeof pct !== "number") pct = 0;
  const clamped = Math.max(0, Math.min(100, pct));
  if (progressBar) progressBar.style.width = clamped + "%";

  const elapsedText =
    typeof elapsedSec === "number"
      ? ` · ${formatDuration(elapsedSec)} elapsed`
      : "";

  if (message) {
    setStatus(`${message} (${clamped}% complete${elapsedText})`);
  }

  updateSteps(clamped);
}

function maybeNotifyDone(txCount) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const body =
    typeof txCount === "number"
      ? `Import finished. Found ${txCount} transactions.`
      : "Import finished.";

  new Notification("Zcash viewing key import", { body });
}

// === presets UI =======================================================

function initPresetUI() {
  PRESET_KEYS.forEach((preset) => {
    if (!preset.ufvk) return;

    const pill = document.createElement("div");
    pill.className = "preset-pill";
    pill.dataset.presetId = preset.id;

    const main = document.createElement("div");
    main.className = "preset-main";

    const nameSpan = document.createElement("span");
    nameSpan.className = "preset-name";
    nameSpan.textContent = preset.name;

    const shortSpan = document.createElement("span");
    shortSpan.className = "preset-short";
    shortSpan.textContent = shortenKey(preset.ufvk);

    main.appendChild(nameSpan);
    main.appendChild(shortSpan);

    const actions = document.createElement("div");
    actions.className = "preset-actions";

    pill.appendChild(main);
    pill.appendChild(actions);

    pill.addEventListener("click", () => {
      viewKeyInput.value = preset.ufvk;
      if (preset.birthday) birthdayInput.value = preset.birthday;
      setStatus("");
      setPresetStatus(`Loaded ${preset.name}. Press “Start importing” to try it.`);
    });

    presetRow.appendChild(pill);
  });
}

// === API: height ======================================================

async function refreshHeight() {
  try {
    refreshHeightBtn.disabled = true;
    heightStatus.textContent = "loading…";
    heightStatus.classList.remove("error");

    const res = await fetch("/api/height");
    const data = await res.json();

    if (data.status === "ok") {
      heightStatus.textContent = data.height ?? "unknown";
      heightStatus.classList.remove("error");
    } else {
      heightStatus.textContent = "error";
      heightStatus.classList.add("error");
    }
  } catch {
    heightStatus.textContent = "error";
    heightStatus.classList.add("error");
  } finally {
    refreshHeightBtn.disabled = false;
  }
}

refreshHeightBtn.addEventListener("click", refreshHeight);

// === transactions rendering + filters + pagination ====================

function renderTransactions(txs) {
  structuredOutput.innerHTML = "";

  if (!txs || !txs.length) {
    const empty = document.createElement("div");
    empty.style.fontSize = "12px";
    empty.style.color = "#9ca3af";
    empty.textContent =
      "No transactions found for this key, height range, and filters.";
    structuredOutput.appendChild(empty);
    return;
  }

  txs.forEach((tx) => {
    const card = document.createElement("div");
    card.className = "tx-card";

    const header = document.createElement("div");
    header.className = "tx-card-header";

    const idSpan = document.createElement("div");
    idSpan.className = "tx-id";
    idSpan.textContent = shortenTxid(tx.txid);

    const amtSpan = document.createElement("div");
    amtSpan.className = "tx-amount";
    amtSpan.textContent = tx.amount || "—";

    header.appendChild(idSpan);
    header.appendChild(amtSpan);
    card.appendChild(header);

    const metaRow = document.createElement("div");
    metaRow.className = "tx-meta-row";

    if (tx.mined_height !== undefined) {
      const h = document.createElement("span");
      h.innerHTML = `<span class="tx-meta-label">Height</span> ${tx.mined_height}`;
      metaRow.appendChild(h);
    }

    if (tx.mined_time) {
      const t = document.createElement("span");
      t.innerHTML = `<span class="tx-meta-label">Mined</span> ${tx.mined_time}`;
      metaRow.appendChild(t);
    }

    if (tx.note_summary) {
      const ns = document.createElement("span");
      ns.innerHTML = `<span class="tx-meta-label">Notes</span> ${tx.note_summary}`;
      metaRow.appendChild(ns);
    }

    if (metaRow.childNodes.length) card.appendChild(metaRow);

    if (tx.outputs && tx.outputs.length) {
      tx.outputs.forEach((out) => {
        const outDiv = document.createElement("div");
        outDiv.className = "tx-output";

        const heading = document.createElement("div");
        heading.className = "tx-output-heading";
        const idx = out.index !== undefined ? `#${out.index}` : "";
        const pool = out.pool ? ` · ${out.pool}` : "";
        heading.textContent = `Output ${idx}${pool}`;
        outDiv.appendChild(heading);

        if (out.value) {
          const f = document.createElement("div");
          f.className = "tx-output-field";
          f.innerHTML = `<span class="label">Value:</span> ${out.value}`;
          outDiv.appendChild(f);
        }
        if (out.account) {
          const f = document.createElement("div");
          f.className = "tx-output-field";
          f.innerHTML = `<span class="label">Account:</span> ${out.account}`;
          outDiv.appendChild(f);
        }
        if (out.to) {
          const f = document.createElement("div");
          f.className = "tx-output-field";
          f.innerHTML = `<span class="label">To:</span> ${out.to}`;
          outDiv.appendChild(f);
        }
        if (out.memo) {
          const f = document.createElement("div");
          f.className = "tx-output-field";
          f.innerHTML = `<span class="label">Memo:</span> ${out.memo}`;
          outDiv.appendChild(f);
        }

        card.appendChild(outDiv);
      });
    }

    structuredOutput.appendChild(card);
  });
}

function parseAmount(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function applyFiltersAndSorting() {
  let txs = Array.isArray(allTransactions) ? [...allTransactions] : [];

  if (filterText) {
    const q = filterText.toLowerCase();
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

  if (heightFromFilter != null || heightToFilter != null) {
    txs = txs.filter((tx) => {
      const h = tx.mined_height;
      if (typeof h !== "number") return false;
      if (heightFromFilter != null && h < heightFromFilter) return false;
      if (heightToFilter != null && h > heightToFilter) return false;
      return true;
    });
  }

  txs.sort((a, b) => {
    switch (sortMode) {
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
}

function updatePaginationUI(total, totalPages) {
  if (total === 0) {
    paginationEl.style.display = "none";
    return;
  }

  if (showAll || total > pageSize) {
    paginationEl.style.display = "flex";
  } else {
    paginationEl.style.display = "none";
  }

  if (showAll) {
    pageInfo.textContent = `Showing all ${total} transactions`;
    firstPageBtn.disabled = true;
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    lastPageBtn.disabled = true;
    pageSizeSelect.disabled = true;
  } else {
    pageSizeSelect.disabled = false;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    firstPageBtn.disabled = currentPage === 1;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    lastPageBtn.disabled = currentPage === totalPages;
  }
}

function renderTransactionsPage() {
  const filtered = applyFiltersAndSorting();
  const total = filtered.length;

  if (total === 0) {
    renderTransactions([]);
    paginationEl.style.display = "none";
    return;
  }

  if (showAll) {
    renderTransactions(filtered);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    updatePaginationUI(total, totalPages);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * pageSize;
  const pageTxs = filtered.slice(startIndex, startIndex + pageSize);
  renderTransactions(pageTxs);
  updatePaginationUI(total, totalPages);
}

// pagination listeners
firstPageBtn.addEventListener("click", () => {
  if (!showAll && currentPage !== 1) {
    currentPage = 1;
    renderTransactionsPage();
  }
});

prevPageBtn.addEventListener("click", () => {
  if (!showAll && currentPage > 1) {
    currentPage--;
    renderTransactionsPage();
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.max(
    1,
    Math.ceil(applyFiltersAndSorting().length / pageSize)
  );
  if (!showAll && currentPage < totalPages) {
    currentPage++;
    renderTransactionsPage();
  }
});

lastPageBtn.addEventListener("click", () => {
  if (!showAll) {
    const totalPages = Math.max(
      1,
      Math.ceil(applyFiltersAndSorting().length / pageSize)
    );
    if (currentPage !== totalPages) {
      currentPage = totalPages;
      renderTransactionsPage();
    }
  }
});

pageSizeSelect.addEventListener("change", (e) => {
  const val = Number(e.target.value);
  pageSize = Number.isFinite(val) && val > 0 ? val : DEFAULT_PAGE_SIZE;
  currentPage = 1;
  renderTransactionsPage();
});

showAllCheckbox.addEventListener("change", (e) => {
  showAll = e.target.checked;
  renderTransactionsPage();
});

// filters
filterInput.addEventListener("input", (e) => {
  filterText = e.target.value.trim();
  currentPage = 1;
  renderTransactionsPage();
});

heightFromInput.addEventListener("input", (e) => {
  const val = e.target.value.trim();
  const num = Number(val);
  heightFromFilter = val === "" || !Number.isFinite(num) ? null : num;
  currentPage = 1;
  renderTransactionsPage();
});

heightToInput.addEventListener("input", (e) => {
  const val = e.target.value.trim();
  const num = Number(val);
  heightToFilter = val === "" || !Number.isFinite(num) ? null : num;
  currentPage = 1;
  renderTransactionsPage();
});

sortSelect.addEventListener("change", (e) => {
  sortMode = e.target.value;
  currentPage = 1;
  renderTransactionsPage();
});

toggleRawBtn.addEventListener("click", () => {
  const visible = rawOutputWrapper.style.display !== "none";
  rawOutputWrapper.style.display = visible ? "none" : "block";
  toggleRawBtn.textContent = visible ? "Show raw text" : "Hide raw text";
});

// === export helpers ===================================================

function triggerDownload(filename, mimeType, content) {
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

function baseFilename(ext) {
  const slug = lastResultMeta?.slug || "zcash-view";
  const birthday =
    lastResultMeta?.birthday != null ? String(lastResultMeta.birthday) : "";
  const safe = birthday ? `${slug}_${birthday}` : slug;
  return `${safe}.${ext}`;
}

copyRawBtn.addEventListener("click", async () => {
  const text = rawOutput.textContent || "";
  if (!text.trim()) {
    alert("No raw export available yet.");
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error("clipboard unavailable");
    }
    const original = copyRawBtn.textContent;
    copyRawBtn.textContent = "Copied";
    setTimeout(() => {
      copyRawBtn.textContent = original;
    }, 1500);
  } catch {
    alert(
      "Clipboard copy failed. You can select and copy the raw text manually."
    );
  }
});

downloadRawFullBtn.addEventListener("click", () => {
  const text = rawOutput.textContent || "";
  if (!text.trim()) {
    alert("No raw export available yet.");
    return;
  }

  const slug = lastResultMeta?.slug || "zcash-view";
  const birthday =
    lastResultMeta?.birthday != null ? String(lastResultMeta.birthday) : "";
  const filename = birthday ? `${slug}_${birthday}_raw.txt` : `${slug}_raw.txt`;

  triggerDownload(filename, "text/plain;charset=utf-8", text);
});

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value).replace(/\r?\n|\r/g, " ");
  if (/[",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsvFromTransactions(txs) {
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

downloadCsvBtn.addEventListener("click", () => {
  const exportTxs = applyFiltersAndSorting();
  if (!exportTxs.length) {
    alert("No transactions match the current filters to export.");
    return;
  }
  const csv = buildCsvFromTransactions(exportTxs);
  triggerDownload(baseFilename("csv"), "text/csv;charset=utf-8", csv);
});

downloadJsonBtn.addEventListener("click", () => {
  const exportTxs = applyFiltersAndSorting();
  if (!exportTxs.length) {
    alert("No transactions match the current filters to export.");
    return;
  }

  const payload = {
    wallet_name: lastResultMeta?.wallet_name ?? null,
    birthday: lastResultMeta?.birthday ?? null,
    slug: lastResultMeta?.slug ?? null,
    transactions: exportTxs,
  };

  const json = JSON.stringify(payload, null, 2);
  triggerDownload(
    baseFilename("json"),
    "application/json;charset=utf-8",
    json
  );
});

// === error prettifier =================================================

function prettifyErrorMessage(raw) {
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

// === form submit + job polling =======================================

vkForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const viewKey = viewKeyInput.value.trim();
  const birthday = birthdayInput.value.trim();
  const walletName = walletNameInput.value.trim() || "webwallet";

  if (!viewKey || !birthday) {
    setStatus("Please provide both a viewing key and a birthday height.", true);
    return;
  }

  if ("Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (err) {
      console.warn("Notification permission request failed:", err);
    }
  }

  setPresetStatus("");

  outputSection.style.display = "none";
  startBtn.disabled = true;
  viewKeyInput.disabled = true;
  birthdayInput.disabled = true;

  // reset state
  allTransactions = [];
  currentPage = 1;
  pageSize = DEFAULT_PAGE_SIZE;
  showAll = false;
  filterText = "";
  sortMode = "height_desc";
  heightFromFilter = null;
  heightToFilter = null;

  filterInput.value = "";
  heightFromInput.value = "";
  heightToInput.value = "";
  sortSelect.value = "height_desc";

  paginationEl.style.display = "none";
  pageInfo.textContent = "";
  pageSizeSelect.value = String(DEFAULT_PAGE_SIZE);
  showAllCheckbox.checked = false;

  setStatus("Starting wallet sync...");
  showProgress();
  startTips();
  updateSteps(0);

  try {
    const startRes = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        view_key: viewKey,
        birthday: Number(birthday),
        wallet_name: walletName,
      }),
    });
    const startData = await startRes.json();

    if (!startRes.ok || startData.status !== "ok") {
      const raw = startData.error || "Failed to start sync";
      throw new Error(prettifyErrorMessage(raw));
    }

    const jobId = startData.job_id;
    setStatus("Sync running in background. Please wait...");
    updateSteps(10);

    const pollInterval = setInterval(async () => {
      try {
        const pollRes = await fetch(`/api/job/${jobId}`);
        const pollData = await pollRes.json();

        if (pollData.status === "pending") {
          updateProgress(
            pollData.progress,
            pollData.message,
            pollData.elapsed
          );
        } else if (pollData.status === "error") {
          clearInterval(pollInterval);
          hideProgress();
          stopTips();

          const friendly = prettifyErrorMessage(
            pollData.error || "unknown error"
          );
          setStatus(friendly, true);

          startBtn.disabled = false;
          viewKeyInput.disabled = false;
          birthdayInput.disabled = false;
          updateSteps(0);
        } else if (pollData.status === "ok") {
          clearInterval(pollInterval);
          hideProgress();
          stopTips();

          allTransactions = pollData.transactions || [];
          currentPage = 1;

          lastResultMeta = {
            wallet_name: pollData.wallet_name ?? null,
            birthday: pollData.birthday ?? null,
            slug: pollData.slug ?? null,
          };

          const txCount = allTransactions.length;
          outputMeta.textContent = ` · ${txCount} tx`;
          renderTransactionsPage();
          rawOutput.textContent = pollData.raw_text || "";
          outputSection.style.display = "block";

          setStatus("Done. Transactions loaded.");
          updateSteps(100);
          maybeNotifyDone(txCount);

          startBtn.disabled = false;
          viewKeyInput.disabled = false;
          birthdayInput.disabled = false;
        }
      } catch (pollErr) {
        clearInterval(pollInterval);
        setStatus("Error checking job status: " + pollErr.message, true);
        startBtn.disabled = false;
        viewKeyInput.disabled = false;
        birthdayInput.disabled = false;
        hideProgress();
        stopTips();
        updateSteps(0);
      }
    }, 2000);
  } catch (err) {
    const friendly = prettifyErrorMessage(err.message);
    setStatus(friendly, true);
    hideProgress();
    stopTips();
    startBtn.disabled = false;
    viewKeyInput.disabled = false;
    birthdayInput.disabled = false;
    updateSteps(0);
  }
});

// === boot =============================================================

function boot() {
  initPresetUI();
  refreshHeight();

  if (!DEMO_VIEW_KEY.includes("PASTE_YOUR")) {
    viewKeyInput.value = DEMO_VIEW_KEY;
    birthdayInput.value = DEMO_BIRTHDAY;
  }
}

boot();
