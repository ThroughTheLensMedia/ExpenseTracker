const express = require("express");
const router = express.Router();
const { supabase } = require("../db");
const { queueDailyReportEmail, queueHealthAlertEmail } = require("../utils/emailQueue");

function isCronAuthorized(req) {
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const isCronSecret = cronSecret && req.headers['authorization'] === `Bearer ${cronSecret}`;
    return isVercelCron || isCronSecret;
}

// GET /cron/daily-report
router.get("/daily-report", async (req, res) => {
    if (!isCronAuthorized(req)) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    try {
        if (!supabase) throw new Error("Supabase service client not initialized");

        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

        const { data: activityRows, error: actError } = await supabase
            .from('user_daily_activity')
            .select('user_id, total_minutes_active, last_pulse_at, activity_date')
            .gte('activity_date', sevenDaysAgo);

        if (actError) throw actError;

        if (!activityRows || !activityRows.length) {
            return res.json({ ok: true, sent: false, message: "No activity to report.", data: [] });
        }

        const userIds = [...new Set(activityRows.map(r => r.user_id))];
        let subRes = { data: [] }, profRes = { data: [] };

        try {
            const results = await Promise.all([
                supabase.from('user_subscriptions').select('*').in('user_id', userIds),
                supabase.from('profiles').select('*').in('id', userIds)
            ]);
            subRes = results[0];
            profRes = results[1];
        } catch (e) {
            console.warn("[CRON] Identity resolve failed (partial mode):", e);
        }

        const userMap = {};
        if (profRes?.data) profRes.data.forEach(p => { if (p.id) userMap[p.id] = { email: p.email, name: p.display_name }; });
        if (subRes?.data) subRes.data.forEach(u => {
            if (u.user_id) {
                const fallback = userMap[u.user_id]?.name || u.email?.split('@')[0];
                userMap[u.user_id] = { email: u.email, name: u.display_name || fallback };
            }
        });

        const mapping = {
            'joshua.deuermeyer@gmail.com': 'Joshua D.',
            '49e7efcb-6775-4927-9436-1e9674989669': 'Joshua D.',
            'f129a00b-333e-4d43-98b7-08ca1161d765': 'Joshua D.'
        };

        const reportData = activityRows.map(r => {
            const identity = userMap[r.user_id];
            const email = (identity?.email || 'unknown@studio.internal').toLowerCase();
            const name = mapping[email] || mapping[r.user_id] || identity?.name || email.split('@')[0] || "User";
            return { email, name, minutes_today: r.total_minutes_active || 0, last_seen: r.last_pulse_at || new Date().toISOString() };
        });

        const aggregated = {};
        reportData.forEach(item => {
            if (!aggregated[item.email]) {
                aggregated[item.email] = { ...item };
            } else {
                aggregated[item.email].minutes_today += item.minutes_today;
                if (new Date(item.last_seen) > new Date(aggregated[item.email].last_seen)) {
                    aggregated[item.email].last_seen = item.last_seen;
                }
            }
        });

        const finalData = Object.values(aggregated).sort((a, b) => b.minutes_today - a.minutes_today);

        queueDailyReportEmail({ to: 'joshua.deuermeyer@gmail.com', activityRows: finalData }).catch(err => {
            console.error("[CRON] Daily report email failed:", err);
        });

        res.json({ ok: true, sent: true, usersReported: finalData.length, data: finalData });
    } catch (e) {
        console.error("[CRON] Daily report fatal error:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET /cron/watchdog
router.get("/watchdog", async (req, res) => {
    if (!isCronAuthorized(req)) {
        return res.status(403).json({ error: "Unauthorized. Watchdog must be invoked via cron." });
    }

    const issues = [];

    const hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SERVICE_ROLE_KEY);
    if (!hasServiceKey) issues.push("CRITICAL: Supabase Service Role Key missing.");

    if (supabase) {
        try {
            const { error } = await supabase.from('profiles').select('id').limit(1);
            if (error) throw error;
        } catch (err) {
            issues.push(`DATABASE ERROR: ${err.message}`);
        }
    } else {
        issues.push("DATABASE ERROR: Supabase client failed to initialize.");
    }

    if (!process.env.RESEND_API_KEY) issues.push("SMTP ERROR: RESEND_API_KEY missing.");

    if (issues.length > 0) {
        console.error("[WATCHDOG] Issues:", issues);
        if (process.env.RESEND_API_KEY) {
            queueHealthAlertEmail({ to: 'joshua.deuermeyer@gmail.com', issues }).catch(err => {
                console.error("[WATCHDOG] Email failed:", err);
            });
        }
        return res.status(500).json({ ok: false, status: "DEGRADED", issues });
    }

    return res.json({ ok: true, status: "HEALTHY", issues: [] });
});

module.exports = router;
