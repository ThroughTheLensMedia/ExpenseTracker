const express = require("express");
const { supabase } = require("../db");
const router = express.Router();

// Get settings - always returns an object even if empty
router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
        if (error) throw error;
        res.json(data || {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update settings - robust upsert logic
router.post("/", async (req, res) => {
    try {
        const { data: existing } = await supabase.from("settings").select("id").limit(1).maybeSingle();

        let result;
        const payload = { ...req.body };

        // Remove ID from payload to prevent "column id can only be updated to DEFAULT" errors
        delete payload.id;
        delete payload.created_at; // Also strip timestamps if present

        if (existing && existing.id) {
            result = await supabase
                .from("settings")
                .update(payload)
                .eq("id", existing.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from("settings")
                .insert([payload])
                .select()
                .single();
        }

        if (result.error) throw result.error;
        res.json(result.data);
    } catch (e) {
        console.error("Settings save error:", e);
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
