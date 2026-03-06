const express = require("express");
const { supabase } = require("../db");

const router = express.Router();

// GET /rules
router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("classification_rules")
            .select("*")
            .order("match_column")
            .order("match_value");

        if (error) throw error;
        return res.json({ rules: data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed listing rules" });
    }
});

// POST /rules
router.post("/", async (req, res) => {
    try {
        const {
            match_column, match_type, match_value,
            assign_category, assign_tax_bucket,
            assign_tax_deductible, assign_business_use_pct
        } = req.body;

        if (!match_column || !match_type || !match_value) {
            return res.status(400).json({ error: "Missing match criteria" });
        }

        const data = {
            match_column,
            match_type,
            match_value,
            assign_category: assign_category || '',
            assign_tax_bucket: assign_tax_bucket || '',
            assign_tax_deductible: !!assign_tax_deductible,
            assign_business_use_pct: Number(assign_business_use_pct) || 100
        };

        const { data: inserted, error } = await supabase
            .from("classification_rules")
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return res.json({ id: inserted.id });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed creating rule" });
    }
});

// DELETE /rules/:id
router.delete("/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { error } = await supabase
            .from("classification_rules")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return res.json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed deleting rule" });
    }
});

module.exports = router;
