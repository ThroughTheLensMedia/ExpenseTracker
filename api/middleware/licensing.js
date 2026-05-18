/**
 * SaaS Licensing Middleware
 * Verifies active subscription, derives tier (free/core/studio), attaches req.tier.
 * Feature limits enforced per-route using req.tier — see STRIPE_ROADMAP.md gate table.
 */
'use strict';

// Derives effective tier — admin_tier overrides billing (friends/family grants)
// admin_tier values: NULL | 'core' | 'studio'
// Set via: UPDATE user_subscriptions SET admin_tier = 'studio' WHERE user_id = '<uuid>';
function deriveTier(plan_type, admin_tier) {
    if (admin_tier === 'studio') return 'studio';
    if (admin_tier === 'core')   return 'core';
    if (['studio_monthly', 'studio_annual'].includes(plan_type)) return 'studio';
    if (['core_monthly',   'core_annual'  ].includes(plan_type)) return 'core';
    // free, free_beta, lifetime — all map to free tier
    return 'free';
}

// Tier limits — used by individual routes to enforce per-feature caps
const TIER_LIMITS = {
    free: {
        transactions_per_month: 500,
        invoices_per_month:     3,
        automation_rules:       5,
        crm_leads:              10,
        equipment_items:        5,
    },
    core: {
        transactions_per_month: 2000,
        invoices_per_month:     20,
        automation_rules:       25,
        crm_leads:              Infinity,
        equipment_items:        Infinity,
    },
    studio: {
        transactions_per_month: Infinity,
        invoices_per_month:     Infinity,
        automation_rules:       Infinity,
        crm_leads:              Infinity,
        equipment_items:        Infinity,
    },
};

async function licensingMiddleware(req, res, next) {
    // Skip for health checks
    if (req.path === '/health') return next();

    // Safety: auth middleware must have run first
    if (!req.user || !req.sb) return next();

    // Owner bypasses all licensing checks
    if (req.user?.email?.toLowerCase() === 'joshua.deuermeyer@gmail.com') {
        req.tier = 'studio';
        req.tierLimits = TIER_LIMITS.studio;
        return next();
    }

    try {
        const userId = req.user.id;

        const { data: sub, error } = await req.sb
            .from('user_subscriptions')
            .select('plan_type, admin_tier, status, expires_at')
            .eq('user_id', userId)
            .single();

        if (error || !sub) {
            // No subscription record — allow only redemption/status routes
            const allowedPaths = ['/subscription/status', '/subscription/redeem'];
            if (allowedPaths.includes(req.path)) return next();

            return res.status(402).json({
                error: 'Studio Access Required',
                message: 'A valid Beta or Professional access code is required to enter this studio.',
                code: 'CODE_REQUIRED',
            });
        }

        // Check expiry
        const now       = new Date();
        const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;

        if (sub.status === 'expired' || (expiresAt && now > expiresAt)) {
            if (req.method !== 'GET') {
                return res.status(402).json({
                    error: 'Subscription Expired',
                    message: 'Your studio access has expired. Please update your subscription or contact support.',
                    code: 'EXP_REQUIRED',
                });
            }
        }

        // Block suspended/canceled accounts
        if (sub.status === 'canceled' || sub.status === 'suspended') {
            return res.status(403).json({
                error: 'Account Locked',
                message: 'Your studio account has been suspended. Please contact support.',
            });
        }

        // Derive effective tier and attach to request
        const tier = deriveTier(sub.plan_type, sub.admin_tier);
        req.tier       = tier;
        req.tierLimits = TIER_LIMITS[tier];
        req.subscription = sub;

        next();
    } catch (err) {
        console.error('[Licensing Error]', err);
        // Fail-closed — never grant access on DB error
        return res.status(503).json({
            error: 'Service Temporarily Unavailable',
            message: 'Unable to verify your studio access. Please try again in a moment.',
            code: 'LICENSING_UNAVAILABLE',
        });
    }
}

module.exports = { licensingMiddleware, deriveTier, TIER_LIMITS };
