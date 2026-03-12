const express = require("express");
const { supabase } = require("../db");
const z = require("zod");

const router = express.Router();

const DEPRECIATION_LIFE = {
    Camera: 5, Lens: 5, Drone: 5, Laptop: 5, 'Drone / Remote': 5,
    Flash: 5, Gimbal: 5, Ipad: 5, Other: 5
};

const AssetSchema = z.object({
    purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required"),
    vendor: z.string().trim().min(1),
    description: z.string().trim().min(1),
    category: z.string().trim().default("Other"),
    cost_cents: z.coerce.number().int().min(0),
    serial_number: z.string().trim().optional().default(""),
    notes: z.string().trim().optional().default(""),
    receipt_link: z.string().trim().optional().nullable(),
    depreciation_method: z.enum(["straight_line", "section_179"]).default("straight_line"),
    useful_life_years: z.coerce.number().int().min(1).max(40).optional(),
    disposal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required").optional().nullable(),
    disposal_value_cents: z.coerce.number().int().min(0).optional().nullable(),
});

// GET /assets
router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("equipment_assets")
            .select("*")
            .order("purchase_date", { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

// POST /assets
router.post("/", async (req, res) => {
    try {
        const body = AssetSchema.parse(req.body);
        const useful_life_years = body.useful_life_years || DEPRECIATION_LIFE[body.category] || 5;
        const { data, error } = await supabase
            .from("equipment_assets")
            .insert({ ...body, useful_life_years })
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
        res.status(500).json({ error: String(e.message || e) });
    }
});

// PATCH /assets/:id
router.patch("/:id", async (req, res) => {
    try {
        const body = AssetSchema.partial().parse(req.body);
        const { data, error } = await supabase
            .from("equipment_assets")
            .update(body)
            .eq("id", req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
        res.status(500).json({ error: String(e.message || e) });
    }
});

// DELETE /assets/:id
router.delete("/:id", async (req, res) => {
    try {
        const { error } = await supabase
            .from("equipment_assets")
            .delete()
            .eq("id", req.params.id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

// GET /assets/depreciation?year=2025
// Returns per-asset depreciation for a given tax year
router.get("/depreciation", async (req, res) => {
    try {
        const year = Number(req.query.year) || new Date().getFullYear();
        const { data, error } = await supabase
            .from("equipment_assets")
            .select("*")
            .order("purchase_date", { ascending: true });
        if (error) throw error;

        const results = (data || []).map(asset => {
            const purchaseYear = Number(String(asset.purchase_date).slice(0, 4));
            const disposalYear = asset.disposal_date ? Number(String(asset.disposal_date).slice(0, 4)) : null;
            const cost = Number(asset.cost_cents || 0) / 100;
            const life = Number(asset.useful_life_years || 5);
            const method = asset.depreciation_method || "straight_line";
            const yearsSincePurchase = year - purchaseYear;

            let deductionThisYear = 0;
            let totalDepreciated = 0;
            let remainingBasis = cost;
            let status = "active";

            if (purchaseYear > year) {
                status = "not_yet_purchased";
            } else if (disposalYear !== null && disposalYear < year) {
                status = "sold";
                deductionThisYear = 0;
                // Technically basis is 0 if sold, but we can show cost - depr up to sale
                const lifeSpent = Math.min(disposalYear - purchaseYear + 1, life);
                totalDepreciated = method === "section_179" ? cost : (cost / life) * lifeSpent;
                remainingBasis = 0;
            } else if (method === "section_179") {
                // Section 179: full deduction in year of purchase
                deductionThisYear = purchaseYear === year ? cost : 0;
                totalDepreciated = purchaseYear <= year ? cost : 0;
                remainingBasis = cost - totalDepreciated;
                status = purchaseYear < year ? "fully_depreciated" : "active";
            } else {
                // Straight-line depreciation
                const annualDeduction = cost / life;
                if (yearsSincePurchase >= life) {
                    status = "fully_depreciated";
                    totalDepreciated = cost;
                    deductionThisYear = 0;
                    remainingBasis = 0;
                } else if (yearsSincePurchase >= 0) {
                    deductionThisYear = annualDeduction;
                    totalDepreciated = annualDeduction * Math.min(yearsSincePurchase + 1, life);
                    remainingBasis = Math.max(0, cost - totalDepreciated);
                }
            }

            // Override status if sold this year
            if (disposalYear === year) status = "sold";

            return {
                id: asset.id,
                description: asset.description,
                category: asset.category,
                vendor: asset.vendor,
                purchase_date: asset.purchase_date,
                disposal_date: asset.disposal_date,
                disposal_value_cents: asset.disposal_value_cents,
                cost,
                useful_life_years: life,
                depreciation_method: method,
                serial_number: asset.serial_number,
                receipt_link: asset.receipt_link,
                deduction_this_year: Math.round(deductionThisYear * 100) / 100,
                total_depreciated: Math.round(totalDepreciated * 100) / 100,
                remaining_basis: Math.round(remainingBasis * 100) / 100,
                status,
                full_depreciation_date: method === "section_179" 
                    ? `Immediate (${purchaseYear})`
                    : (() => {
                        const d = new Date(asset.purchase_date + 'T00:00:00');
                        d.setFullYear(d.getFullYear() + life);
                        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    })()
            };
        });

        const totalDeductionCents = Math.round(results.reduce((s, r) => s + r.deduction_this_year, 0) * 100);

        res.json({ year, assets: results, total_deduction_cents: totalDeductionCents });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;
