// API Data Fetching Service

export async function apiGet(path) {
    const r = await fetch("/api" + path, { credentials: "include" });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
}

export async function apiPatch(path, payload) {
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

export async function apiPost(path, payload) {
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

export async function apiDelete(path) {
    const r = await fetch("/api" + path, {
        method: "DELETE",
        credentials: "include"
    });
    if (!r.ok) {
        let msg = `${r.status} ${r.statusText}`;
        try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (_) { }
        throw new Error(msg);
    }
    return r.json();
}

// Utility to fetch ALL expenses across all pages (handles large datasets)
export async function fetchAllExpenses() {
    const PAGE = 2000;
    let offset = 0;
    let allRows = [];
    while (true) {
        const data = await apiGet(`/expenses?limit=${PAGE}&offset=${offset}`);
        const rows = data.rows || [];
        allRows = allRows.concat(rows);
        if (rows.length < PAGE) break; // last page reached
        offset += PAGE;
    }
    return allRows;
}

export async function fetchAllMileage(year) {
    const path = year ? `/mileage?year=${year}` : '/mileage';
    return apiGet(path);
}

// Global utility for formatting
export function formatMoney(cents) {
    const n = Number(cents || 0) / 100;
    const abs = Math.abs(n);
    const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? "-$" : "$") + s;
}

export function formatDate(d) {
    if (!d) return '';
    return String(d).slice(0, 10);
}
