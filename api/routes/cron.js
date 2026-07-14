const express = require("express");
const router = express.Router();
const { supabase } = require("../db");
const { queueDailyReportEmail, queueMonthlyReportEmail, queueHealthAlertEmail, queueWeeklyDigestEmail, queueReEngagementEmail } = require("../utils/emailQueue");
const { ADMIN_UUID } = require("../constants");
const { listAllUsers } = require("../utils/userDirectory");
const { NON_SPEND_CATS, CC_PAYMENT_PATTERN } = require("../utils/spendCategories");

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
        let subRes = { data: [] }, allUsers = [];

        try {
            const results = await Promise.all([
                supabase.from('user_subscriptions').select('*').in('user_id', userIds),
                listAllUsers(supabase),
            ]);
            subRes = results[0];
            allUsers = results[1].filter(u => userIds.includes(u.id));
        } catch (e) {
            console.warn("[CRON] Identity resolve failed (partial mode):", e);
        }

        const userMap = {};
        allUsers.forEach(p => { if (p.id) userMap[p.id] = { email: p.email, name: p.display_name }; });
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
// Normal (no preview) → sends to all users in Supabase Auth
router.get("/monthly-report", async (req, res) => {
    if (!isCronAuthorized(req)) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    const isPreview = req.query.preview === '1';
    const ADMIN_EMAIL = 'joshua.deuermeyer@gmail.com';

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
            const allUsers = await listAllUsers(supabase);
            const profile = allUsers.find(u => u.id === ADMIN_UUID);
            users = [{ id: ADMIN_UUID, email: ADMIN_EMAIL, name: profile?.display_name || 'Joshua' }];
        } else {
            const allUsers = await listAllUsers(supabase);
            users = allUsers.filter(p => p.email).map(p => ({
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

// NON_SPEND_CATS / CC_PAYMENT_PATTERN moved to ../utils/spendCategories.js
// (shared with metrics.js so the dashboard and this digest agree on totals).

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

// Builds the numbers for one user's weekly digest email — money in/out for the
// past 7 days, count of currently-missing receipts, and a YTD-based tax
// set-aside estimate (same math as the dashboard's TaxSetAsideWidget).
async function buildWeeklyDigest(supabase, userId, weekStartStr, weekEndStr, taxRate) {
    const year = new Date().getFullYear();
    const yearStartStr = `${year}-01-01`;
    const todayStr = new Date().toISOString().split('T')[0];

    const [{ data: weekRows }, { data: yearRows }, { count: missingReceiptCount }, { data: mileageRows }] = await Promise.all([
        supabase.from('expenses').select('amount_cents, category').eq('user_id', userId).gte('expense_date', weekStartStr).lte('expense_date', weekEndStr),
        supabase.from('expenses').select('amount_cents, category').eq('user_id', userId).gte('expense_date', yearStartStr).lte('expense_date', todayStr),
        supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('tax_deductible', true).is('receipt_link', null).gt('amount_cents', 7500),
        supabase.from('mileage_logs').select('notes, needs_review').eq('user_id', userId).eq('source', 'ai_brain').gte('log_date', weekStartStr).lte('log_date', weekEndStr),
    ]);
    const mileageReviewCount = (mileageRows || []).filter(r => r.needs_review || !r.notes || !r.notes.trim()).length;

    const weekExpenses = (weekRows || []).filter(r => (r.amount_cents || 0) > 0 && !NON_SPEND_CATS.has(r.category));
    const weekIncome = (weekRows || []).filter(r => (r.amount_cents || 0) < 0);
    const incomeCents = weekIncome.reduce((s, r) => s + Math.abs(r.amount_cents), 0);
    const spendCents = weekExpenses.reduce((s, r) => s + r.amount_cents, 0);
    const netCents = incomeCents - spendCents;

    const ytdExpenses = (yearRows || []).filter(r => (r.amount_cents || 0) > 0 && !NON_SPEND_CATS.has(r.category));
    const ytdIncome = (yearRows || []).filter(r => (r.amount_cents || 0) < 0);
    const ytdIncomeCents = ytdIncome.reduce((s, r) => s + Math.abs(r.amount_cents), 0);
    const ytdSpendCents = ytdExpenses.reduce((s, r) => s + r.amount_cents, 0);
    const ytdNetCents = ytdIncomeCents - ytdSpendCents;
    const taxSetAsideCents = Math.max(0, ytdNetCents) * ((taxRate ?? 30) / 100);

    // Same quarterly deadlines used in brain.js / TaxSetAsideWidget.jsx
    const quarterDeadlines = [
        { date: `${year}-04-15`, label: `Q1 ${year}` },
        { date: `${year}-06-15`, label: `Q2 ${year}` },
        { date: `${year}-09-15`, label: `Q3 ${year}` },
        { date: `${year + 1}-01-15`, label: `Q4 ${year}` },
    ];
    const quarterLabel = (quarterDeadlines.find(d => d.date >= todayStr) || quarterDeadlines[quarterDeadlines.length - 1]).label;

    return { incomeCents, spendCents, netCents, missingReceiptCount: missingReceiptCount || 0, mileageReviewCount, taxSetAsideCents, quarterLabel };
}

// GET /cron/weekly-report
// Sends every Monday (self-checked — a misconfigured or overlapping external
// ping can't send digests on the wrong day). ?force=1 bypasses the day check
// for manual testing. Since UptimeRobot's free plan is interval-based polling
// (no true weekly cron), this endpoint may be hit many times on a Monday — a
// per-user last_weekly_digest_sent_at guard (5-day window) prevents duplicate
// sends regardless of how often the monitor pings.
// ?preview=1 is a true dry run — computes and returns everything but sends no
// email to anyone (not even admin) and does not stamp the de-dupe timestamp.
// Use this for auth/logic testing so a manual curl can never send real email
// again, matching the incident on 2026-07-06.
//
// RE-ENABLED 2026-07-06 (v7.15.3): root cause (settings table missing 6
// columns this route depends on) fixed via migration
// add_missing_settings_columns_v7_15_2, verified with a real send + de-dupe
// check on a second ping. Settings queries now fail closed (no send) on any
// DB error instead of silently proceeding, per the incident's process lesson.
router.get("/weekly-report", async (req, res) => {
    if (!isCronAuthorized(req)) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    const force = req.query.force === '1';
    const isPreview = req.query.preview === '1';

    if (!force && !isPreview && new Date().getDay() !== 1) {
        return res.json({ ok: true, sent: false, message: "Not Monday — skipped (use ?force=1 or ?preview=1 to override)." });
    }

    try {
        if (!supabase) throw new Error("Supabase service client not initialized");

        const now = new Date();
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() - 1); // yesterday
        const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 6);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        const dedupeCutoffStr = new Date(Date.now() - 5 * 86400000).toISOString();

        // ADMIN-ONLY GATE (2026-07-06, Joshua's direction): real users must not
        // receive this yet. Remove this filter once ready to go fully live.
        const allUsers = (await listAllUsers(supabase)).filter(u => u.id === ADMIN_UUID);
        const userIds = allUsers.map(u => u.id);
        const { data: settingsRows, error: settingsError } = await supabase.from('settings').select('user_id, weekly_digest_optout, estimated_tax_rate, last_weekly_digest_sent_at').in('user_id', userIds);
        // Fail CLOSED, not open — this exact silent failure (unchecked SELECT
        // error -> empty settingsMap -> de-dupe never engages) is what caused
        // the 2026-07-06 resend incident. If this query errors, refuse to send
        // rather than risk repeating it.
        if (settingsError) {
            console.error('[CRON] Weekly digest settings fetch failed — refusing to send:', settingsError);
            return res.status(500).json({ error: 'Settings fetch failed', detail: settingsError.message });
        }
        const settingsMap = {};
        (settingsRows || []).forEach(s => { settingsMap[s.user_id] = s; });

        const results = [];
        for (const user of allUsers) {
            if (!user.email) continue;
            const s = settingsMap[user.id];
            if (s?.weekly_digest_optout) { results.push({ email: user.email, ok: false, skipped: true, reason: 'opted out' }); continue; }
            // De-dupe ALWAYS applies, regardless of ?force=1 — force only bypasses
            // the day-of-week check above. A monitor URL with ?force=1 left in it
            // was sending real emails every ~5 minutes on 2026-07-06 because this
            // check used to also skip de-dupe when force was set. Never again.
            if (s?.last_weekly_digest_sent_at && s.last_weekly_digest_sent_at > dedupeCutoffStr) {
                results.push({ email: user.email, ok: false, skipped: true, reason: 'already sent this week' });
                continue;
            }
            try {
                const report = await buildWeeklyDigest(supabase, user.id, weekStartStr, weekEndStr, s?.estimated_tax_rate);
                if (report.incomeCents === 0 && report.spendCents === 0 && report.missingReceiptCount === 0) {
                    results.push({ email: user.email, ok: false, skipped: true, reason: 'nothing to report' });
                    continue;
                }
                if (isPreview) {
                    results.push({ email: user.email, ok: true, dryRun: true, report });
                    continue;
                }
                await queueWeeklyDigestEmail({ to: user.email, name: user.display_name || user.email.split('@')[0], weekLabel, ...report });
                const { error: stampError } = await supabase.from('settings').upsert({ user_id: user.id, last_weekly_digest_sent_at: new Date().toISOString() }, { onConflict: 'user_id' });
                // The send already happened — can't undo it — but if the de-dupe
                // stamp fails to save, the NEXT ping will resend. Log loudly so
                // this is never silently missed again.
                if (stampError) {
                    console.error(`[CRON] Weekly digest sent to ${user.email} but de-dupe stamp FAILED to save — next ping will resend:`, stampError);
                }
                results.push({ email: user.email, ok: true, stampError: stampError?.message || null });
            } catch (err) {
                console.error(`[CRON] Weekly digest failed for ${user.email}:`, err);
                results.push({ email: user.email, ok: false, error: err.message });
            }
        }

        res.json({ ok: true, preview: isPreview, weekLabel, sent: isPreview ? 0 : results.filter(r => r.ok).length, results });
    } catch (e) {
        console.error("[CRON] Weekly digest fatal error:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET /cron/reengagement-report
// Users whose most recent activity is 14+ days old get a gentle nudge — but
// no more than once per 30 days (last_reengagement_sent_at guard), so a daily
// external ping doesn't spam the same inactive user every day.
//
// DISABLED 2026-07-06 (Joshua's direction): he's handling re-engagement
// manually for now. Live sending short-circuits below — remove the
// early-return once ready to turn this back on.
// ?preview=1 is a true dry run — bypasses the disabled-early-return so the
// query/logic can be tested, but sends no email to anyone and does not stamp
// the de-dupe timestamp.
router.get("/reengagement-report", async (req, res) => {
    if (!isCronAuthorized(req)) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    const isPreview = req.query.preview === '1';
    if (!isPreview) {
        return res.json({ ok: true, sent: 0, message: "Re-engagement automation is disabled — handled manually for now. Use ?preview=1 for a dry run." });
    }

    try {
        if (!supabase) throw new Error("Supabase service client not initialized");

        const cutoffStr = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
        const dedupeCutoffStr = new Date(Date.now() - 30 * 86400000).toISOString();

        const { data: activityRows, error: actErr } = await supabase.from('user_daily_activity').select('user_id, activity_date');
        if (actErr) throw actErr;

        const lastActive = {};
        (activityRows || []).forEach(r => {
            if (!lastActive[r.user_id] || r.activity_date > lastActive[r.user_id]) lastActive[r.user_id] = r.activity_date;
        });
        const inactiveUserIds = Object.entries(lastActive).filter(([, date]) => date < cutoffStr).map(([id]) => id);

        if (!inactiveUserIds.length) {
            return res.json({ ok: true, sent: 0, message: "No inactive users found." });
        }

        const [allUsers, settingsRes] = await Promise.all([
            listAllUsers(supabase),
            supabase.from('settings').select('user_id, reengagement_email_optout, last_reengagement_sent_at').in('user_id', inactiveUserIds),
        ]);
        // Fail CLOSED — same silent-failure shape as the weekly-report incident.
        if (settingsRes.error) {
            console.error('[CRON] Re-engagement settings fetch failed — refusing to send:', settingsRes.error);
            return res.status(500).json({ error: 'Settings fetch failed', detail: settingsRes.error.message });
        }
        const settingsMap = {};
        (settingsRes.data || []).forEach(s => { settingsMap[s.user_id] = s; });
        const userMap = {};
        allUsers.forEach(u => { userMap[u.id] = u; });

        const results = [];
        for (const userId of inactiveUserIds) {
            const user = userMap[userId];
            if (!user?.email) continue;
            const s = settingsMap[userId];
            if (s?.reengagement_email_optout) { results.push({ email: user.email, ok: false, skipped: true, reason: 'opted out' }); continue; }
            if (s?.last_reengagement_sent_at && s.last_reengagement_sent_at > dedupeCutoffStr) {
                results.push({ email: user.email, ok: false, skipped: true, reason: 'sent recently' });
                continue;
            }
            results.push({ email: user.email, ok: true, dryRun: true });
        }

        res.json({ ok: true, preview: true, inactiveCount: inactiveUserIds.length, sent: 0, results });
    } catch (e) {
        console.error("[CRON] Re-engagement fatal error:", e);
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
            const { error } = await supabase.from('user_roles').select('id').limit(1);
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
