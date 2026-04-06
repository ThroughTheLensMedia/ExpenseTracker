const express = require("express");
const router = express.Router();

// Get settings - always returns an object even if empty
router.get("/", async (req, res) => {
    if (!req.sb || !req.user?.id) return res.status(401).json({ error: "Session required" });
    const { data: row, error } = await req.sb
        .from('user_settings')
        .select('*')
        .eq('user_id', req.user.id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return res.json(null);
        console.error("[SETTINGS] Fetch error:", error.message);
        return res.status(500).json({ error: error.message });
    }
    res.json(row);
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
                .update({ ...payload, user_id: req.user.id })
                .eq("id", existing.id)
                .select()
                .single();
        } else {
            result = await req.sb
                .from("settings")
                .insert([{ ...payload, user_id: req.user.id }])
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
