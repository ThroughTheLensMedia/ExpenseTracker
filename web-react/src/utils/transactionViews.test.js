import test from 'node:test';
import assert from 'node:assert/strict';
import {
    countActiveTransactionFilters,
    createSavedTransactionView,
    getQuickTransactionView,
    getTransactionViewsStorageKey,
    loadSavedTransactionViews,
} from './transactionViews.js';

test('invalid saved-view storage fails safely', () => {
    assert.deepEqual(loadSavedTransactionViews('{not-json'), []);
    assert.deepEqual(loadSavedTransactionViews(JSON.stringify({ views: [] })), []);
});

test('saved views are isolated by account on a shared browser', () => {
    assert.equal(getTransactionViewsStorageKey('user-a'), 'll_transaction_saved_views_v1:user-a');
    assert.notEqual(getTransactionViewsStorageKey('user-a'), getTransactionViewsStorageKey('user-b'));
});

test('saved views keep only supported filter fields', () => {
    const view = createSavedTransactionView('  Tax review  ', {
        deductOnly: true,
        searchVendor: 'Adobe',
        unsupported: 'ignore me',
    }, 'fixed-id');

    assert.deepEqual(view, {
        id: 'fixed-id',
        name: 'Tax review',
        filters: { deductOnly: true, searchVendor: 'Adobe' },
    });
});

test('quick views reset unrelated filters and apply the requested review state', () => {
    const today = new Date('2026-09-09T12:00:00Z');
    const missing = getQuickTransactionView('missing_receipts', today);
    const duplicates = getQuickTransactionView('possible_duplicates', today);

    assert.equal(missing.start, '2025-09-09');
    assert.equal(missing.end, '2026-09-09');
    assert.equal(missing.missingReceiptOnly, true);
    assert.equal(missing.searchVendor, '');
    assert.equal(duplicates.needsReviewOnly, true);
});

test('active-filter count ignores default values', () => {
    const defaults = getQuickTransactionView('recent', new Date('2026-09-09T12:00:00Z'));
    assert.equal(countActiveTransactionFilters(defaults, defaults), 0);
    assert.equal(countActiveTransactionFilters({ ...defaults, searchVendor: 'Adobe', deductOnly: true }, defaults), 2);
});
