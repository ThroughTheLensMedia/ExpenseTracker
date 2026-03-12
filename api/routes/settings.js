const express = require("express");
const router = express.Router();

// Get settings - always returns an object even if empty
router.get("/", async (req, res) => {
    try {
        const { data, error } = await req.sb.from("settings").select("*").limit(1).maybeSingle();
        if (error) throw error;
        res.json(data || {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update settings - robust upsert logic
router.post("/", async (req, res) => {
    try {
        const { data: existing } = await req.sb.from("settings").select("id").limit(1).maybeSingle();

        let result;
        const payload = { ...req.body };

        // Aggressively strip system columns that Postgres forbids from being manually updated via identity constraints
        const protectedFields = ['id', 'created_at', 'updated_at'];
        protectedFields.forEach(f => delete payload[f]);

        if (existing && existing.id) {
            result = await req.sb
                .from("settings")
                .update(payload)
                .eq("id", existing.id)
                .select()
                .single();
        } else {
            result = await req.sb
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
