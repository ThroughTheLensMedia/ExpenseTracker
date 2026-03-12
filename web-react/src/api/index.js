// API Data Fetching Service (SaaS Authenticated Version)
import { supabase } from '../components/AuthContext';

async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

export async function apiGet(path) {
    const headers = await getAuthHeaders();
    const r = await fetch("/api" + path, { 
        headers: { 'Authorization': headers.Authorization },
        credentials: "include" 
    });
    if (!r.ok) {
        if (r.status === 401) {
             // Session expired - could trigger a logout/redirect here if needed
        }
        throw new Error(`${r.status} ${r.statusText}`);
    }
    return r.json();
}

export async function apiPatch(path, payload) {
    const headers = await getAuthHeaders();
    const r = await fetch("/api" + path, {
        method: "PATCH",
        headers,
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
    const headers = await getAuthHeaders();
    const r = await fetch("/api" + path, {
        method: "POST",
        headers,
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
    const headers = await getAuthHeaders();
    const r = await fetch("/api" + path, {
        method: "DELETE",
        headers: { 'Authorization': headers.Authorization },
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

// Fetch ALL expenses by paginating in batches of 1000
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
        if (rows.length < PAGE) break;
        offset += PAGE;
    }

    _expensesCache = allRows;
    _expensesAge = Date.now();
    return [...allRows];
}

export function invalidateExpensesCache() {
    _expensesCache = null;
    _expensesAge = 0;
}

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
