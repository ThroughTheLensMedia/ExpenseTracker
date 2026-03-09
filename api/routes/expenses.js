const express = require("express");
const { supabase } = require("../db");
const z = require("zod");

const router = express.Router();

// Helper functions
function nowIso() {
  return new Date().toISOString();
}

// Zod Schemas for robust validation
const QuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format").optional().nullable(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format").optional().nullable(),
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(50000).default(2000),
  offset: z.coerce.number().min(0).default(0),
});

const ExpenseBaseSchema = z.object({
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)").optional().nullable(),
  vendor: z.string().trim().optional().default(""),
  category: z.string().trim().optional().default(""),
  amount_cents: z.coerce.number().default(0),
  currency: z.string().trim().default("USD"),
  notes: z.string().trim().optional().default(""),
  source: z.string().trim().default("manual"),
  rm_id: z.string().trim().optional().nullable(),
  tax_deductible: z.union([z.boolean(), z.coerce.number()]).transform(v => (v === true || v === 1 ? true : false)).default(false),
  tax_bucket: z.string().trim().optional().default(""),
  business_use_pct: z.coerce.number().min(0).max(100).default(100),
  receipt_link: z.string().trim().optional().nullable()
});

const ExpenseUpdateSchema = ExpenseBaseSchema.partial();

// GET /expenses
router.get("/", async (req, res) => {
  try {
    const query = QuerySchema.parse(req.query);
    let builder = supabase.from("expenses").select("*");

    if (query.start) builder = builder.gte("expense_date", query.start);
    if (query.end) builder = builder.lte("expense_date", query.end);
    if (query.q) {
      builder = builder.or(`vendor.ilike.%${query.q}%,category.ilike.%${query.q}%,notes.ilike.%${query.q}%`);
    }

    const { data, error } = await builder
      .order("expense_date", { ascending: false })
      .order("id", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) throw error;

    res.json({ rows: data, limit: query.limit, offset: query.offset });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    res.status(500).json({ error: String(e.message || e) });
  }
});

// GET /expenses/years – returns distinct years that have data (lightweight, no row cap issues)
router.get("/years", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("expense_date")
      .not("expense_date", "is", null);
    if (error) throw error;
    const yearSet = new Set();
    for (const r of data || []) {
      const y = String(r.expense_date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) yearSet.add(Number(y));
    }
    res.json({ years: [...yearSet].sort((a, b) => b - a) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// GET /expenses/export.csv
router.get("/export.csv", async (req, res) => {
  try {
    const query = QuerySchema.pick({ start: true, end: true }).parse(req.query);
    let builder = supabase.from("expenses").select("*");

    if (query.start) builder = builder.gte("expense_date", query.start);
    if (query.end) builder = builder.lte("expense_date", query.end);

    const { data, error } = await builder
      .order("expense_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) throw error;

    const csvEscape = (v) => {
      const s = String(v ?? "");
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = ["date", "vendor", "category", "amount", "currency", "notes", "source", "rm_id", "tax_deductible", "tax_bucket", "business_use_pct", "receipt_link"];
    const lines = [header.join(",")];

    for (const r of data) {
      lines.push([
        csvEscape(r.expense_date), csvEscape(r.vendor), csvEscape(r.category),
        (Number(r.amount_cents || 0) / 100).toFixed(2), csvEscape(r.currency),
        csvEscape(r.notes), csvEscape(r.source), csvEscape(r.rm_id || ""),
        r.tax_deductible ? "1" : "0", csvEscape(r.tax_bucket || ""),
        String(r.business_use_pct ?? 100), csvEscape(r.receipt_link || "")
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="expenses_export.csv"`);
    res.send(lines.join("\n"));
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// POST /expenses
router.post("/", async (req, res) => {
  try {
    const data = ExpenseBaseSchema.parse(req.body);
    if (!data.expense_date) data.expense_date = new Date().toISOString().slice(0, 10);

    const { data: inserted, error } = await supabase
      .from("expenses")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    res.json(inserted);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    res.status(500).json({ error: String(e.message || e) });
  }
});

// POST /expenses/bulk
router.post("/bulk", async (req, res) => {
  try {
    let items = Array.isArray(req.body) ? req.body : (Array.isArray(req.body.items) ? req.body.items : null);
    if (!items) return res.status(400).json({ error: "Expected array (or {items:[]})." });

    const parsedItems = z.array(ExpenseBaseSchema).parse(items);

    // Upsert using rm_id as uniqueness constraint
    const { data, error } = await supabase
      .from("expenses")
      .upsert(parsedItems, { onConflict: 'rm_id' })
      .select();

    if (error) throw error;
    res.json({ ok: true, count: data.length });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    res.status(500).json({ error: String(e.message || e) });
  }
});

// PATCH /expenses/:id
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = ExpenseUpdateSchema.parse(req.body);
    const { data: updated, error } = await supabase
      .from("expenses")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ error: "Expense not found" });
    res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    res.status(500).json({ error: String(e.message || e) });
  }
});

// DELETE /expenses/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { error, count } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) throw error;
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

module.exports = router;
