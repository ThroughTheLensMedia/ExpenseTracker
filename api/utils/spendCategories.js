// Single source of truth for "is this row real spending or income" exclusion
// logic, shared by every route that rolls up financial totals (dashboard
// metrics, weekly digest, monthly report). Previously api/routes/cron.js had
// its own NON_SPEND_CATS/CC_PAYMENT_PATTERN while api/routes/metrics.js used
// a much narrower 5-keyword substring filter — the two disagreed on rows like
// "Refund" or "Reimbursement", producing different YTD totals on the
// dashboard vs. the weekly digest email for the same underlying data.

// Categories that represent real income — never exclude these from income
// rollups. (They ARE excluded from spend rollups — see NON_SPEND_CATS below.)
const INCOME_CATS = new Set([
    'Photo Income', 'Freelance Income', 'Contract Income', 'Military Retirement',
    'VA Benefits', 'Rental Income', 'Side Income',
    'IRS Tax Refund', 'State Tax Refund', 'Refund', 'Reimbursement',
    'Cashback / Rewards', 'Interest Income', 'Dividend Income',
]);

// Categories that are pure transfers — not real spend AND not real income.
// Exclude these from both rollups.
const TRANSFER_CATS = new Set(['Internal Transfer', 'Credit Card Payment', 'Deposit']);

// Categories that are not true spending — exclude from spend analysis only.
// (Bug fixed v7.23.1: this set was previously also used to exclude income
// rows from income totals, silently dropping real income — e.g. a Venmo
// payment categorized "Photo Income" — from the weekly digest and dashboard.
// See isNonIncomeRow() below for the income-side exclusion, which only
// excludes real transfers, not income categories.)
const NON_SPEND_CATS = new Set([...INCOME_CATS, ...TRANSFER_CATS]);

// Vendor name patterns that indicate a credit card payment or fund transfer.
const CC_PAYMENT_PATTERN = /\b(autopay|payment|epayment|pmt|pymt|e-payment|bill pay|epay|xfer|transfer|apple card|ach|wire)\b/i;

// Vendor substrings that identify a known recurring subscription, used
// alongside the per-transaction `is_subscription` flag. Shared by
// metrics.js (Subscriptions Radar widget) and cron.js (weekly digest
// upcoming-bills forecast) so both agree on what counts as a subscription.
const KNOWN_SUBSCRIPTION_VENDORS = ['adobe', 'netflix', 'hulu', 'spotify', 'apple', 'google workspace', 'squarespace', 'chatgpt', 'openai', 'amazon web services', 'aws'];

// True if a row (given its category and/or vendor) should be excluded from
// SPEND rollups — combines the category Set check and vendor pattern.
function isNonSpendRow(category, vendor) {
    if (NON_SPEND_CATS.has(category)) return true;
    if (vendor && CC_PAYMENT_PATTERN.test(vendor)) return true;
    return false;
}

// True if a row should be excluded from INCOME rollups — only real transfers,
// never a real income category (that's the whole fix — see NON_SPEND_CATS comment).
function isNonIncomeRow(category, vendor) {
    if (TRANSFER_CATS.has(category)) return true;
    if (vendor && CC_PAYMENT_PATTERN.test(vendor)) return true;
    return false;
}

module.exports = { NON_SPEND_CATS, INCOME_CATS, TRANSFER_CATS, CC_PAYMENT_PATTERN, KNOWN_SUBSCRIPTION_VENDORS, isNonSpendRow, isNonIncomeRow };
