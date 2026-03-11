const express = require("express");
const { supabase } = require("../db");
const z = require("zod");

const router = express.Router();

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const YearQuerySchema = z.object({
  year: z.coerce.number().min(1900).max(2500).default(() => new Date().getFullYear())
});

const TaxAssignSchema = z.object({
  year: z.coerce.number().min(1900).max(2500),
  category: z.string().trim().min(1, "category required"),
  tax_bucket: z.string().trim().min(1, "tax_bucket required"),
  tax_deductible: z.union([z.boolean(), z.coerce.number()]).transform(v => (v === true || v === 1 ? true : false)).optional(),
  business_use_pct: z.coerce.number().min(0).max(100).optional()
});

async function fetchDepreciationTotal(year) {
  try {
    const { data, error } = await supabase.from("equipment_assets").select("*");
    if (error || !data) return 0;

    let totalCents = 0;
    for (const asset of data) {
      const purchaseYear = Number(String(asset.purchase_date).slice(0, 4));
      const cost = Number(asset.cost_cents || 0) / 100;
      const life = Number(asset.useful_life_years || 5);
      const method = asset.depreciation_method || "straight_line";
      const yearsSincePurchase = year - purchaseYear;

      if (purchaseYear > year) continue;

      if (method === "section_179") {
        if (purchaseYear === year) totalCents += (cost * 100);
      } else {
        // Straight-line 5-year default
        const annualDeduction = cost / life;
        if (yearsSincePurchase >= 0 && yearsSincePurchase < life) {
          totalCents += Math.round(annualDeduction * 100);
        }
      }
    }
    return totalCents;
  } catch (e) {
    console.error("Depreciation calc failed:", e);
    return 0;
  }
}

// GET /tax/summary
router.get("/summary", async (req, res) => {
  try {
    const { year } = YearQuerySchema.parse(req.query);
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const { data, error } = await supabase
      .from("expenses")
      .select("tax_bucket, amount_cents, tax_deductible, business_use_pct")
      .gte("expense_date", start)
      .lte("expense_date", end);

    if (error) throw error;

    const buckets = {};
    let unassignedCount = 0;

    for (const r of data) {
      const bucketName = (r.tax_bucket || "").trim() || "Unassigned";
      if (bucketName === "Unassigned") unassignedCount++;

      if (!buckets[bucketName]) {
        buckets[bucketName] = { tax_bucket: bucketName, count: 0, spend_cents: 0, deductible_cents: 0 };
      }

      const b = buckets[bucketName];
      b.count++;
      const amt = r.amount_cents || 0;
      if (amt > 0) {
        b.spend_cents += amt;
        if (r.tax_deductible) {
          const pct = (r.business_use_pct === null || r.business_use_pct === undefined) ? 100 : r.business_use_pct;
          b.deductible_cents += Math.round(amt * (pct / 100.0));
        }
      }
    }

    // INJECT DEPRECIATION FROM ASSETS TABLE (Line 13)
    const assetDeprCents = await fetchDepreciationTotal(year);
    if (assetDeprCents > 0) {
      if (!buckets["Depreciation"]) {
        buckets["Depreciation"] = { tax_bucket: "Depreciation", count: 0, spend_cents: 0, deductible_cents: 0 };
      }
      // Note: We "add" it to any existing manual depreciation entries, 
      // but usually the equipment tab is the primary source.
      buckets["Depreciation"].deductible_cents += assetDeprCents;
      // We also add to spend_cents so the row stays solid in UI
      if (buckets["Depreciation"].spend_cents < buckets["Depreciation"].deductible_cents) {
        buckets["Depreciation"].spend_cents = buckets["Depreciation"].deductible_cents;
      }
    }

    const totals = Object.values(buckets).sort((a, b) => b.deductible_cents - a.deductible_cents || b.spend_cents - a.spend_cents);

    res.json({ year, totals, unassigned_count: unassignedCount });
  } catch (e) {
    console.error("[API] GET /tax/summary Error:", e);
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    res.status(500).json({ error: e.message || String(e), code: e.code });
  }
});

// POST /tax/assign
router.post("/assign", async (req, res) => {
  try {
    const data = TaxAssignSchema.parse(req.body);
    const start = `${data.year}-01-01`;
    const end = `${data.year}-12-31`;

    const updateData = {
      tax_bucket: data.tax_bucket
    };
    if (data.tax_deductible !== undefined) updateData.tax_deductible = data.tax_deductible;
    if (data.business_use_pct !== undefined) updateData.business_use_pct = data.business_use_pct;

    const { error, count } = await supabase
      .from("expenses")
      .update(updateData)
      .gte("expense_date", start)
      .lte("expense_date", end)
      .eq("category", data.category);

    if (error) throw error;

    res.json({ ok: true, updated: count });
  } catch (e) {
    console.error("[API] POST /tax/assign Error:", e);
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    res.status(500).json({ error: e.message || String(e), code: e.code });
  }
});

// POST /tax/auto-map -- maps Rocket Money categories to Schedule C lines
router.post("/auto-map", async (req, res) => {
  try {
    const RM_MAPPING = [
      { categories: ['Bills & Utilities'], bucket: 'Utilities', deductible: false, pct: 100 },
      { categories: ['Auto & Transport', 'Fuel (Van)', 'Gas & Fuel'], bucket: 'Car and truck', deductible: true, pct: 50 },
      { categories: ['Travel & Vacation', 'Travel', 'Harvest host', 'Booking.com'], bucket: 'Travel', deductible: true, pct: 100 },
      { categories: ['Dining & Drinks', 'Food & Dining', 'Restaurants'], bucket: 'Meals (50%)', deductible: true, pct: 50 },
      { categories: ['Software & Tech', 'Office Supplies', 'Software', 'Electronics & Software'], bucket: 'Office expense', deductible: true, pct: 100 },
      { categories: ['Advertising', 'The Print Shop'], bucket: 'Advertising', deductible: true, pct: 100 },
      { categories: ['Insurance (Business)', 'Insurance'], bucket: 'Insurance', deductible: true, pct: 100 },
      { categories: ['Professional Services', 'Legal', 'TaxAct'], bucket: 'Legal and professional', deductible: true, pct: 100 },
      { categories: ['Photography', 'Camera & Photo', 'Equipment', 'Amazon'], bucket: 'Supplies', deductible: true, pct: 100 },
      { categories: ['TNSOS', 'IAPP Press'], bucket: 'Taxes and licenses', deductible: true, pct: 100 },
      { categories: ['T-mobile', 'Phone'], bucket: 'Utilities', deductible: true, pct: 50 }
    ];

    let totalUpdated = 0;

    // First: Map specific requested vendors to their proper tax buckets
    const VENDOR_MAPPING = [
      { vendor: 't-mobile', bucket: 'Utilities', deductible: true, pct: 50 },
      { vendor: 'tnsos', bucket: 'Taxes and licenses', deductible: true, pct: 100 },
      { vendor: 'iapp press', bucket: 'Taxes and licenses', deductible: true, pct: 100 },
      { vendor: 'booking', bucket: 'Travel', deductible: true, pct: 100 },
      { vendor: 'amazon', bucket: 'Supplies', deductible: true, pct: 100 },
      { vendor: 'taxact', bucket: 'Legal and professional', deductible: true, pct: 100 },
      { vendor: 'harvest', bucket: 'Travel', deductible: true, pct: 100 },
      { vendor: 'print shop', bucket: 'Advertising', deductible: true, pct: 100 }
    ];

    for (const vmap of VENDOR_MAPPING) {
      const { error, count } = await supabase
        .from("expenses")
        .update({
          tax_bucket: vmap.bucket,
          tax_deductible: vmap.deductible,
          business_use_pct: vmap.pct
        })
        .ilike("vendor", `%${vmap.vendor}%`)
        .eq("tax_bucket", "");
      if (!error && count) totalUpdated += count;
    }

    // New: Auto-mark specific INCOME categories as business income (Line 1)
    const INCOME_CATEGORIES = ['Photo Income', 'Freelance Income', 'Contract Income', 'Side Income'];
    const { error: incError, count: incCount } = await supabase
      .from("expenses")
      .update({ tax_deductible: true })
      .in("category", INCOME_CATEGORIES)
      .lt("amount_cents", 0);
    if (!incError && incCount) totalUpdated += incCount;

    // Fix: Un-mark expense returns (like Amazon refunds) that were accidentally flagged as Line 1 income
    const { error: fixError } = await supabase
      .from("expenses")
      .update({ tax_deductible: false })
      .lt("amount_cents", 0)
      .not("category", "in", `(${INCOME_CATEGORIES.map(c => `'${c}'`).join(',')})`);

    // Then: Map the categories for expenses as normal
    for (const mapping of RM_MAPPING) {
      for (const cat of mapping.categories) {
        const { error, count } = await supabase
          .from("expenses")
          .update({
            tax_bucket: mapping.bucket,
            tax_deductible: mapping.deductible,
            business_use_pct: mapping.pct
          })
          .eq("category", cat)
          .eq("tax_bucket", "") // Only update unassigned items
        if (!error && count) totalUpdated += count;
      }
    }

    res.json({ ok: true, updated: totalUpdated });
  } catch (e) {
    console.error("[API] POST /tax/auto-map Error:", e);
    res.status(500).json({ error: e.message || String(e), code: e.code });
  }
});

// GET /tax/export.csv  – full line-item export (CPA-ready)
router.get("/export.csv", async (req, res) => {
  try {
    const { year } = YearQuerySchema.parse(req.query);
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    // Fetch all fields needed for line-item detail
    const { data, error } = await supabase
      .from("expenses")
      .select("expense_date, vendor, category, tax_bucket, amount_cents, tax_deductible, business_use_pct, notes")
      .gte("expense_date", start)
      .lte("expense_date", end)
      .order("tax_bucket", { ascending: true })
      .order("expense_date", { ascending: true });

    if (error) throw error;

    const SCHEDULE_C = {
      'Advertising': 'Line 8', 'Car and truck': 'Line 9', 'Commissions and fees': 'Line 10',
      'Contract labor': 'Line 11', 'Depreciation': 'Line 13', 'Insurance': 'Line 15',
      'Interest': 'Line 16b', 'Legal and professional': 'Line 17', 'Office expense': 'Line 18',
      'Rent/lease': 'Line 20b', 'Repairs and maintenance': 'Line 21', 'Supplies': 'Line 22',
      'Taxes and licenses': 'Line 23', 'Travel': 'Line 24a', 'Meals (50%)': 'Line 24b',
      'Utilities': 'Line 25', 'Wages': 'Line 26', 'Other': 'Line 27a',
    };

    const header = ["year", "date", "vendor", "category", "tax_bucket", "schedule_c_line",
      "amount", "business_use_pct", "deductible_amount", "tax_deductible", "notes"];
    const lines = [header.join(",")];

    for (const r of data) {
      const amt = Number(r.amount_cents || 0) / 100;
      const pct = (r.business_use_pct === null || r.business_use_pct === undefined) ? 100 : r.business_use_pct;
      const deductible = r.tax_deductible ? (amt * pct / 100).toFixed(2) : "0.00";
      const bucket = (r.tax_bucket || "").trim() || "Unassigned";
      lines.push([
        year,
        csvEscape(r.expense_date),
        csvEscape(r.vendor),
        csvEscape(r.category),
        csvEscape(bucket),
        csvEscape(SCHEDULE_C[bucket] || ""),
        amt.toFixed(2),
        pct,
        deductible,
        r.tax_deductible ? "Yes" : "No",
        csvEscape(r.notes || "")
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tax_line_items_${year}.csv"`);
    res.send(lines.join("\n"));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

module.exports = router;
