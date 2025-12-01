// components.js
import { shortenKey, shortenTxid } from "./utils.js";

// ---- Status helpers ----
export function setStatus(statusEl, msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", !!isError);
}

export function setPresetStatus(el, msg) {
  if (el) el.textContent = msg || "";
}

// ---- Steps line ----
export function updateSteps(progress) {
  const stepsEl = document.getElementById("steps");
  if (!stepsEl) return;

  const pct = Math.max(0, Math.min(100, typeof progress === "number" ? progress : 0));

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

// ---- Progress bar ----
export function showProgress(wrapperEl) {
  if (wrapperEl) wrapperEl.style.display = "block";
}

export function hideProgress(wrapperEl) {
  if (wrapperEl) wrapperEl.style.display = "none";
}

export function updateProgressBar(progressBarEl, pct) {
  if (!progressBarEl) return;
  const clamped = Math.max(0, Math.min(100, pct || 0));
  progressBarEl.style.width = clamped + "%";
}

// ---- Preset cards ----
export function initPresetUI(presetRow, viewKeyInput, birthdayInput, presetStatusEl, presets, setStatusFn) {
  presets.forEach((preset) => {
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

      setStatusFn("");
      setPresetStatus(presetStatusEl, `Loaded ${preset.name}. Press “Start importing” to try it.`);
    });

    presetRow.appendChild(pill);
  });
}

// ---- Transactions list ----
export function renderTransactions(structuredOutput, txs) {
  structuredOutput.innerHTML = "";

  if (!txs || !txs.length) {
    const empty = document.createElement("div");
    empty.style.fontSize = "12px";
    empty.style.color = "#9ca3af";
    empty.textContent = "No transactions found for this key, height range, and filters.";
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

    if (metaRow.childNodes.length) {
      card.appendChild(metaRow);
    }

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

// ---- Pagination UI ----
export function updatePaginationUI({
  paginationEl,
  pageInfoEl,
  firstBtn,
  prevBtn,
  nextBtn,
  lastBtn,
  pageSizeSelect,
  total,
  totalPages,
  currentPage,
  showAll,
}) {
  if (total === 0) {
    paginationEl.style.display = "none";
    return;
  }

  if (showAll || total > Number(pageSizeSelect.value)) {
    paginationEl.style.display = "flex";
  } else {
    paginationEl.style.display = "none";
  }

  if (showAll) {
    pageInfoEl.textContent = `Showing all ${total} transactions`;
    firstBtn.disabled = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    lastBtn.disabled = true;
    pageSizeSelect.disabled = true;
  } else {
    pageSizeSelect.disabled = false;
    pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
    firstBtn.disabled = currentPage === 1;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    lastBtn.disabled = currentPage === totalPages;
  }
}
