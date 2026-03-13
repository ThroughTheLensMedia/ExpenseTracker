/**
 * SaaS Licensing Middleware
 * This middleware checks if a user has an active subscription or valid beta access.
 */

async function licensingMiddleware(req, res, next) {
    // 1. Skip check for health or auth routes if needed
    if (req.path === '/health') return next();

    try {
        const userId = req.user.id;

        // Fetch subscription status from the database
        const { data: sub, error } = await req.sb
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !sub) {
            // STRICT MODE: If no subscription record exists, we require a code redemption.
            // Allow only the status and redeem routes to pass through so they can fix it
            const allowedPublicPaths = ['/subscription/status', '/subscription/redeem'];
            if (allowedPublicPaths.includes(req.path)) {
                return next();
            }

            return res.status(402).json({
                error: "Studio Access Required",
                message: "A valid Beta or Professional access code is required to enter this studio.",
                code: "CODE_REQUIRED"
            });
        }

        // 2. Check Expiration
        const now = new Date();
        const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;

        if (sub.status === 'expired' || (expiresAt && now > expiresAt)) {
            // Allow GET requests to view data (read-only mode), but block mutations
            if (req.method !== 'GET') {
                return res.status(402).json({
                    error: "Subscription Expired",
                    message: "Your studio access has expired. Please update your subscription or contact support.",
                    code: "EXP_REQUIRED"
                });
            }
        }

        // 3. Block inactive accounts entirely if wanted
        if (sub.status === 'canceled' || sub.status === 'suspended') {
            return res.status(403).json({
                error: "Account Locked",
                message: "Your studio account has been suspended. Please contact Joshua's Lane for support."
            });
        }

        // Attach subscription info to request for use in routes if needed
        req.subscription = sub;
        next();
    } catch (err) {
        console.error("[Licensing Error]", err);
        // Fallback to allowing access if the licensing system fails (fail-open)
        // or block it (fail-closed). For beta, fail-open is safer.
        next();
    }
}

module.exports = licensingMiddleware;
