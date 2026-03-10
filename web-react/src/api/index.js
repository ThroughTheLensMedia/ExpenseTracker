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

let _expensesCache = null;
let _expensesAge = 0;
const CACHE_TTL = 30000; // 30 seconds

// Fetch ALL expenses by paginating in batches of 1000 (Supabase hard-caps at 1000/page)
export async function fetchAllExpenses(force = false) {
    if (!force && _expensesCache && (Date.now() - _expensesAge < CACHE_TTL)) {
        return [..._expensesCache]; // return copy
    }

    const PAGE = 1000;
    let offset = 0;
    let allRows = [];
    while (true) {
        const data = await apiGet(`/expenses?limit=${PAGE}&offset=${offset}`);
        const rows = data.rows || [];
        allRows = allRows.concat(rows);
        if (rows.length < PAGE) break; // last page — fewer rows than page size means no more
        offset += PAGE;
    }

    _expensesCache = allRows;
    _expensesAge = Date.now();
    return [...allRows];
}

// Helper to invalidate the cache when user edits/adds data
export function invalidateExpensesCache() {
    _expensesCache = null;
    _expensesAge = 0;
}

// Lightweight: get just the distinct years that have data (for year dropdowns)
export async function fetchExpenseYears() {
    try {
        const data = await apiGet('/expenses/years');
        return data.years || [];
    } catch (_) {
        return [];
    }
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
