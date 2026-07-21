// Single source of truth for "is this row real spending or income" exclusion
// logic, shared by every route that rolls up financial totals (dashboard
// metrics, weekly digest, monthly report). Previously api/routes/cron.js had
// its own NON_SPEND_CATS/CC_PAYMENT_PATTERN while api/routes/metrics.js used
// a much narrower 5-keyword substring filter — the two disagreed on rows like
// "Refund" or "Reimbursement", producing different YTD totals on the
// dashboard vs. the weekly digest email for the same underlying data.

// Categories that are not true spending — exclude from all spend analysis.
const NON_SPEND_CATS = new Set([
    // Income
    'Photo Income', 'Freelance Income', 'Contract Income', 'Military Retirement',
    'VA Benefits', 'Rental Income', 'Side Income',
    // Misc Income / non-taxable / transfers
    'IRS Tax Refund', 'State Tax Refund', 'Refund', 'Reimbursement',
    'Cashback / Rewards', 'Interest Income', 'Dividend Income',
    'Internal Transfer', 'Credit Card Payment', 'Deposit',
]);

// Vendor name patterns that indicate a credit card payment or fund transfer.
const CC_PAYMENT_PATTERN = /\b(autopay|payment|epayment|pmt|e-payment|bill pay|epay|xfer|transfer|apple card|ach|wire)\b/i;

// Vendor substrings that identify a known recurring subscription, used
// alongside the per-transaction `is_subscription` flag. Shared by
// metrics.js (Subscriptions Radar widget) and cron.js (weekly digest
// upcoming-bills forecast) so both agree on what counts as a subscription.
const KNOWN_SUBSCRIPTION_VENDORS = ['adobe', 'netflix', 'hulu', 'spotify', 'apple', 'google workspace', 'squarespace', 'chatgpt', 'openai', 'amazon web services', 'aws'];

// True if a row (given its category and/or vendor) should be excluded from
// spend/income rollups — combines the category Set check and vendor pattern.
function isNonSpendRow(category, vendor) {
    if (NON_SPEND_CATS.has(category)) return true;
    if (vendor && CC_PAYMENT_PATTERN.test(vendor)) return true;
    return false;
}

module.exports = { NON_SPEND_CATS, CC_PAYMENT_PATTERN, KNOWN_SUBSCRIPTION_VENDORS, isNonSpendRow };
