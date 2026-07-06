const express = require("express");
const router = express.Router();
const { encrypt, decryptOrPlain } = require("../utils/cryptoUtil");

// Get settings - always returns an object even if empty
router.get("/", async (req, res) => {
    if (!req.sb || !req.user?.id) return res.status(401).json({ error: "Session required" });
    const { data: row, error } = await req.sb
        .from('settings')
        .select('*')
        .eq('user_id', req.user.id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return res.json(null);
        console.error("[SETTINGS] Fetch error:", error.message);
        return res.status(500).json({ error: error.message });
    }
    if (row?.gemini_api_key) {
        row.gemini_api_key = await decryptOrPlain(row.gemini_api_key);
    }
    res.json(row);
});

// Update settings - robust upsert logic
router.post("/", async (req, res) => {
    if (!req.sb || !req.user?.id) return res.status(401).json({ error: "Session required" });
    try {
        const payload = { ...req.body };

        // Aggressively strip system columns that Postgres forbids from being manually updated
        const protectedFields = ['id', 'created_at', 'updated_at'];
        protectedFields.forEach(f => delete payload[f]);

        // Encrypt the BYOB Gemini key at rest (v7.15.0) — matches Plaid token handling.
        if (typeof payload.gemini_api_key === 'string' && payload.gemini_api_key.length > 0) {
            payload.gemini_api_key = await encrypt(payload.gemini_api_key);
        }

        const { data, error } = await req.sb
            .from("settings")
            .upsert({ ...payload, user_id: req.user.id }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;
        if (data?.gemini_api_key) {
            data.gemini_api_key = await decryptOrPlain(data.gemini_api_key);
        }
        res.json(data);
    } catch (e) {
        console.error("Settings save error:", e);
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
