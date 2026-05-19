const express = require("express");

const router = express.Router();

// GET /leads
router.get("/", async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from("leads")
            .select(`
                *,
                clients ( name, email, phone )
            `)
            .eq("user_id", req.user.id)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return res.json({ leads: data });
    } catch (err) {
        console.error("[API] GET /leads Error:", err);
        return res.status(500).json({ error: err.message || "Failed fetching leads" });
    }
});

// POST /leads
router.post("/", async (req, res) => {
    try {
        const payload = req.body;

        // Tier limit: total CRM leads cap
        const leadsCap = req.tierLimits?.crm_leads;
        if (Number.isFinite(leadsCap)) {
            const { count } = await req.sb
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', req.user.id);
            if (count >= leadsCap) {
                return res.status(403).json({
                    error: 'tier_limit_reached',
                    limit: leadsCap,
                    tier: req.tier,
                    message: `Your ${req.tier} plan allows ${leadsCap} CRM leads. Upgrade to Core for unlimited leads.`,
                });
            }
        }

        const { data, error } = await req.sb
            .from("leads")
            .insert({
                user_id: req.user.id,
                client_id: payload.client_id || null,
                name: payload.name || "New Lead",
                email: payload.email || "",
                phone: payload.phone || "",
                project_type: payload.project_type || "Other",
                quoted_value_cents: payload.quoted_value_cents || 0,
                status: payload.status || "New Lead",
                notes: payload.notes || ""
            })
            .select()
            .single();

        if (error) throw error;
        return res.json(data);
    } catch (err) {
        console.error("[API] POST /leads Error:", err);
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /leads/:id
router.patch("/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { data, error } = await req.sb
            .from("leads")
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .eq("user_id", req.user.id)
            .select()
            .single();

        if (error) throw error;
        return res.json(data);
    } catch (err) {
        console.error("[API] PATCH /leads Error:", err);
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /leads/:id
router.delete("/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { error } = await req.sb
            .from("leads")
            .delete()
            .eq("id", id)
            .eq("user_id", req.user.id);

        if (error) throw error;
        return res.status(204).send();
    } catch (err) {
        console.error("[API] DELETE /leads Error:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
