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

    const totals = Object.values(buckets).sort((a, b) => b.deductible_cents - a.deductible_cents || b.spend_cents - a.spend_cents);

    res.json({ year, totals, unassigned_count: unassignedCount });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    res.status(500).json({ error: String(e.message || e) });
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
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    res.status(500).json({ error: String(e.message || e) });
  }
});

// GET /tax/export.csv
router.get("/export.csv", async (req, res) => {
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
    for (const r of data) {
      const bucketName = (r.tax_bucket || "").trim() || "Unassigned";
      if (!buckets[bucketName]) {
        buckets[bucketName] = { bucket: bucketName, count: 0, spend_cents: 0, deductible_cents: 0 };
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

    const totals = Object.values(buckets).sort((a, b) => b.deductible_cents - a.deductible_cents || b.spend_cents - a.spend_cents);

    const header = ["year", "tax_bucket", "transaction_count", "spend", "deductible_spend"];
    const lines = [header.join(",")];

    for (const r of totals) {
      lines.push([
        year,
        csvEscape(r.bucket),
        r.count,
        (Number(r.spend_cents || 0) / 100).toFixed(2),
        (Number(r.deductible_cents || 0) / 100).toFixed(2)
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tax_summary_${year}.csv"`);
    res.send(lines.join("\n"));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

module.exports = router;
