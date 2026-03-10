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
        console.error("[API] GET /rules Error:", err);
        return res.status(500).json({ error: err.message || "Failed listing rules", code: err.code });
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
        console.error("[API] DELETE /rules/:id Error:", err);
        return res.status(500).json({ error: err.message || "Failed deleting rule", code: err.code });
    }
});

// GET /rules/:id/preview
// Returns all transactions that match this rule, and shows what would change.
router.get("/:id/preview", async (req, res) => {
    try {
        const { data: rule, error: rErr } = await supabase
            .from("classification_rules").select("*").eq("id", req.params.id).single();
        if (rErr || !rule) return res.status(404).json({ error: "Rule not found" });

        const { data: expenses, error: eErr } = await supabase
            .from("expenses").select("id, vendor, notes, category, tax_bucket, tax_deductible, business_use_pct");
        if (eErr) throw eErr;

        const matched = [];
        const val = (rule.match_value || '').toLowerCase().trim();

        for (const exp of expenses || []) {
            const text = rule.match_column === 'vendor'
                ? (exp.vendor || '').toLowerCase()
                : (exp.notes || '').toLowerCase();
            const isMatch = rule.match_type === 'exact' ? text === val : text.includes(val);
            if (isMatch) {
                matched.push({
                    id: exp.id,
                    vendor: exp.vendor,
                    currentCategory: exp.category,
                    currentBucket: exp.tax_bucket,
                    currentDeductible: exp.tax_deductible,
                    newCategory: rule.assign_category || null,
                    newBucket: rule.assign_tax_bucket || null,
                    newDeductible: rule.assign_tax_deductible,
                });
            }
        }

        // When nothing matched, find near-misses:
        // vendors/notes containing ANY word from the rule value (min 4 chars)
        let nearMisses = [];
        if (matched.length === 0 && rule.match_column === 'vendor') {
            const words = val.split(/\s+/).filter(w => w.length >= 4);
            const seen = new Set();
            for (const exp of expenses || []) {
                const v = (exp.vendor || '').toLowerCase();
                if (words.some(w => v.includes(w)) && !seen.has(exp.vendor)) {
                    seen.add(exp.vendor);
                    nearMisses.push(exp.vendor);
                    if (nearMisses.length >= 10) break;
                }
            }
        }

        return res.json({ rule, matchCount: matched.length, matches: matched.slice(0, 20), nearMisses });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /rules/:id/apply
// Applies a single rule to all matching existing transactions.
router.post("/:id/apply", async (req, res) => {
    try {
        const { data: rule, error: rErr } = await supabase
            .from("classification_rules").select("*").eq("id", req.params.id).single();
        if (rErr || !rule) return res.status(404).json({ error: "Rule not found" });

        const { data: expenses, error: eErr } = await supabase
            .from("expenses").select("id, vendor, notes, category, tax_bucket, tax_deductible, business_use_pct");
        if (eErr) throw eErr;

        let updated = 0;
        const errors = [];

        for (const exp of expenses || []) {
            const text = rule.match_column === 'vendor'
                ? (exp.vendor || '').toLowerCase()
                : (exp.notes || '').toLowerCase();
            const val = (rule.match_value || '').toLowerCase();
            const isMatch = rule.match_type === 'exact' ? text === val : text.includes(val);
            if (!isMatch) continue;

            const patch = {};
            if (rule.assign_category) patch.category = rule.assign_category;
            if (rule.assign_tax_bucket) patch.tax_bucket = rule.assign_tax_bucket;
            if (rule.assign_tax_deductible !== null && rule.assign_tax_deductible !== undefined) {
                patch.tax_deductible = rule.assign_tax_deductible;
            }
            if (rule.assign_business_use_pct) patch.business_use_pct = rule.assign_business_use_pct;

            if (Object.keys(patch).length === 0) continue;

            const { error: updErr } = await supabase.from("expenses").update(patch).eq("id", exp.id);
            if (updErr) errors.push({ vendor: exp.vendor, error: updErr.message });
            else updated++;
        }

        return res.json({ ok: true, updated, total: (expenses || []).length, errors });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
