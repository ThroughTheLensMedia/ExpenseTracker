const express = require("express");
const { supabase } = require("../db");
const router = express.Router();

// Get settings
router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase.from("settings").select("*").single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'no rows'
        res.json(data || {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update settings
router.post("/", async (req, res) => {
    try {
        const { data: existing } = await supabase.from("settings").select("id").single();

        let result;
        if (existing) {
            result = await supabase.from("settings").update(req.body).eq("id", existing.id).select().single();
        } else {
            result = await supabase.from("settings").insert(req.body).select().single();
        }

        if (result.error) throw result.error;
        res.json(result.data);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
