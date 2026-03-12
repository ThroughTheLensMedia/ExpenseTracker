const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const router = express.Router();

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
// Only for super-admins (checking for your specific email for now as a quick bypass)
router.get("/subscriptions", async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from('user_subscriptions')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /admin/beta-codes
// Generate a new code: { code, daysValid, assigned_to_name, assigned_to_email }
router.post("/beta-codes", async (req, res) => {
    try {
        const { code, daysValid = 30, assigned_to_name, assigned_to_email } = req.body;
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + daysValid);

        const { data, error } = await req.sb
            .from('beta_codes')
            .insert({
                code: code || Math.random().toString(36).substring(2, 10).toUpperCase(),
                valid_until: validUntil.toISOString(),
                assigned_to_name,
                assigned_to_email
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// GET /admin/beta-codes
router.get("/beta-codes", async (req, res) => {
    try {
        const { data, error } = await req.sb.from('beta_codes').select('*');
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
