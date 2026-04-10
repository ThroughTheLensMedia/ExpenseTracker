const express = require("express");
const router = express.Router();

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

        const { data, error } = await req.sb
            .from("settings")
            .upsert({ ...payload, user_id: req.user.id }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error("Settings save error:", e);
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
