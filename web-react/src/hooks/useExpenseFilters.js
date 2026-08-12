import { useMemo } from 'react';
import { formatDate } from '../api';

/**
 * Shared expense filtering & sorting hook.
 * Used by Transactions, Dashboard, and Tax pages.
 *
 * @param {Array} expenses - Raw expense rows
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.start] - Start date (YYYY-MM-DD)
 * @param {string} [filters.end] - End date (YYYY-MM-DD)
 * @param {string} [filters.vendor] - Vendor search (partial match)
 * @param {string} [filters.category] - Category search (partial match)
 * @param {string} [filters.account] - Source/account (exact match)
 * @param {string} [filters.institutionPrefix] - Institution name prefix — matches all sources starting with this string (e.g. "USAA" matches "USAA Checking", "USAA Savings")
 * @param {string} [filters.plaidAccountId] - Plaid sub-account ID (exact match on plaid_account_id)
 * @param {string} [filters.notes] - Notes search (partial match)
 * @param {boolean} [filters.deductOnly] - Only tax-deductible
 * @param {boolean} [filters.missingReceiptOnly] - Deductible + no receipt
 * @param {number|string} [filters.year] - Filter by year
 * @param {string} [filters.taxBucket] - Filter by tax bucket
 * @param {'and'|'or'} [filters.categoryNotesMatch] - When both category and notes are set, 'and' (default) requires both to match; 'or' matches either — useful for broad lookups like "Apollo" that might only be in one field, not both.
 * @param {string} [sortCol] - Column to sort by
 * @param {string} [sortDir] - 'asc' or 'desc'
 * @returns {{ filtered: Array, totals: { count: number, sum: number } }}
 */
export default function useExpenseFilters(expenses, filters = {}, sortCol = 'expense_date', sortDir = 'desc') {
    const filtered = useMemo(() => {
        let rows = [...expenses];
        const { start, end, vendor, category, account, plaidAccountId, notes, deductOnly, missingReceiptOnly, year, taxBucket, needsCategory, categoryNotesMatch } = filters;

        if (year) rows = rows.filter(r => String(r.expense_date || '').startsWith(String(year)));
        if (start) rows = rows.filter(r => formatDate(r.expense_date) >= start);
        if (end) rows = rows.filter(r => formatDate(r.expense_date) <= end);
        if (vendor) rows = rows.filter(r => (r.vendor || '').toLowerCase().includes(vendor.toLowerCase()));
        if (account) rows = rows.filter(r => (r.source || '') === account);
        // institutionPrefix: match all sources that start with the institution name (e.g. "USAA" → USAA Checking + USAA Savings)
        if (filters.institutionPrefix) rows = rows.filter(r => (r.source || '').toLowerCase().startsWith(filters.institutionPrefix.toLowerCase()));
        // plaidAccountId: match on stored plaid_account_id OR fall back to source match
        // (transactions imported before plaid_account_id column existed only have source set)
        if (plaidAccountId) rows = rows.filter(r =>
            r.plaid_account_id === plaidAccountId ||
            (!r.plaid_account_id && filters.plaidSourceKey && (r.source || '') === filters.plaidSourceKey)
        );

        // Category + Notes: AND (default) requires both to match when both are set;
        // OR matches either — lets a search like "Apollo" catch rows where the term
        // is only in the category OR only in the notes, not necessarily both.
        const categoryMatches = r => (r.category || '').toLowerCase().includes(category.toLowerCase());
        const notesMatches = r => (r.notes || '').toLowerCase().includes(notes.toLowerCase());
        if (category && notes) {
            rows = categoryNotesMatch === 'or'
                ? rows.filter(r => categoryMatches(r) || notesMatches(r))
                : rows.filter(r => categoryMatches(r) && notesMatches(r));
        } else if (category) {
            rows = rows.filter(categoryMatches);
        } else if (notes) {
            rows = rows.filter(notesMatches);
        }

        if (taxBucket) rows = rows.filter(r => (r.tax_bucket || '') === taxBucket);
        if (needsCategory) rows = rows.filter(r => !r.category || !String(r.category).trim());
        if (deductOnly) rows = rows.filter(r => r.tax_deductible);
        if (missingReceiptOnly) rows = rows.filter(r => !r.receipt_link && r.tax_deductible);

        rows.sort((a, b) => {
            let av = a[sortCol] ?? '';
            let bv = b[sortCol] ?? '';
            if (sortCol === 'amount_cents') { av = Number(av); bv = Number(bv); }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return rows;
    }, [expenses, filters, sortCol, sortDir]);

    const totals = useMemo(() => ({
        count: filtered.length,
        sum: filtered.reduce((acc, r) => acc + Number(r.amount_cents || 0), 0),
    }), [filtered]);

    return { filtered, totals };
}

/**
 * Extract unique values for filter dropdowns from a set of expenses.
 */
export function useFilterOptions(expenses, start, end) {
    const scopedRows = useMemo(() => {
        let rows = [...expenses];
        if (start) rows = rows.filter(r => formatDate(r.expense_date) >= start);
        if (end) rows = rows.filter(r => formatDate(r.expense_date) <= end);
        return rows;
    }, [expenses, start, end]);

    const vendors = useMemo(() => {
        const set = new Set();
        scopedRows.forEach(r => { if (r.vendor) set.add(r.vendor); });
        return [...set].sort();
    }, [scopedRows]);

    const accounts = useMemo(() => {
        const set = new Set();
        scopedRows.forEach(r => { if (r.source) set.add(r.source); });
        return [...set].sort();
    }, [scopedRows]);

    const categories = useMemo(() => {
        const set = new Set();
        scopedRows.forEach(r => { if (r.category) set.add(r.category); });
        return [...set].sort();
    }, [scopedRows]);

    return { vendors, accounts, categories, scopedRows };
}
