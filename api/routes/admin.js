const express = require("express");
const { supabase } = require("../db");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const router = express.Router();

// HELPER: Fetch all rows from any table
async function fetchAllRows(tableName) {
    const PAGE = 1000;
    let offset = 0;
    let allRows = [];
    while (true) {
        const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .range(offset, offset + PAGE - 1)
            .order("created_at", { ascending: true });

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
        return res.status(400).json({ error: "Cloudflare credentials not configured in env (CF_ZONE_ID, CF_API_TOKEN)" });
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
        if (!resp.ok || !data.success) {
            throw new Error(data.errors?.[0]?.message || 'Cloudflare API error');
        }

        res.json({ ok: true, message: "Cloudflare cache purged" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /admin/export-all
// Returns a JSON file containing all data from all tables
router.get("/export-all", async (req, res) => {
    try {
        const tables = ["expenses", "equipment_assets", "mileage_logs", "classification_rules", "clients", "invoices", "invoice_items"];
        const backup = {};

        for (const table of tables) {
            try {
                backup[table] = await fetchAllRows(table);
            } catch (err) {
                console.warn(`Could not export table ${table}:`, err.message);
            }
        }

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="backup_${new Date().toISOString().slice(0, 10)}.json"`);
        res.send(JSON.stringify(backup, null, 2));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
