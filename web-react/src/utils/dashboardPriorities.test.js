import test from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardPriorities, getSubscriptionStatusLabel } from './dashboardPriorities.js';

test('prioritizes overdue invoices, missing deductions, and recurring reviews', () => {
    const priorities = getDashboardPriorities({
        snapshot: { ytdSpend: 125000, ytdDeductibleCents: 0, mtdIncome: 200000, mtdSpend: 100000 },
        obligations: { overdueInvoices: 2, overdueCents: 45000, draftInvoices: 0, dueSoonCount: 0 },
        analytics: { recurringVendors: [{ flags: { review: true } }] },
    });

    assert.deepEqual(priorities.map(item => item.path), ['/crm/financials', '/tax', '/transactions']);
    assert.match(priorities[0].detail, /\$450/);
});

test('returns a calm state when current data has no urgent actions', () => {
    const priorities = getDashboardPriorities({
        snapshot: { ytdSpend: 100000, ytdDeductibleCents: 50000, mtdIncome: 200000, mtdSpend: 100000 },
        obligations: { overdueInvoices: 0, draftInvoices: 0, dueSoonCount: 0 },
        analytics: { recurringVendors: [] },
    }, 28);

    assert.equal(priorities.length, 1);
    assert.equal(priorities[0].tone, 'healthy');
    assert.match(priorities[0].detail, /28%/);
});

test('non-expiring subscriptions never display null days remaining', () => {
    assert.equal(getSubscriptionStatusLabel({ plan_type: 'free' }, null), 'FREE • ACTIVE');
    assert.equal(getSubscriptionStatusLabel({ plan_type: 'free_beta' }, 8), 'FREE BETA • 8D LEFT');
    assert.equal(getSubscriptionStatusLabel(null, null), 'INVITE REQUIRED');
});
