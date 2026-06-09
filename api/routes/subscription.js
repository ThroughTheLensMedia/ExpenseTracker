const express = require("express");
const router = express.Router();

/**
 * GET /subscription/status
 * Returns the current user's subscription and license info
 */
router.get("/status", async (req, res) => {
    if (!req.sb || !req.user?.id) return res.status(401).json({ error: "Session required" });

    try {
        const { data, error } = await req.sb
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', req.user.id)
            .single();

        if (error) {
            // PGRST116: No results for .single()
            if (error.code === 'PGRST116') return res.json(null);
            console.error("[Subscription] DB Error:", error.message);
            throw error;
        }

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /subscription/validate-code/:code
 * Public — no auth required. Checks if a beta code is valid without redeeming it.
 */
router.get("/validate-code/:code", async (req, res) => {
    const { supabase: serviceClient } = require("../db");
    if (!serviceClient) return res.status(500).json({ valid: false, reason: "Server error" });

    try {
        const code = (req.params.code || '').toUpperCase().trim();
        if (!code) return res.status(400).json({ valid: false, reason: "Code required" });

        const { data, error } = await serviceClient
            .from('beta_codes')
            .select('code, plan_type, valid_until, is_used')
            .eq('code', code)
            .single();

        if (error || !data) return res.json({ valid: false, reason: "Invalid code" });
        if (data.is_used) return res.json({ valid: false, reason: "Code has already been redeemed" });
        if (data.valid_until && new Date(data.valid_until) < new Date()) {
            return res.json({ valid: false, reason: "Code has expired" });
        }

        res.json({ valid: true, plan_type: data.plan_type || 'beta_tester' });
    } catch (e) {
        res.status(500).json({ valid: false, reason: "Server error" });
    }
});

/**
 * POST /subscription/redeem
 * Redeems a beta code to extend access
 * Body: { code }
 */
router.post("/redeem", async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Code required" });

        // 1. Validate the code
        const { data: betaCode, error: codeError } = await req.sb
            .from('beta_codes')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('is_used', false)
            .single();

        if (codeError || !betaCode) {
            return res.status(400).json({ error: "Invalid or already used code" });
        }

        // 2. Check expiration of the code itself
        if (betaCode.valid_until && new Date(betaCode.valid_until) < new Date()) {
            return res.status(400).json({ error: "Code has expired" });
        }

        // 3. Mark code as used (ATOMICALLY to prevent race conditions)
        const { data: finalCode, error: updateError } = await req.sb
            .from('beta_codes')
            .update({ 
                is_used: true, 
                used_by_email: req.user.email 
            })
            .eq('code', betaCode.code)
            .eq('is_used', false)
            .select()
            .single();
 
        if (updateError || !finalCode) {
            return res.status(409).json({ error: "Code was just claimed by another user." });
        }

        // 4. Update the user's subscription
        // For beta codes, we extend by 90 days or set to a specific date
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 90); // 90 days for beta testers

        const { data: updatedSub, error: subError } = await req.sb
            .from('user_subscriptions')
            .update({
                plan_type: betaCode.plan_type || 'beta_tester',
                status: 'active',
                email: req.user.email,
                display_name: betaCode.assigned_to_name || null,
                expires_at: newExpiry.toISOString(),
                beta_code_used: betaCode.code,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (subError) throw subError;

        res.json({ 
            success: true, 
            message: "Beta access granted! You now have 90 days of full studio access.",
            subscription: updatedSub
        });
    } catch (e) {
        console.error("[Redeem Error]", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
