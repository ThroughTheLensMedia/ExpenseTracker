const express = require("express");
const router = express.Router();
const { supabase } = require("../db");
const { queueDailyReportEmail, queueMonthlyReportEmail, queueHealthAlertEmail } = require("../utils/emailQueue");

function isCronAuthorized(req) {
    const cronSecret = (process.env.CRON_SECRET || '').trim();
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

// GET /cron/monthly-report
// ?preview=1 → sends only to joshua.deuermeyer@gmail.com using his real data
// Normal (no preview) → sends to all users in profiles
router.get("/monthly-report", async (req, res) => {
    if (!isCronAuthorized(req)) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    const isPreview = req.query.preview === '1';
    const ADMIN_EMAIL = 'joshua.deuermeyer@gmail.com';
    const ADMIN_UUID = '49e7efcb-6434-4f0c-9563-3151a6d50df9';

    try {
        if (!supabase) throw new Error("Supabase service client not initialized");

        // Last month date range
        const now = new Date();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const monthName = lastMonthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const startStr = lastMonthStart.toISOString().split('T')[0];
        const endStr = lastMonthEnd.toISOString().split('T')[0];

        // 3-month average window (the 3 months before last month)
        const avgStart = new Date(now.getFullYear(), now.getMonth() - 4, 1);
        const avgEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
        const avgStartStr = avgStart.toISOString().split('T')[0];
        const avgEndStr = avgEnd.toISOString().split('T')[0];

        // Resolve user list
        let users = [];
        if (isPreview) {
            const { data: profile } = await supabase.from('profiles').select('id, email, display_name').eq('id', ADMIN_UUID).maybeSingle();
            users = [{ id: ADMIN_UUID, email: ADMIN_EMAIL, name: (profile?.display_name) || 'Joshua' }];
        } else {
            const { data: profiles, error: profErr } = await supabase
                .from('profiles')
                .select('id, email, display_name')
                .not('email', 'is', null);
            if (profErr) throw profErr;
            users = (profiles || []).filter(p => p.email).map(p => ({
                id: p.id,
                email: p.email,
                name: p.display_name || p.email.split('@')[0]
            }));
        }

        const results = [];
        for (const user of users) {
            try {
                const report = await buildMonthlyReport(supabase, user.id, startStr, endStr, avgStartStr, avgEndStr);

                // Skip users with no transactions last month
                if (report.totalSpendCents === 0 && report.totalIncomeCents === 0) {
                    results.push({ email: user.email, ok: false, skipped: true, reason: 'no transactions' });
                    continue;
                }

                const targetEmail = isPreview ? ADMIN_EMAIL : user.email;
                await queueMonthlyReportEmail({ to: targetEmail, name: user.name, monthName, isPreview, startStr, endStr, ...report });
                results.push({ email: targetEmail, ok: true });
            } catch (err) {
                console.error(`[CRON] Monthly report failed for ${user.email}:`, err);
                results.push({ email: user.email, ok: false, error: err.message });
            }
        }

        res.json({ ok: true, isPreview, month: monthName, dateRange: `${startStr} → ${endStr}`, sent: results.filter(r => r.ok).length, results });
    } catch (e) {
        console.error("[CRON] Monthly report fatal error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Categories that are not true spending — exclude from all spend analysis sections
const NON_SPEND_CATS = new Set([
    // Income
    'Photo Income', 'Freelance Income', 'Contract Income', 'Military Retirement',
    'VA Benefits', 'Rental Income', 'Side Income',
    // Misc Income / non-taxable / transfers
    'IRS Tax Refund', 'State Tax Refund', 'Refund', 'Reimbursement',
    'Cashback / Rewards', 'Interest Income', 'Dividend Income',
    'Internal Transfer', 'Credit Card Payment', 'Deposit',
]);

// Vendor name patterns that indicate a credit card payment or fund transfer
const CC_PAYMENT_PATTERN = /\b(autopay|payment|epayment|pmt|e-payment|bill pay|epay|xfer|transfer|apple card|ach|wire)\b/i;

async function buildMonthlyReport(supabase, userId, startStr, endStr, avgStartStr, avgEndStr) {
    const [{ data: lastMonth }, { data: avgMonths }] = await Promise.all([
        supabase.from('expenses').select('amount_cents, category, vendor, tax_deductible, expense_date')
            .eq('user_id', userId).gte('expense_date', startStr).lte('expense_date', endStr),
        supabase.from('expenses').select('amount_cents, category, vendor')
            .eq('user_id', userId).gte('expense_date', avgStartStr).lte('expense_date', avgEndStr)
    ]);

    const allLastMonth = (lastMonth || []).filter(r => (r.amount_cents || 0) > 0);
    const income       = (lastMonth || []).filter(r => (r.amount_cents || 0) < 0);

    // True spending rows — exclude non-spend categories for analysis sections
    const expenses     = allLastMonth.filter(r => !NON_SPEND_CATS.has(r.category));

    const totalSpendCents  = expenses.reduce((s, r) => s + r.amount_cents, 0);
    const totalIncomeCents = income.reduce((s, r) => s + Math.abs(r.amount_cents), 0);
    const netCents = totalIncomeCents - totalSpendCents;

    // Per-category spend — split out Uncategorized so it shows separately
    const catSpend = {};
    let uncategorizedCents = 0;
    let uncategorizedCount = 0;
    expenses.forEach(r => {
        if (!r.category || r.category === 'Uncategorized') {
            uncategorizedCents += r.amount_cents;
            uncategorizedCount++;
        } else {
            catSpend[r.category] = (catSpend[r.category] || 0) + r.amount_cents;
        }
    });

    const realSpendForPct = totalSpendCents; // includes uncategorized
    const topCategories = Object.entries(catSpend)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, cents]) => ({
            cat, cents,
            pct: realSpendForPct > 0 ? Math.round((cents / realSpendForPct) * 100) : 0
        }));

    // Per-category 3-month average — same exclusions
    const avgCatSpend = {};
    (avgMonths || []).filter(r => (r.amount_cents || 0) > 0 && !NON_SPEND_CATS.has(r.category)).forEach(r => {
        const cat = r.category || 'Uncategorized';
        if (cat !== 'Uncategorized') {
            avgCatSpend[cat] = (avgCatSpend[cat] || 0) + r.amount_cents;
        }
    });
    Object.keys(avgCatSpend).forEach(k => { avgCatSpend[k] = Math.round(avgCatSpend[k] / 3); });

    const avgTotalSpendCents = Object.values(avgCatSpend).reduce((s, v) => s + v, 0);

    // Biggest changes vs average — no non-spend, no uncategorized
    const allCats = new Set([...Object.keys(catSpend), ...Object.keys(avgCatSpend)]);
    const biggestChanges = Array.from(allCats)
        .map(cat => ({ cat, current: catSpend[cat] || 0, avg: avgCatSpend[cat] || 0, delta: (catSpend[cat] || 0) - (avgCatSpend[cat] || 0) }))
        .filter(c => Math.abs(c.delta) > 500)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 5);

    // Subscriptions itemized
    const subscriptionsList = expenses
        .filter(r => r.category === 'Subscriptions')
        .sort((a, b) => b.amount_cents - a.amount_cents)
        .map(r => ({ vendor: r.vendor || 'Unknown', cents: r.amount_cents }));
    const subsCents = subscriptionsList.reduce((s, r) => s + r.cents, 0);

    // Largest single transactions — exclude non-spend + CC payment vendor patterns
    const largestTransactions = [...expenses]
        .filter(r => r.category !== 'Subscriptions' || true) // keep all real expenses
        .filter(r => !CC_PAYMENT_PATTERN.test(r.vendor || ''))
        .sort((a, b) => b.amount_cents - a.amount_cents)
        .slice(0, 5)
        .map(r => ({ vendor: r.vendor || 'Unknown', category: r.category || 'Uncategorized', cents: r.amount_cents, date: r.expense_date }));

    // Tax-deductible total
    const taxDeductibleCents = expenses.filter(r => r.tax_deductible).reduce((s, r) => s + r.amount_cents, 0);

    // Top vendors — exclude non-spend and CC payment patterns
    const vendorSpend = {};
    expenses.filter(r => !CC_PAYMENT_PATTERN.test(r.vendor || '')).forEach(r => {
        const v = r.vendor || 'Unknown';
        vendorSpend[v] = (vendorSpend[v] || 0) + r.amount_cents;
    });
    const topVendors = Object.entries(vendorSpend)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([vendor, cents]) => ({ vendor, cents }));

    // New vendors — appeared last month but not in prior 3-month window (excluding payments)
    const avgVendorSet = new Set(
        (avgMonths || [])
            .filter(r => (r.amount_cents || 0) > 0 && !NON_SPEND_CATS.has(r.category))
            .map(r => (r.vendor || '').toLowerCase())
    );
    const newVendors = Object.entries(vendorSpend)
        .filter(([v]) => v !== 'Unknown' && !avgVendorSet.has(v.toLowerCase()))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([vendor, cents]) => ({ vendor, cents }));

    return {
        totalSpendCents, totalIncomeCents, netCents, avgTotalSpendCents,
        topCategories, biggestChanges,
        subscriptionsList, subsCents,
        largestTransactions,
        uncategorizedCount, uncategorizedCents,
        taxDeductibleCents,
        topVendors,
        newVendors
    };
}

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
