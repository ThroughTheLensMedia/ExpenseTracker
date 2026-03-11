const express = require("express");
const { supabase } = require("../db");

const router = express.Router();

// GET /leads
router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("leads")
            .select(`
                *,
                clients ( name, email, phone )
            `)
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

        const { data, error } = await supabase
            .from("leads")
            .insert({
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
        const { data, error } = await supabase
            .from("leads")
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
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
        const { error } = await supabase
            .from("leads")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return res.status(204).send();
    } catch (err) {
        console.error("[API] DELETE /leads Error:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
