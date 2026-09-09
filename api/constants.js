// ─── Single source of truth for cross-route identity/billing constants ─────
// Previously the admin UUID and the Plaid-exempt user list were hardcoded
// independently in api/routes/plaid.js, api/routes/stripe.js,
// api/middleware/auth.js, api/routes/intake.js, and api/routes/cron.js.
// Update values here only — every route imports from this file.
'use strict';

// Joshua Deuermeyer — owner/admin account.
const ADMIN_UUID = '49e7efcb-6434-4f0c-9563-3151a6d50df9';

// Michelle Gornichec — comped Plaid billing (gornichecme@gmail.com).
const MICHELLE_UUID = 'fcb92809-70f1-4ae0-b39c-e317378a01a7';

// Users exempt from Plaid billing — Joshua pays Plaid directly; Michelle is comped.
// Everyone else pays. Confirmed 2026-07-01: this list is exactly these two users.
const PLAID_BILLING_EXEMPT = new Set([ADMIN_UUID, MICHELLE_UUID]);

// Account-level product experience. Business remains the safe default for every
// existing account until the user explicitly chooses Personal mode.
const EXPERIENCE_MODES = Object.freeze({
    BUSINESS: 'business',
    PERSONAL: 'personal',
});
const VALID_EXPERIENCE_MODES = new Set(Object.values(EXPERIENCE_MODES));

function isValidExperienceMode(value) {
    return VALID_EXPERIENCE_MODES.has(value);
}

module.exports = {
    ADMIN_UUID,
    MICHELLE_UUID,
    PLAID_BILLING_EXEMPT,
    EXPERIENCE_MODES,
    isValidExperienceMode,
};
