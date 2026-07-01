// ─── Single source of truth for billing/tier logic on the frontend ─────────
// Mirrors api/routes/stripe.js — deriveTier and the Plaid-exempt list were
// previously duplicated independently in AuthContext.jsx and SaasTab.jsx and
// had drifted out of sync (the sync plan wasn't recognized in either copy).
// If billing rules change, update api/constants.js / api/routes/stripe.js
// AND this file — there is no automated way to share code across the
// frontend/backend boundary here, so keep the two in sync by hand.

// Joshua Deuermeyer (admin) + Michelle Gornichec — comped Plaid billing.
// Confirmed 2026-07-01: everyone else pays. Must match api/constants.js.
export const PLAID_EXEMPT_IDS = [
    '49e7efcb-6434-4f0c-9563-3151a6d50df9',
    'fcb92809-70f1-4ae0-b39c-e317378a01a7',
];

// Derives effective tier from plan_type + admin_tier override.
// admin_tier is set on the server for friends/family grants — no billing impact.
// 'monthly'/'annual' are legacy pre-rename plan_type values still present on a
// small number of old subscription rows — keep mapped to 'core'.
export function deriveTier(plan_type, admin_tier) {
    if (admin_tier === 'studio') return 'studio';
    if (admin_tier === 'core')   return 'core';
    if (['studio_monthly', 'studio_annual'].includes(plan_type)) return 'studio';
    if (['core_monthly', 'core_annual', 'monthly', 'annual'].includes(plan_type)) return 'core';
    if (['sync_monthly', 'sync_annual'].includes(plan_type)) return 'sync';
    return 'free';
}
