const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { supabase } = require("../db");
const router = express.Router();
const { sendInviteEmail } = require("../utils/mailer");

// GET /admin/check-status (Diagnostics)
router.get("/check-status", async (req, res) => {
    // Security: Level 1 Admin Lockdown
    if (req.user?.email?.toLowerCase() !== 'joshua.deuermeyer@gmail.com') {
        return res.status(403).json({ error: "Access Denied: Admin Authorization Required" });
    }

    try {
        const isServiceKeyValid = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 50;
        
        // Test connectivity using the service-level client
        // Note: we use supabase (global) which should use the Service Role key
        const { count: subCount, error: subError } = await supabase.from('user_subscriptions').select('*', { count: 'exact', head: true });
        const { count: codeCount, error: codeError } = await supabase.from('beta_codes').select('*', { count: 'exact', head: true });
        
        res.json({
            ok: true,
            user: req.user.email,
            diagnostics: {
                has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                service_key_length: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0,
                service_key_degraded: !isServiceKeyValid, 
                db_url: process.env.SUPABASE_URL ? "CONFIGURED" : "MISSING"
            },
            tables: {
                user_subscriptions: subError ? { error: subError.message, code: subError.code } : { count: subCount },
                beta_codes: codeError ? { error: codeError.message, code: codeError.code } : { count: codeCount }
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
                // Delete existing data for this user
                await req.sb.from(table).delete().neq("id", "-1"); // dummy check to match all rows under RLS

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
router.get("/subscriptions", async (req, res) => {
    if (req.user?.email?.toLowerCase() !== 'joshua.deuermeyer@gmail.com') return res.status(403).json({ error: "Denied" });
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /admin/subscriptions/:userId/suspend
router.post("/subscriptions/:userId/suspend", async (req, res) => {
    try {
        const { error } = await supabase
            .from('user_subscriptions')
            .update({ status: 'suspended', updated_at: new Date() })
            .eq('user_id', req.params.userId);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /admin/beta-codes
// Generate a new code: { code, daysValid, assigned_to_name, assigned_to_email }
const { sendInviteEmail } = require("../utils/mailer");

router.post("/beta-codes", async (req, res) => {
    try {
        const { code, daysValid = 90, assigned_to_name, assigned_to_email } = req.body;
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + (daysValid || 90));

        const newCode = code || Math.random().toString(36).substring(2, 10).toUpperCase();

        const { data, error } = await supabase
            .from('beta_codes')
            .insert({
                code: newCode,
                valid_until: validUntil.toISOString(),
                assigned_to_name,
                assigned_to_email
            })
            .select()
            .single();

        if (error) throw error;

        // Auto-send invite email if email is provided
        if (assigned_to_email) {
            await sendInviteEmail({
                to: assigned_to_email,
                name: assigned_to_name,
                code: newCode
            }).catch(e => console.error("Auto-invite email failed:", e));
        }

        res.json(data);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// GET /admin/beta-codes
router.get("/beta-codes", async (req, res) => {
    if (req.user?.email?.toLowerCase() !== 'joshua.deuermeyer@gmail.com') return res.status(403).json({ error: "Denied" });
    try {
        const { data, error } = await supabase
            .from('beta_codes')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /admin/beta-codes/:code/resend
router.post("/beta-codes/:code/resend", async (req, res) => {
    try {
        const { data: codeData, error } = await supabase
            .from('beta_codes')
            .select('*')
            .eq('code', req.params.code)
            .single();

        if (error || !codeData) throw new Error("Invite code not found");

        if (!codeData.assigned_to_email) throw new Error("No email associated with this code");

        await sendInviteEmail({
            to: codeData.assigned_to_email,
            name: codeData.assigned_to_name,
            code: codeData.code
        });

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /admin/beta-codes/:code
router.delete("/beta-codes/:code", async (req, res) => {
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
        const { data: current } = await supabase
            .from('user_subscriptions')
            .select('expires_at')
            .eq('user_id', req.params.userId)
            .single();
            
        let newExpiry = new Date();
        if (current && current.expires_at && new Date(current.expires_at) > new Date()) {
            newExpiry = new Date(current.expires_at);
        }
        newExpiry.setDate(newExpiry.getDate() + 90);

        const { error } = await supabase
            .from('user_subscriptions')
            .update({ 
                expires_at: newExpiry.toISOString(),
                status: 'active',
                updated_at: new Date() 
            })
            .eq('user_id', req.params.userId);
            
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
