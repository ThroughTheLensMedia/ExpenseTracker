const express = require("express");
const { z } = require("zod");
const router = express.Router();

// GET /api/vendors/settings
// Returns a map of all vendor settings to the client
router.get("/settings", async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from("vendor_settings")
            .select("vendor, is_ignored");
        
        if (error) throw error;
        
        // Return array of objects { vendor, is_ignored }
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

// POST /api/vendors/settings
// Upserts a setting for a specific vendor
const VendorSettingSchema = z.object({
    vendor: z.string(),
    is_ignored: z.boolean()
});

router.post("/settings", async (req, res) => {
    try {
        const raw = VendorSettingSchema.parse(req.body);
        const data = {
            user_id: req.user.id,
            vendor: raw.vendor,
            is_ignored: raw.is_ignored
        };

        const { data: inserted, error } = await req.sb
            .from("vendor_settings")
            .upsert(data, { onConflict: 'user_id, vendor' })
            .select()
            .single();

        if (error) throw error;
        res.json(inserted);
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;
