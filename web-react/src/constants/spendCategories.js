// ─── Single source of truth for "is this row income / a transfer / real spend" ──
// Mirrors api/utils/spendCategories.js. Kept as a hand-synced copy — there is
// no automated way to share code across the frontend/backend boundary here
// (see web-react/src/constants/billing.js for the same pattern).
//
// DRIFT WARNING: never write `amount_cents < 0` as a standalone "is this row
// income" check anywhere in the app. A negative amount also covers credit
// card payments, internal transfers, and deposits — none of those are real
// income. Always run the category through isNonIncomeRow() first. This is
// the same bug fixed in api/routes/cron.js's weekly digest (v7.23.1) that
// recurred in the monthly report and in the Transactions/TransactionDrawer
// UI (v7.23.2) because this file didn't exist yet for the frontend to import.
//
// If you add a new category to web-react/src/constants/categories.js that
// represents real income (money coming in) or a pure transfer (credit card
// payment, internal move between your own accounts), add it to INCOME_CATS
// or TRANSFER_CATS below AND to the matching sets in
// api/utils/spendCategories.js in the same commit. A category missing from
// both is silently treated as neither — it'll still sort as "Expense" on
// the frontend even though it's negative, which is safe (better to under-
// count income than over-count it), but the backend income totals will be
// wrong until it's added there too.

// Categories that are pure transfers — not real spend AND not real income.
export const TRANSFER_CATS = new Set(['Internal Transfer', 'Credit Card Payment', 'Deposit']);

// Vendor name patterns that indicate a credit card payment or fund transfer.
export const CC_PAYMENT_PATTERN = /\b(autopay|payment|epayment|pmt|e-payment|bill pay|epay|xfer|transfer|apple card|ach|wire)\b/i;

// True if a row should be excluded from INCOME rollups — only real transfers,
// never a real income category. Use this instead of a bare amount_cents < 0
// check anywhere a row needs to be labeled or summed as income.
export function isNonIncomeRow(category, vendor) {
    if (TRANSFER_CATS.has(category)) return true;
    if (vendor && CC_PAYMENT_PATTERN.test(vendor)) return true;
    return false;
}
