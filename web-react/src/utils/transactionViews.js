export const TRANSACTION_VIEWS_STORAGE_KEY = 'll_transaction_saved_views_v1';

export function getTransactionViewsStorageKey(userId) {
    return `${TRANSACTION_VIEWS_STORAGE_KEY}:${userId || 'anonymous'}`;
}

export const QUICK_TRANSACTION_VIEWS = Object.freeze([
    { id: 'recent', label: 'Recent activity' },
    { id: 'needs_category', label: 'Needs a category' },
    { id: 'missing_receipts', label: 'Missing receipts' },
    { id: 'possible_duplicates', label: 'Possible duplicates' },
    { id: 'deductible', label: 'Tax-deductible' },
]);

const ALLOWED_FILTER_KEYS = new Set([
    'start', 'end', 'searchVendor', 'searchCategory', 'searchNotes',
    'categoryNotesMatch', 'deductOnly', 'missingReceiptOnly', 'searchAccount',
    'plaidAccountId', 'plaidAccountName', 'plaidSourceKey', 'institutionFilter',
    'needsCategoryFilter', 'needsReviewOnly', 'sortCol', 'sortDir',
]);

export function sanitizeTransactionFilters(filters = {}) {
    return Object.fromEntries(Object.entries(filters).filter(([key, value]) =>
        ALLOWED_FILTER_KEYS.has(key) && ['string', 'boolean'].includes(typeof value)
    ));
}

export function loadSavedTransactionViews(rawValue) {
    if (!rawValue) return [];
    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(view => view && typeof view.id === 'string' && typeof view.name === 'string')
            .map(view => ({
                id: view.id,
                name: view.name.trim().slice(0, 40),
                filters: sanitizeTransactionFilters(view.filters),
            }))
            .filter(view => view.name)
            .slice(0, 10);
    } catch {
        return [];
    }
}

export function createSavedTransactionView(name, filters, id = `view-${Date.now()}`) {
    const cleanName = String(name || '').trim().slice(0, 40);
    if (!cleanName) return null;
    return { id, name: cleanName, filters: sanitizeTransactionFilters(filters) };
}

export function getQuickTransactionView(viewId, today = new Date()) {
    const end = new Date(today);
    const start = new Date(today);
    start.setDate(start.getDate() - (viewId === 'recent' ? 30 : 365));
    const base = {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
        searchVendor: '', searchCategory: '', searchNotes: '', categoryNotesMatch: 'and',
        deductOnly: false, missingReceiptOnly: false, searchAccount: '',
        plaidAccountId: '', plaidAccountName: '', plaidSourceKey: '', institutionFilter: '',
        needsCategoryFilter: false, needsReviewOnly: false,
        sortCol: 'expense_date', sortDir: 'desc',
    };

    if (viewId === 'needs_category') base.needsCategoryFilter = true;
    if (viewId === 'missing_receipts') base.missingReceiptOnly = true;
    if (viewId === 'possible_duplicates') base.needsReviewOnly = true;
    if (viewId === 'deductible') base.deductOnly = true;
    return base;
}

export function countActiveTransactionFilters(filters, defaults) {
    return Object.keys(sanitizeTransactionFilters(filters))
        .filter(key => filters[key] !== defaults[key])
        .length;
}
