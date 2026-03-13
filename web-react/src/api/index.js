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

// Fetch expenses, optionally filtered by year
export async function fetchAllExpenses(force = false, year = null) {
    const now = Date.now();
    
    // 1. Return cache if still valid and not forced
    if (!force && _expensesCache && (now - _expensesAge < CACHE_TTL)) {
        if (!year) return _expensesCache;
        return _expensesCache.filter(e => String(e.expense_date || '').startsWith(String(year)));
    }
    
    // 2. Optimization: If we have a valid cache but it's older than TTL, 
    // we still might want to return it quickly and refresh in background, 
    // but for now let's just fetch if force is true or cache is old.
    
    const PAGE = 1000;
    let offset = 0;
    let allRows = [];
    
    // If we are forcing a refresh but ONLY for a specific year, we could optimize the API call,
    // but to keep the global cache consistent, we'll fetch all.
    // However, if the user has TONS of data, we should probably only fetch the year requested.
    // Let's compromise: if we're forcing and have a year, only fetch that year.
    
    const useYearFilter = force && year;

    while (true) {
        const queryParams = [`limit=${PAGE}`, `offset=${offset}`];
        if (useYearFilter) {
            queryParams.push(`start=${year}-01-01`);
            queryParams.push(`end=${year}-12-31`);
        }
        
        const data = await apiGet(`/expenses?${queryParams.join('&')}`);
        const rows = data.rows || [];
        allRows = allRows.concat(rows);
        
        if (rows.length === PAGE) {
            offset += PAGE;
        } else {
            break;
        }
    }

    // 3. Update global cache (only if we fetched everything)
    if (!useYearFilter) {
        _expensesCache = allRows;
        _expensesAge = now;
    }

    if (year && !useYearFilter) {
        return allRows.filter(e => String(e.expense_date || '').startsWith(String(year)));
    }
    return allRows;
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
