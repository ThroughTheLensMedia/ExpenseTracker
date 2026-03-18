const express = require("express");
const router = express.Router();
const { repairLedgerBatch } = require("../utils/gemini");

/**
 * AI Brain Entry Point - Intelligence Actions
 */

// POST /api/brain/repair-ledger
// Retroactive cleanup of existing "Rocket Money" entries and vendor names.
router.post("/repair-ledger", async (req, res) => {
    try {
        const { data: settings } = await req.sb
            .from("settings")
            .select("*")
            .eq("user_id", req.user.id)
            .maybeSingle();
        
        const apiKey = settings?.gemini_api_key;
        if (!apiKey) {
            return res.status(400).json({ 
                error: "AI Brain is missing its API key.", 
                detail: "Go to Studio Control Center → AI Settings to set your Gemini API Key." 
            });
        }

        // Fetch "Rocket Money" entries to fix (Targeted Scan)
        const { data: items, error } = await req.sb
            .from("expenses")
            .select("id, vendor, notes, source, category")
            .eq("source", "rocketmoney")
            .limit(50); 

        if (error) throw error;
        if (!items || items.length === 0) return res.json({ ok: true, message: "Ledger is already clean." });

        // Process through Gemini
        const cleaned = await repairLedgerBatch(apiKey, items);

        // Update in DB (Batch updates in Supabase/Postgres)
        let updatedCount = 0;
        for (const item of cleaned) {
            await req.sb
                .from("expenses")
                .update({ 
                    vendor: item.vendor, 
                    source: item.source, 
                    category: item.category 
                })
                .eq("id", item.id);
            updatedCount++;
        }

        res.json({ ok: true, updated: updatedCount, detail: cleaned });
    } catch (e) {
        console.error("AI Brain Error:", e);
        res.status(500).json({ error: e.message || "Something went wrong in the Brain." });
    }
});

module.exports = router;
