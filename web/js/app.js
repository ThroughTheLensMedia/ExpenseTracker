// web/js/app.js

const tabs = ["dashboard", "transactions", "tax", "backup", "invoice"];
let ALL = [];
let selected = null;

function $(id) { return document.getElementById(id); }

function money(cents) {
    const n = Number(cents || 0) / 100;
    const abs = Math.abs(n);
    const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? "-$" : "$") + s;
}

function ymd(d) { return String(d || "").slice(0, 10); }

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function apiGet(path) {
    const r = await fetch("/api" + path, { credentials: "include" });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
}

async function apiPatch(path, payload) {
    const r = await fetch("/api" + path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
    });
    if (!r.ok) {
        let msg = `${r.status} ${r.statusText}`;
        try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (_) { }
        throw new Error(msg);
    }
    return r.json();
}

async function apiPost(path, payload) {
    const r = await fetch("/api" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
    });
    if (!r.ok) {
        let msg = `${r.status} ${r.statusText}`;
        try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (_) { }
        throw new Error(msg);
    }
    return r.json();
}

async function checkApi() {
    try {
        const r = await fetch("/api/health", { credentials: "include" });
        $("apiStatus").textContent = r.ok ? "API: OK" : "API: Down";
        $("apiStatus").className = "muted";
    } catch (_) {
        $("apiStatus").textContent = "API: Down";
        $("apiStatus").className = "muted";
    }
}

async function loadAllExpenses() {
    const data = await apiGet("/expenses?limit=10000&offset=0");
    ALL = data.rows || [];
}

function yearsFromData(rows) {
    const set = new Set();
    for (const r of rows) {
        const y = Number(String(r.expense_date || "").slice(0, 4));
        if (y) set.add(y);
    }
    const years = [...set].sort((a, b) => b - a);
    if (!years.length) years.push(2025);
    return years;
}

function initYearSelect() {
    const years = yearsFromData(ALL);
    const sel = $("yearSelect");
    const cur = Number(sel.value) || years[0];
    sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    sel.value = years.includes(cur) ? String(cur) : String(years[0]);
    sel.onchange = () => renderDashboard(Number(sel.value));
}

function initTaxYearSelect() {
    const years = yearsFromData(ALL);
    const sel = $("taxYearSelect");
    const cur = Number(sel.value) || years[0];
    sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    sel.value = years.includes(cur) ? String(cur) : String(years[0]);
}

function renderDashboard(year) {
    const q = ($("searchInput").value || "").trim().toLowerCase();
    let rows = ALL.filter(r => String(r.expense_date || "").startsWith(String(year)));
    if (q) {
        rows = rows.filter(r => {
            const hay = `${r.vendor || ""} ${r.category || ""} ${r.notes || ""}`.toLowerCase();
            return hay.includes(q);
        });
    }

    let income = 0, spend = 0, missing = 0;
    const byCat = new Map();
    const byVendor = new Map();

    for (const r of rows) {
        const cents = Number(r.amount_cents || 0);
        if (cents < 0) income += Math.abs(cents);
        else spend += cents;

        if (cents > 7500 && !r.receipt_link) missing++;

        if (cents > 0) {
            const c = r.category || "Uncategorized";
            const v = r.vendor || "Unknown";

            const cPrev = byCat.get(c) || { count: 0, cents: 0 };
            cPrev.count++; cPrev.cents += cents;
            byCat.set(c, cPrev);

            const vPrev = byVendor.get(v) || { count: 0, cents: 0 };
            vPrev.count++; vPrev.cents += cents;
            byVendor.set(v, vPrev);
        }
    }

    $("statIncome").textContent = "$" + (income / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $("statSpend").textContent = "$" + (spend / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $("statNet").textContent = "$" + ((income - spend) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $("statMissingReceipts").textContent = String(missing);

    const topCats = [...byCat.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 10);
    $("topCats").innerHTML = topCats.map(([k, meta]) => `
    <tr><td>${escapeHtml(k)}</td><td>${meta.count}</td><td>${money(meta.cents)}</td></tr>
  `).join("");

    const topV = [...byVendor.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 10);
    $("topVendors").innerHTML = topV.map(([k, meta]) => `
    <tr><td>${escapeHtml(k)}</td><td>${meta.count}</td><td>${money(meta.cents)}</td></tr>
  `).join("");
}

function typeTag(r) { return Number(r.amount_cents || 0) < 0 ? `<span class="tag ok">Income</span>` : `<span class="tag">Expense</span>`; }
function taxTag(r) { return r.tax_deductible ? `<span class="tag ok">Yes</span>` : `<span class="tag">No</span>`; }
function receiptTag(r) {
    const cents = Number(r.amount_cents || 0);
    if (r.receipt_link) return `<a class="tag ok" href="${r.receipt_link}" target="_blank" rel="noreferrer">View</a>`;
    if (cents > 7500) return `<span class="tag warn">Needed</span>`;
    return `<span class="tag">—</span>`;
}
function passesFilters(r, q, deductOnly) {
    const hay = `${r.vendor || ""} ${r.category || ""} ${r.notes || ""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (deductOnly && !r.tax_deductible) return false;
    return true;
}

function renderTransactions() {
    const start = ($("startDate").value || "").trim();
    const end = ($("endDate").value || "").trim();
    const q = ($("searchBox").value || "").trim().toLowerCase();
    const deductOnly = $("filterDeduct").checked;

    let rows = ALL.slice().sort((a, b) => (b.expense_date || "").localeCompare(a.expense_date || ""));
    if (start) rows = rows.filter(r => ymd(r.expense_date) >= start);
    if (end) rows = rows.filter(r => ymd(r.expense_date) <= end);
    rows = rows.filter(r => passesFilters(r, q, deductOnly));

    $("txnCount").textContent = `${rows.length.toLocaleString()} shown`;

    $("txnBody").innerHTML = rows.slice(0, 800).map(r => `
    <tr>
      <td>${ymd(r.expense_date)}</td>
      <td>${escapeHtml(r.vendor || "")}</td>
      <td>${escapeHtml(r.category || "")}</td>
      <td>${money(r.amount_cents)}</td>
      <td>${typeTag(r)}</td>
      <td>${taxTag(r)}</td>
      <td>${receiptTag(r)}</td>
      <td><button class="btn secondary" data-edit="${r.id}">Edit</button></td>
    </tr>
  `).join("");

    $("txnCards").innerHTML = rows.slice(0, 300).map(r => `
    <div class="txnCard">
      <div class="top">
        <div>
          <div class="vendor">${escapeHtml(r.vendor || "")}</div>
          <div class="muted">${ymd(r.expense_date)} · ${escapeHtml(r.category || "")}</div>
        </div>
        <div class="amt">${money(r.amount_cents)}</div>
      </div>
      <div style="margin-top:10px">${typeTag(r)} ${taxTag(r)} ${receiptTag(r)}</div>
      <div style="margin-top:10px">
        <button class="btn secondary" data-edit="${r.id}">Edit</button>
      </div>
    </div>
  `).join("");
}

function openEditor(id) {
    selected = ALL.find(x => String(x.id) === String(id));
    $("editMsg").textContent = "";
    if (!selected) return;

    $("drawer").classList.remove("hide");
    $("eDate").value = ymd(selected.expense_date);
    $("eVendor").value = selected.vendor || "";
    $("eCategory").value = selected.category || "";
    $("eAmount").value = (Number(selected.amount_cents || 0) / 100).toFixed(2);
    $("eDeduct").checked = !!selected.tax_deductible;
    $("eTaxBucket").value = selected.tax_bucket || "";
    $("eBizPct").value = (selected.business_use_pct === undefined || selected.business_use_pct === null) ? 100 : selected.business_use_pct;
    $("eNotes").value = selected.notes || "";
    $("eReceiptLink").value = selected.receipt_link || "";
    $("receiptFile").value = "";
}

function closeEditor() {
    $("drawer").classList.add("hide");
    selected = null;
}

async function saveEditor() {
    if (!selected) return;
    $("editMsg").textContent = "Saving…";
    try {
        const payload = {
            expense_date: $("eDate").value.trim(),
            vendor: $("eVendor").value.trim(),
            category: $("eCategory").value.trim(),
            amount_cents: Math.round(Number($("eAmount").value || 0) * 100),
            tax_deductible: $("eDeduct").checked,
            tax_bucket: $("eTaxBucket").value.trim(),
            business_use_pct: Number($("eBizPct").value || 100),
            notes: $("eNotes").value.trim(),
            receipt_link: $("eReceiptLink").value.trim() || null
        };

        const updated = await apiPatch(`/expenses/${selected.id}`, payload);

        const idx = ALL.findIndex(x => Number(x.id) === Number(updated.id));
        if (idx >= 0) ALL[idx] = updated;

        $("editMsg").textContent = "Saved.";
        renderTransactions();
        renderDashboard(Number($("yearSelect").value));
        loadTaxSummary();
    } catch (e) {
        $("editMsg").textContent = `Save failed: ${e.message}`;
    }
}

async function uploadReceipt() {
    if (!selected) return;
    const file = $("receiptFile").files[0];
    if (!file) { $("editMsg").textContent = "Choose a file first."; return; }

    $("editMsg").textContent = "Uploading…";
    try {
        const fd = new FormData();
        fd.append("file", file);

        const r = await fetch(`/api/receipts/${selected.id}`, { // Updated route to match backend refactor
            method: "POST",
            credentials: "include",
            body: fd
        });
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error((j && j.error) ? j.error : `${r.status} ${r.statusText}`);
        }

        const updated = await r.json();
        const idx = ALL.findIndex(x => Number(x.id) === Number(updated.id));
        if (idx >= 0) ALL[idx] = updated;

        $("editMsg").textContent = "Receipt uploaded.";
        renderTransactions();
        renderDashboard(Number($("yearSelect").value));
        loadTaxSummary();
    } catch (e) {
        $("editMsg").textContent = `Upload failed: ${e.message}`;
    }
}

function exportCsv() {
    const start = ($("startDate").value || "").trim();
    const end = ($("endDate").value || "").trim();
    const qs = new URLSearchParams();
    if (start) qs.set("start", start);
    if (end) qs.set("end", end);

    const url = `/api/expenses/export.csv${qs.toString() ? '?' + qs.toString() : ''}`;
    window.open(url, "_blank");
}

async function importRocketMoneyCsv(file) {
    if (!file) { $("rmMsg").textContent = "Choose a CSV file first."; return; }
    $("rmMsg").textContent = "Importing…";
    $("rmErrorsWrap").classList.add("hide");
    $("rmErrors").innerHTML = "";

    try {
        const fd = new FormData();
        fd.append("file", file);

        const r = await fetch("/api/import/rocketmoney", {
            method: "POST",
            credentials: "include",
            body: fd
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((data && data.error) ? data.error : `${r.status} ${r.statusText}`);

        const ins = Number(data.inserted || 0), upd = Number(data.updated || 0), sk = Number(data.skipped || 0);
        $("rmMsg").textContent = `Done—inserted ${ins.toLocaleString()}, updated ${upd.toLocaleString()}, skipped ${sk.toLocaleString()}.`;

        if (Array.isArray(data.errors) && data.errors.length) {
            $("rmErrorsWrap").classList.remove("hide");
            $("rmErrors").innerHTML = data.errors.slice(0, 200).map(e => `
        <tr><td>${e.row}</td><td>${escapeHtml(e.error)}</td></tr>
      `).join("");
        }

        await loadAllExpenses();
        initYearSelect();
        initTaxYearSelect();
        renderDashboard(Number($("yearSelect").value));
        renderTransactions();
        loadTaxSummary();
    } catch (e) {
        $("rmMsg").textContent = `Import failed: ${e.message}`;
    }
}

async function loadTaxSummary() {
    try {
        const year = Number($("taxYearSelect").value) || 2025;
        const data = await apiGet(`/tax/summary?year=${encodeURIComponent(year)}`);
        const rows = data.totals || [];
        $("taxSummaryBody").innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.tax_bucket)}</td>
        <td>${Number(r.count || 0).toLocaleString()}</td>
        <td>${money(r.spend_cents || 0)}</td>
        <td>${money(r.deductible_cents || 0)}</td>
      </tr>
    `).join("");
    } catch (_) {
        $("taxSummaryBody").innerHTML = "";
    }
}

function initBulkCategory() {
    const year = Number($("taxYearSelect").value) || 2025;
    const cats = new Map();
    for (const r of ALL) {
        if (!String(r.expense_date || "").startsWith(String(year))) continue;
        const c = (r.category || "").trim();
        if (!c) continue;
        cats.set(c, (cats.get(c) || 0) + 1);
    }
    const list = [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ c, n }));
    $("bulkCategory").innerHTML = list.map(x => `<option value="${escapeHtml(x.c)}">${escapeHtml(x.c)} (${x.n})</option>`).join("");
}

async function bulkApply() {
    $("bulkMsg").textContent = "Applying…";
    try {
        const year = Number($("taxYearSelect").value) || 2025;
        const category = $("bulkCategory").value;
        const tax_bucket = $("bulkBucket").value;
        const tax_deductible = $("bulkDeduct").checked;
        const business_use_pct = Number($("bulkPct").value || 100);

        const data = await apiPost("/tax/assign", { // Updated to match /tax/assign
            year, category, tax_bucket, tax_deductible, business_use_pct
        });

        $("bulkMsg").textContent = `Updated ${Number(data.updated || 0).toLocaleString()} transactions.`;

        await loadAllExpenses();
        initYearSelect();
        initTaxYearSelect();
        initBulkCategory();
        renderDashboard(Number($("yearSelect").value));
        renderTransactions();
        loadTaxSummary();
    } catch (e) {
        $("bulkMsg").textContent = `Apply failed: ${e.message}`;
    }
}

function exportTaxCsv() {
    const year = Number($("taxYearSelect").value) || 2025;
    window.open(`/api/tax/export.csv?year=${encodeURIComponent(year)}`, "_blank");
}

async function purgeCloudflare() {
    const msg = $("cfPurgeMsg");
    msg.textContent = "Purging…";
    try {
        // Add endpoint if we need it in api
        const r = await fetch("/api/admin/purge-cloudflare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ purge_everything: true })
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            const err = (data && (data.error || (data.cloudflare && data.cloudflare.errors && data.cloudflare.errors[0] && data.cloudflare.errors[0].message)))
                || `${r.status} ${r.statusText}`;
            throw new Error(err);
        }
        msg.textContent = "Purge requested. Hard refresh (Shift+Reload) if the UI still looks stale.";
    } catch (e) {
        msg.textContent = `Purge failed: ${e.message}`;
    }
}

function showTab(name) {
    for (const t of tabs) {
        $(`tab-${t}`).classList.toggle("hide", t !== name);
    }
    document.querySelectorAll("#nav .pill").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
    if (name === "tax") {
        initBulkCategory();
        loadTaxSummary();
    }
}

async function boot() {
    document.querySelectorAll("#nav .pill").forEach(btn => {
        btn.addEventListener("click", () => showTab(btn.getAttribute("data-tab")));
    });

    showTab("dashboard");

    await checkApi();
    setInterval(checkApi, 15000);

    $("refreshBtn").addEventListener("click", async () => {
        await loadAllExpenses();
        initYearSelect();
        initTaxYearSelect();
        renderDashboard(Number($("yearSelect").value));
        renderTransactions();
        initBulkCategory();
        loadTaxSummary();
    });

    $("reloadTxnsBtn").addEventListener("click", async () => {
        await loadAllExpenses();
        renderTransactions();
    });

    $("searchInput").addEventListener("input", () => renderDashboard(Number($("yearSelect").value)));
    $("searchBox").addEventListener("input", renderTransactions);
    $("filterDeduct").addEventListener("change", renderTransactions);

    $("exportBtn").addEventListener("click", exportCsv);

    $("closeBtn").addEventListener("click", closeEditor);
    $("drawer").addEventListener("click", (e) => {
        if (e.target === $("drawer")) closeEditor();
    });

    $("saveBtn").addEventListener("click", saveEditor);
    $("uploadReceiptBtn").addEventListener("click", uploadReceipt);

    $("txnBody").addEventListener("click", (e) => {
        const b = e.target.closest("[data-edit]");
        if (!b) return;
        openEditor(b.dataset.edit);
    });
    $("txnCards").addEventListener("click", (e) => {
        const b = e.target.closest("[data-edit]");
        if (!b) return;
        openEditor(b.dataset.edit);
    });

    const dz = $("rmDropZone");
    dz.addEventListener("click", () => $("rmCsvFile").click());
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
    dz.addEventListener("dragleave", () => { dz.classList.remove("drag"); });
    dz.addEventListener("drop", (e) => {
        e.preventDefault();
        dz.classList.remove("drag");
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) importRocketMoneyCsv(f);
    });
    $("rmCsvFile").addEventListener("change", () => {
        const f = $("rmCsvFile").files[0];
        if (f) $("rmMsg").textContent = `Selected: ${f.name}`;
    });
    $("rmImportBtn").addEventListener("click", () => {
        const f = $("rmCsvFile").files[0];
        importRocketMoneyCsv(f);
    });

    $("taxRefreshBtn").addEventListener("click", () => {
        initBulkCategory();
        loadTaxSummary();
    });
    $("taxExportBtn").addEventListener("click", exportTaxCsv);
    $("taxYearSelect").addEventListener("change", () => {
        initBulkCategory();
        loadTaxSummary();
    });
    $("bulkApplyBtn").addEventListener("click", bulkApply);

    const purgeBtn = $("cfPurgeBtn");
    if (purgeBtn) purgeBtn.addEventListener("click", purgeCloudflare);

    await loadAllExpenses();
    initYearSelect();
    initTaxYearSelect();

    renderDashboard(Number($("yearSelect").value));
    renderTransactions();
}

document.addEventListener("DOMContentLoaded", boot);
