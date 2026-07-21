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

// PUT /api/vendors/alias
// Merges a vendor name variant (e.g. "Starlink Internet") under one
// canonical name (e.g. "Starlink") for recurring-spend rollups. Mirrors
// PUT /api/accounts/alias exactly.
router.put('/alias', async (req, res) => {
    try {
        const { vendor_key, canonical_name } = req.body || {};
        if (!vendor_key || typeof vendor_key !== 'string') {
            return res.status(400).json({ error: 'vendor_key is required' });
        }
        if (!canonical_name || typeof canonical_name !== 'string') {
            return res.status(400).json({ error: 'canonical_name is required' });
        }

        const payload = {
            user_id: req.user.id,
            vendor_key: vendor_key.toLowerCase(),
            canonical_name: canonical_name.toLowerCase(),
            updated_at: new Date().toISOString(),
        };

        const { error } = await req.sb
            .from('vendor_aliases')
            .upsert(payload, { onConflict: 'user_id,vendor_key' });

        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

// DELETE /api/vendors/alias/:vendor_key
// Un-merges a vendor — removes the alias mapping.
router.delete('/alias/:vendor_key', async (req, res) => {
    try {
        const { error } = await req.sb
            .from('vendor_aliases')
            .delete()
            .eq('user_id', req.user.id)
            .eq('vendor_key', req.params.vendor_key.toLowerCase());

        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;
