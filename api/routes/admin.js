const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { supabase } = require("../db");
const router = express.Router();
const { queueInviteEmail, queueDailyReportEmail, queueHealthAlertEmail } = require("../utils/emailQueue");
const { requireRole } = require("../middleware/auth");

router.get("/", (req, res) => res.json({ ok: true, module: "admin", user: req.user?.email }));
router.get("/test", (req, res) => res.json({ ok: true, test: "admin-reachable" }));

// GET /admin/daily-report — Admin UI preview only. Returns activity data; never sends email.
// Automated cron firing lives at /api/cron/daily-report (mounted before authMiddleware).
router.get("/daily-report", async (req, res) => {
    const userEmail = req.user?.email?.toLowerCase();
    if (userEmail !== 'joshua.deuermeyer@gmail.com' && userEmail !== 'info@throughthelens.media') {
        return res.status(403).json({ error: "Unauthorized" });
    }

    try {
        const { supabase: serviceClient } = require("../db");
        if (!serviceClient) throw new Error("Supabase service client not initialized");

        const today = new Date().toISOString().split('T')[0];

        // 1. Fetch Activity base data using service client
        // Look back 7 days to capture weekly engagement
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        
        const { data: activityRows, error: actError } = await serviceClient
            .from('user_daily_activity')
            .select(`user_id, total_minutes_active, last_pulse_at, activity_date`)
            .gte('activity_date', sevenDaysAgo);

        if (actError) {
            console.error("[Daily Report] Activity Query Error:", actError);
            throw actError;
        }

        if (!activityRows || !activityRows.length) {
            return res.json({ ok: true, sent: false, message: "No activity to report yet today.", data: [] });
        }

        // 2. Fetch User Identities
        const userIds = [...new Set(activityRows.map(r => r.user_id))];
        let subRes = { data: [] }, profRes = { data: [] };
        
        try {
            const results = await Promise.all([
                serviceClient.from('user_subscriptions').select('*').in('user_id', userIds),
                serviceClient.from('profiles').select('*').in('id', userIds)
            ]);
            subRes = results[0];
            profRes = results[1];
        } catch (identErr) {
            console.warn("[Daily Report] Identity Resolve Failed (Partial Content Mode):", identErr);
        }
        
        const userMap = {};
        if (profRes?.data) profRes.data.forEach(p => {
            if (p.id) userMap[p.id] = { email: p.email, name: p.display_name };
        });
        if (subRes?.data) subRes.data.forEach(u => {
            if (u.user_id) {
                const fallbackName = userMap[u.user_id]?.name || u.email?.split('@')[0];
                userMap[u.user_id] = { email: u.email, name: u.display_name || fallbackName, plan_type: u.plan_type || 'free' };
            }
        });

        const mapping = {
            'joshua.deuermeyer@gmail.com': 'Joshua D.',
            '49e7efcb-6775-4927-9436-1e9674989669': 'Joshua D.',
            'f129a00b-333e-4d43-98b7-08ca1161d765': 'Joshua D.'
        };

        const reportData = activityRows.map(r => {
            const identity = userMap[r.user_id];
            const identityEmail = (identity?.email || 'unknown@studio.internal').toLowerCase();
            const identityName = mapping[identityEmail] || mapping[r.user_id] || identity?.name || identityEmail.split('@')[0] || "User";
            
            return {
                email: identityEmail,
                name: identityName,
                minutes_today: r.total_minutes_active || 0,
                last_seen: r.last_pulse_at || new Date().toISOString(),
                plan_type: identity?.plan_type || 'free',
            };
        });
        
        // Aggregate by user
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

        const finalData = Object.values(aggregated).sort((a,b) => b.minutes_today - a.minutes_today);

        res.json({ ok: true, sent: false, usersReported: finalData.length, data: finalData });
    } catch (e) {
        console.error("[ADMIN] Daily Report Fatal Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// /admin/watchdog removed — live at /api/cron/watchdog (mounted before authMiddleware)

router.get("/check-status", requireRole('admin'), async (req, res) => {

    try {
        const hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SERVICE_ROLE_KEY);
        const hasAnonKey = !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);


        let subCount = 0, codeCount = 0, activityCount = 0;
        let subError = null, codeError = null, activityError = null;
        let queriesSucceeded = false;

        if (supabase) {
            try {
                const [s, c, a] = await Promise.all([
                    supabase.from('user_subscriptions').select('*', { count: 'exact', head: true }),
                    supabase.from('beta_codes').select('*', { count: 'exact', head: true }),
                    supabase.from('user_daily_activity').select('*', { count: 'exact', head: true })
                ]);
                subCount = s.count || 0; subError = s.error;
                codeCount = c.count || 0; codeError = c.error;
                activityCount = a.count || 0; activityError = a.error;
                queriesSucceeded = !subError && !codeError && !activityError;
            } catch (err) {
                console.error("[Admin Diagnostics] Promise.all failed", err);
                subError = { message: err.message };
            }
        } else {
            subError = { message: "Supabase client not initialized" };
        }

        // Only report degraded if queries actually fail.
        // Using anon key with proper RLS is fine for admin reads.
        const isDegraded = !supabase || (!queriesSucceeded && !hasServiceKey && !hasAnonKey);

        res.json({
            ok: true,
            user: req.user.email,
            diagnostics: {
                has_service_key: hasServiceKey,
                using_anon_fallback: !hasServiceKey && hasAnonKey,
                service_key_degraded: isDegraded,
                queries_ok: queriesSucceeded,
                db_url: process.env.SUPABASE_URL ? "CONFIGURED" : "MISSING",
                timezone_info: new Date().toString()
            },
            tables: {
                user_subscriptions: subError ? { error: subError.message, code: subError.code } : { count: subCount },
                beta_codes: codeError ? { error: codeError.message, code: codeError.code } : { count: codeCount },
                user_daily_activity: activityError ? { error: activityError.message, code: activityError.code } : { count: activityCount }
            }
        });
    } catch (e) {
        res.status(500).json({ error: "Diagnostic Crash: " + e.message });
    }
});

// HELPER: Fetch all rows from any table (request-bound)
async function fetchAllRows(sb, tableName) {
    const PAGE = 1000;
    let offset = 0;
    let allRows = [];
    while (true) {
        const { data, error } = await sb
            .from(tableName)
            .select("*")
            .range(offset, offset + PAGE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRows = allRows.concat(data);
        if (data.length < PAGE) break;
        offset += PAGE;
    }
    return allRows;
}

// POST /admin/purge-cloudflare
router.post("/purge-cloudflare", async (req, res) => {
    const CF_ZONE_ID = process.env.CF_ZONE_ID;
    const CF_API_TOKEN = process.env.CF_API_TOKEN;

    if (!CF_ZONE_ID || !CF_API_TOKEN) {
        return res.status(400).json({ error: "Cloudflare credentials not configured." });
    }

    try {
        const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ purge_everything: true })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare API error');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /admin/export-all
router.get("/export-all", async (req, res) => {
    try {
        const tables = ["expenses", "equipment_assets", "mileage_logs", "classification_rules", "clients", "invoices", "invoice_items", "settings"];
        const backup = {};
        for (const table of tables) {
            try { backup[table] = await fetchAllRows(req.sb, table); } catch (err) { }
        }
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="studio_backup_${new Date().toISOString().slice(0, 10)}.json"`);
        res.send(JSON.stringify(backup, null, 2));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /admin/import-all
router.post("/import-all", async (req, res) => {
    try {
        const backup = req.body; 
        if (!backup) return res.status(400).json({ error: "No backup data provided" });

        const results = {};
        const tables = ["expenses", "equipment_assets", "mileage_logs", "classification_rules", "clients", "invoices", "invoice_items", "settings"];

        for (const table of tables) {
            const rows = backup[table];
            if (Array.isArray(rows) && rows.length > 0) {
                // Delete existing data for this user (RLS filters to current user)
                await req.sb.from(table).delete();

                // Chunked insert
                const CHUNK = 500;
                let inserted = 0;
                for (let i = 0; i < rows.length; i += CHUNK) {
                    const chunkData = rows.slice(i, i + CHUNK).map(r => {
                        const { id, created_at, updated_at, user_id, ...clean } = r; 
                        return clean;
                    });
                    const { data, error } = await req.sb.from(table).insert(chunkData).select();
                    if (!error && data) inserted += data.length;
                }
                results[table] = inserted;
            }
        }
        res.json({ ok: true, detail: results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- SUBSCRIPTION & BETA MGMT ---

// GET /admin/subscriptions
router.get("/subscriptions", requireRole('admin'), async (req, res) => {
    try {
        const { supabase: serviceClient } = require("../db");
        if (!serviceClient) throw new Error("Service client required for SaaS dashboard");
        
        const { data, error } = await serviceClient
            .from('user_subscriptions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("[Admin] user_subscriptions query error:", error.message, error.code);
            throw error;
        }
        console.log(`[Admin] user_subscriptions returned ${(data || []).length} rows`);

        const userIds = (data || []).map(d => d.user_id);

        // Plaid account counts per user
        const { data: plaidRows } = await serviceClient
            .from('plaid_connections')
            .select('user_id')
            .in('user_id', userIds);
        const plaidCountMap = {};
        if (plaidRows) plaidRows.forEach(r => {
            plaidCountMap[r.user_id] = (plaidCountMap[r.user_id] || 0) + 1;
        });

        // Notes from beta_codes — join by assigned_to_email, take most recent
        const emails = (data || []).map(d => d.email).filter(Boolean);
        const { data: codeRows } = emails.length
            ? await serviceClient.from('beta_codes').select('assigned_to_email, notes').in('assigned_to_email', emails)
            : { data: [] };
        const notesMap = {};
        if (codeRows) codeRows.forEach(c => { if (c.notes && !notesMap[c.assigned_to_email]) notesMap[c.assigned_to_email] = c.notes; });

        const enriched = data.map(d => ({
            ...d,
            display_name: d.display_name || (d.email ? d.email.split('@')[0] : 'Unknown'),
            joined_at: d.created_at || null,
            plaid_account_count: plaidCountMap[d.user_id] || 0,
            notes: notesMap[d.email] || null,
        }));

        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PATCH /admin/subscriptions/:userId (Edit Session)
router.patch("/subscriptions/:userId", requireRole('admin'), async (req, res) => {
    try {
        const { supabase: serviceClient } = require("../db");
        if (!serviceClient) throw new Error("Service client required");

        const { display_name, plan_type, expires_at, status, notes } = req.body;
        const update = { updated_at: new Date().toISOString() };
        
        if (plan_type !== undefined) {
            update.plan_type = plan_type;
            // Stripe-managed plans: clear expires_at so Stripe is source of truth
            if (['core_monthly', 'core_annual', 'studio_monthly', 'studio_annual'].includes(plan_type)) {
                update.expires_at = null;
            } else {
                const now = new Date();
                if (plan_type === 'annual') now.setDate(now.getDate() + 365);
                else if (['pro', 'lifetime', 'elite', 'free_beta'].includes(plan_type)) now.setDate(now.getDate() + 999);
                else if (plan_type === 'monthly') now.setDate(now.getDate() + 31);
                else if (plan_type === 'beta_tester') now.setDate(now.getDate() + 90);
                else now.setDate(now.getDate() + 999); // free / unknown — far future
                update.expires_at = now.toISOString();
            }
        }

        if (expires_at !== undefined) update.expires_at = expires_at;
        if (status !== undefined) update.status = status;

        // 1. Update display_name in user_subscriptions
        if (display_name !== undefined) {
            const { error: nameErr } = await serviceClient
                .from('user_subscriptions')
                .update({ display_name })
                .eq('user_id', req.params.userId);
            if (nameErr) throw nameErr;
        }

        // 2. Update notes in beta_codes (by user email)
        if (notes !== undefined) {
            const { data: subRow } = await serviceClient.from('user_subscriptions').select('email').eq('user_id', req.params.userId).maybeSingle();
            if (subRow?.email) {
                await serviceClient.from('beta_codes').update({ notes }).eq('assigned_to_email', subRow.email);
            }
        }

        // 3. Update Subscription
        const { error } = await serviceClient
            .from('user_subscriptions')
            .update(update)
            .eq('user_id', req.params.userId);

        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /admin/weekly-report
router.get("/weekly-report", requireRole('admin'), async (req, res) => {
    try {
        const { supabase: serviceClient } = require("../db");
        if (!serviceClient) throw new Error("DB client uninit");

        const { data, error } = await serviceClient
            .from('user_daily_activity')
            .select(`user_id, total_minutes_active, activity_date`)
            .gte('activity_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);

        if (error) throw error;
        
        // Fetch All Users to resolve names
        const userIds = [...new Set(data.map(d => d.user_id))];
        const [subRes, profRes] = await Promise.all([
            serviceClient.from('user_subscriptions').select('*').in('user_id', userIds).catch(() => ({ data: [] })),
            serviceClient.from('profiles').select('*').in('id', userIds).catch(() => ({ data: [] }))
        ]);

        const userNames = {};
        if (profRes?.data) profRes.data.forEach(p => userNames[p.id] = p.display_name || p.email?.split('@')[0]);
        if (subRes?.data) subRes.data.forEach(u => userNames[u.user_id] = u.display_name || userNames[u.user_id] || u.email?.split('@')[0]);

        const mapping = {
            'joshua.deuermeyer@gmail.com': 'Joshua D.',
            '49e7efcb-6775-4927-9436-1e9674989669': 'Joshua D.',
            'f129a00b-333e-4d43-98b7-08ca1161d765': 'Joshua D.'
        };

        const summary = {};
        data.forEach(r => {
            const userId = r.user_id;
            const sub = subRes.data?.find(s => s.user_id === userId);
            const prof = profRes.data?.find(p => p.id === userId);
            
            const email = (prof?.email || sub?.email || `user_${userId.slice(0,8)}`).toLowerCase();
            const rawName = userNames[userId] || email.split('@')[0];
            const name = mapping[email] || mapping[userId] || rawName;
            
            if (!summary[name]) summary[name] = 0;
            summary[name] += r.total_minutes_active;
        });

        const sorted = Object.entries(summary)
            .map(([name, total_min]) => ({ name, total_min }))
            .sort((a,b) => b.total_min - a.total_min);

        res.json(sorted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /admin/beta-codes
router.get("/beta-codes", requireRole('admin'), async (req, res) => {
    try {
        if (!supabase) throw new Error("Supabase client not initialized.");
        const { data, error } = await supabase
            .from('beta_codes')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            console.error("[Admin] beta_codes query error:", error.message, error.code);
            throw error;
        }
        console.log(`[Admin] beta_codes returned ${(data || []).length} rows`);
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /admin/beta-codes
// Generate a new code: { code, daysValid, assigned_to_name, assigned_to_email, plan_type }
router.post("/beta-codes", requireRole('admin'), async (req, res) => {
    try {
        const { code, daysValid = 90, assigned_to_name, assigned_to_email, plan_type = 'beta_tester', notes } = req.body;
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + (daysValid || 90));

        const newCode = code || Math.random().toString(36).substring(2, 10).toUpperCase();

        if (!supabase) throw new Error("Supabase client not initialized.");
        const { data, error } = await supabase
            .from('beta_codes')
            .insert({
                code: newCode,
                valid_until: validUntil.toISOString(),
                assigned_to_name,
                assigned_to_email,
                plan_type,
                notes: notes || null,
            })
            .select()
            .single();

        if (error) throw error;

        // Queue invite email if email is provided (non-blocking)
        if (assigned_to_email) {
            queueInviteEmail({
                to: assigned_to_email,
                name: assigned_to_name,
                code: newCode,
                plan_type,
            }).catch(e => console.error("[INVITE EMAIL QUEUE] Failed:", e));
        }

        res.json(data);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// PATCH /admin/beta-codes/:code (Edit Invite)
router.patch("/beta-codes/:code", requireRole('admin'), async (req, res) => {
    try {
        const { assigned_to_name, assigned_to_email, plan_type, notes } = req.body;
        const update = {};
        if (assigned_to_name !== undefined) update.assigned_to_name = assigned_to_name;
        if (assigned_to_email !== undefined) update.assigned_to_email = assigned_to_email;
        if (plan_type !== undefined) update.plan_type = plan_type;
        if (notes !== undefined) update.notes = notes;

        const { error } = await supabase
            .from('beta_codes')
            .update(update)
            .eq('code', req.params.code);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /admin/beta-codes/:code/resend
router.post("/beta-codes/:code/resend", requireRole('admin'), async (req, res) => {
    try {
        const { data: codeData, error } = await supabase
            .from('beta_codes')
            .select('*')
            .eq('code', req.params.code)
            .single();

        if (error || !codeData) throw new Error("Invite code not found");

        if (!codeData.assigned_to_email) throw new Error("No email associated with this code");

        // Queue invite email (non-blocking)
        queueInviteEmail({
            to: codeData.assigned_to_email,
            name: codeData.assigned_to_name,
            code: codeData.code
        }).catch(e => console.error("[INVITE EMAIL QUEUE] Failed:", e));

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /admin/beta-codes/:code
router.delete("/beta-codes/:code", requireRole('admin'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('beta_codes')
            .delete()
            .eq('code', req.params.code);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /admin/subscriptions/:userId/extend
router.post("/subscriptions/:userId/extend", async (req, res) => {
    try {
        const { supabase: serviceClient } = require("../db");
        const { data: current } = await serviceClient
            .from('user_subscriptions')
            .select('expires_at')
            .eq('user_id', req.params.userId)
            .single();
            
        let newExpiry = new Date();
        if (current && current.expires_at && new Date(current.expires_at) > new Date()) {
            newExpiry = new Date(current.expires_at);
        }
        newExpiry.setDate(newExpiry.getDate() + 90);

        const { error } = await serviceClient
            .from('user_subscriptions')
            .update({ 
                expires_at: newExpiry.toISOString(),
                status: 'active',
                updated_at: new Date().toISOString()
            })
            .eq('user_id', req.params.userId);
            
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /admin/subscriptions/:userId/suspend
router.post("/subscriptions/:userId/suspend", async (req, res) => {
    try {
        const { supabase: serviceClient } = require("../db");
        const { error } = await serviceClient
            .from('user_subscriptions')
            .update({ 
                status: 'suspended', 
                updated_at: new Date().toISOString()
            })
            .eq('user_id', req.params.userId);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /admin/logs
 * Returns system_logs entries for the admin log viewer.
 * Query params:
 *   ?source=email-inbound   — filter by source (omit for all)
 *   ?level=error            — filter by level: info | warn | error (omit for all)
 *   ?since=24h              — lookback window: 1h | 6h | 24h | 7d (default: 24h)
 *   ?limit=200              — max rows (default 200, max 500)
 */
router.get("/logs", requireRole('admin'), async (req, res) => {
    const userEmail = req.user?.email?.toLowerCase();
    if (userEmail !== 'joshua.deuermeyer@gmail.com' && userEmail !== 'info@throughthelens.media') {
        return res.status(403).json({ error: "Unauthorized" });
    }

    try {
        const { source, level, since = '24h', limit = '200' } = req.query;

        // Compute cutoff timestamp
        const cutoffMs = {
            '1h':  1 * 60 * 60 * 1000,
            '6h':  6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d':  7 * 24 * 60 * 60 * 1000,
        }[since] ?? (24 * 60 * 60 * 1000);
        const cutoff = new Date(Date.now() - cutoffMs).toISOString();

        const maxRows = Math.min(parseInt(limit, 10) || 200, 500);

        let query = supabase
            .from('system_logs')
            .select('id, created_at, level, source, message, metadata, user_id')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(maxRows);

        if (source) query = query.eq('source', source);
        if (level)  query = query.eq('level', level);

        const { data, error } = await query;
        if (error) throw error;

        // Collect unique sources for the filter dropdown
        const { data: sourcesData } = await supabase
            .from('system_logs')
            .select('source')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        const sources = [...new Set((sourcesData || []).map(r => r.source))].sort();

        res.json({ logs: data || [], sources, total: (data || []).length });
    } catch (err) {
        console.error('[ADMIN] Logs fetch error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Security Review Cadence ───────────────────────────────────────────────────

const REVIEW_CADENCE = {
    weekly:     { label: 'Weekly Check',        days: 7   },
    monthly:    { label: 'Monthly Audit',        days: 30  },
    quarterly:  { label: 'Quarterly Deep Review',days: 90  },
    annual:     { label: 'Annual Audit',         days: 365 },
    dependency: { label: 'npm audit',            days: 7   },
};

/**
 * GET /admin/security-reviews
 * Returns last completion per type + computed next-due date.
 */
router.get("/security-reviews", requireRole('admin'), async (req, res) => {
    try {
        // Get the most recent completion for each review type
        const types = Object.keys(REVIEW_CADENCE);
        const results = await Promise.all(types.map(async (type) => {
            const { data } = await supabase
                .from('security_reviews')
                .select('id, completed_at, notes')
                .eq('review_type', type)
                .order('completed_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            const cadence = REVIEW_CADENCE[type];
            const lastCompleted = data?.completed_at || null;
            const nextDue = lastCompleted
                ? new Date(new Date(lastCompleted).getTime() + cadence.days * 86400000).toISOString()
                : null;
            return { type, label: cadence.label, days: cadence.days, lastCompleted, nextDue };
        }));

        // Also fetch recent history (last 20)
        const { data: history } = await supabase
            .from('security_reviews')
            .select('id, review_type, completed_at, notes')
            .order('completed_at', { ascending: false })
            .limit(20);

        res.json({ reviews: results, history: history || [] });
    } catch (e) {
        console.error('[Admin] security-reviews GET error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /admin/security-reviews/complete
 * Body: { review_type, notes? }
 * Logs a completion for the given review type.
 */
router.post("/security-reviews/complete", requireRole('admin'), async (req, res) => {
    try {
        const { review_type, notes } = req.body;
        if (!REVIEW_CADENCE[review_type]) {
            return res.status(400).json({ error: `Invalid review_type. Must be one of: ${Object.keys(REVIEW_CADENCE).join(', ')}` });
        }
        const { data, error } = await supabase
            .from('security_reviews')
            .insert({ review_type, notes: notes || null, completed_by: req.user.id })
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('[Admin] security-reviews POST error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// CATCH-ALL for /admin 404 debugging — must stay at the bottom
router.all("*", (req, res) => {
    console.warn(`[ADMIN 404] Unhandled admin route: ${req.method} ${req.originalUrl} (base: ${req.baseUrl})`);
    res.status(404).json({
        error: "Admin route not found",
        path: req.originalUrl,
        base: req.baseUrl,
        method: req.method
    });
});

module.exports = router;
