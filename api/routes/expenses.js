const express = require("express");
const z = require("zod");
const { learnVendorRule } = require('../utils/vendorRules');

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
  expense_date: z.preprocess(v => {
    if (!v) return null;
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return v;
    return d.toISOString().split('T')[0];
  }, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)").optional().nullable()),
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
  receipt_link: z.string().trim().optional().nullable(),
  is_subscription: z.boolean().default(false)
});

const ExpenseUpdateSchema = ExpenseBaseSchema.partial();

// GET /expenses
router.get("/", async (req, res) => {
  try {
    const query = QuerySchema.parse(req.query);
    let builder = req.sb.from("expenses").select("*");

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

router.get("/years", async (req, res) => {
  try {
    // We only need the years, so we select just the column. 
    // To be safe with row caps, we'll ask for a high limit.
    const { data, error } = await req.sb
      .from("expenses")
      .select("expense_date")
      .not("expense_date", "is", null)
      .limit(20000); // 20k rows is usually plenty for year discovery

    if (error) throw error;
    const yearSet = new Set();
    for (const r of data || []) {
      const y = String(r.expense_date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) yearSet.add(Number(y));
    }
    // Always include current year even if no data
    yearSet.add(new Date().getFullYear());
    
    res.json({ years: [...yearSet].sort((a, b) => b - a) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// GET /expenses/export.csv
router.get("/export.csv", async (req, res) => {
  try {
    const query = QuerySchema.pick({ start: true, end: true }).parse(req.query);
    let builder = req.sb.from("expenses").select("*");

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
    const rawData = ExpenseBaseSchema.parse(req.body);
    const data = { ...rawData, user_id: req.user.id };

    // Tier limit: monthly transaction cap
    const txCap = req.tierLimits?.transactions_per_month;
    if (Number.isFinite(txCap)) {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const { count } = await req.sb
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .gte('created_at', monthStart);
      if (count >= txCap) {
        return res.status(403).json({
          error: 'tier_limit_reached',
          limit: txCap,
          tier: req.tier,
          message: `Your ${req.tier} plan allows ${txCap} transactions per month. Upgrade to add more.`,
        });
      }
    }

    if (!data.expense_date) data.expense_date = new Date().toISOString().slice(0, 10);

    // Auto tax_deductible: any business tax bucket implies deductible
    if (data.tax_bucket && data.tax_bucket !== 'Personal Expense') {
      data.tax_deductible = true;
    }

    const { data: inserted, error } = await req.sb
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
    const { data, error } = await req.sb
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

// PATCH /expenses/bulk-source — reassign source/account for a batch of transactions
// NOTE: must be registered BEFORE /:id to prevent Express matching "bulk-source" as an id param
router.patch("/bulk-source", async (req, res) => {
  try {
    const { ids, source } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids must be a non-empty array' });
    if (!source || typeof source !== 'string') return res.status(400).json({ error: 'source is required' });
    const numericIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
    if (!numericIds.length) return res.status(400).json({ error: 'No valid ids' });

    const { error, count } = await req.sb
      .from('expenses')
      .update({ source: source.trim() })
      .in('id', numericIds)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ ok: true, updated: count ?? numericIds.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// PATCH /expenses/:id
// Fields that trigger vendor rule learning when changed
const LEARNABLE_FIELDS = new Set(['category', 'tax_deductible', 'business_use_pct', 'tax_bucket']);

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = ExpenseUpdateSchema.parse(req.body);

    // Auto tax_deductible: setting any business tax bucket implies deductible
    // (only override if the request didn't already explicitly set tax_deductible to false)
    if ('tax_bucket' in data && data.tax_bucket && data.tax_bucket !== 'Personal Expense') {
      if (!('tax_deductible' in data) || data.tax_deductible !== false) {
        data.tax_deductible = true;
      }
    }

    const { data: updated, error } = await req.sb
      .from("expenses")
      .update(data)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ error: "Expense not found" });

    // Learn vendor rule if any categorization field changed — fire-and-forget (non-blocking)
    const hasLearnableChange = Object.keys(data).some(k => LEARNABLE_FIELDS.has(k));
    if (hasLearnableChange && updated.vendor) {
        learnVendorRule(req.sb, req.user.id, updated.vendor, {
            category:         updated.category,
            tax_deductible:   updated.tax_deductible,
            business_use_pct: updated.business_use_pct,
            tax_bucket:       updated.tax_bucket,
        });
    }

    res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    res.status(500).json({ error: String(e.message || e) });
  }
});

// DELETE /expenses/bulk-delete — must be registered before /:id
router.delete("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids must be a non-empty array' });
    const numericIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
    if (!numericIds.length) return res.status(400).json({ error: 'No valid ids' });

    const { error, count } = await req.sb
      .from('expenses')
      .delete()
      .in('id', numericIds)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ ok: true, deleted: numericIds.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// DELETE /expenses/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    // Defense-in-depth: explicitly filter by user_id even though RLS also enforces ownership.
    // This ensures correctness if RLS policies are ever accidentally dropped during migrations.
    const { error } = await req.sb
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) throw error;
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// PATCH /expenses/:id/resolve-review
// Resolves a near-duplicate review flag. action: 'keep_both' | 'delete_this' | 'delete_pair'
router.patch("/:id/resolve-review", async (req, res) => {
  try {
    const id = req.params.id;
    const { action } = req.body;
    if (!['keep_both', 'delete_this', 'delete_pair'].includes(action)) {
      return res.status(400).json({ error: "action must be keep_both, delete_this, or delete_pair" });
    }

    const { data: tx, error: txErr } = await req.sb
      .from("expenses").select("id, review_pair_id").eq("id", id).eq("user_id", req.user.id).single();
    if (txErr || !tx) return res.status(404).json({ error: "Transaction not found" });

    const pairId = tx.review_pair_id;

    if (action === "keep_both") {
      // Clear flags on both rows — user confirmed they are intentionally different
      if (pairId) await req.sb.from("expenses").update({ needs_review: false, review_pair_id: null }).eq("review_pair_id", pairId).eq("user_id", req.user.id);
    } else if (action === "delete_this") {
      await req.sb.from("expenses").delete().eq("id", id).eq("user_id", req.user.id);
      if (pairId) await req.sb.from("expenses").update({ needs_review: false, review_pair_id: null }).eq("review_pair_id", pairId).eq("user_id", req.user.id);
    } else if (action === "delete_pair") {
      // Delete the other row, keep this one
      if (pairId) {
        await req.sb.from("expenses").delete().eq("review_pair_id", pairId).neq("id", id).eq("user_id", req.user.id);
        await req.sb.from("expenses").update({ needs_review: false, review_pair_id: null }).eq("id", id).eq("user_id", req.user.id);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// POST /expenses/scan-dupes
// Scans existing transactions for likely duplicates (same amount_cents, date within ±2 days).
// Optionally scoped to a single account via { source }.
// Marks found pairs with needs_review=true and a shared review_pair_id.
// Skips pairs that are already flagged or already linked via plaid_transaction_id.
router.post("/scan-dupes", async (req, res) => {
  try {
    const { source } = req.body || {};

    let query = req.sb
      .from('expenses')
      .select('id, expense_date, amount_cents, vendor, source, needs_review, review_pair_id, plaid_transaction_id')
      .eq('user_id', req.user.id)
      .gt('amount_cents', 0); // expenses only

    if (source) query = query.eq('source', source);

    const { data: rows, error } = await query.order('expense_date', { ascending: true });
    if (error) throw error;
    if (!rows?.length) return res.json({ ok: true, found: 0, pairs: [] });

    // Group by amount_cents for fast candidate lookup
    const byAmount = {};
    for (const row of rows) {
      const k = String(row.amount_cents);
      if (!byAmount[k]) byAmount[k] = [];
      byAmount[k].push(row);
    }

    const pairs = [];
    const flagged = new Set();

    for (const group of Object.values(byAmount)) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          if (flagged.has(a.id) || flagged.has(b.id)) continue;
          // Skip if already linked as the same Plaid transaction
          if (a.plaid_transaction_id && a.plaid_transaction_id === b.plaid_transaction_id) continue;
          // Skip if already flagged for review together
          if (a.review_pair_id && a.review_pair_id === b.review_pair_id) continue;

          const dayDiff = Math.abs(
            (new Date(a.expense_date + 'T00:00:00') - new Date(b.expense_date + 'T00:00:00')) / 86400000
          );
          if (dayDiff > 2) continue;

          pairs.push({ a: a.id, b: b.id, amount_cents: a.amount_cents, vendorA: a.vendor, vendorB: b.vendor, dateA: a.expense_date, dateB: b.expense_date });
          flagged.add(a.id);
          flagged.add(b.id);
        }
      }
    }

    if (!pairs.length) return res.json({ ok: true, found: 0, pairs: [] });

    // Assign shared review_pair_id (UUID) and mark needs_review on each pair
    const { randomUUID } = require('crypto');
    for (const pair of pairs) {
      const pairId = randomUUID();
      await req.sb.from('expenses')
        .update({ needs_review: true, review_pair_id: pairId })
        .in('id', [pair.a, pair.b])
        .eq('user_id', req.user.id);
    }

    res.json({ ok: true, found: pairs.length, pairs });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// POST /expenses/manual-merge
// User selects two transactions and merges them. keepId is kept, deleteId is removed.
router.post("/manual-merge", async (req, res) => {
  try {
    const { keepId, deleteId } = req.body;
    if (!keepId || !deleteId) return res.status(400).json({ error: "keepId and deleteId required" });
    if (keepId === deleteId) return res.status(400).json({ error: "Cannot merge a transaction with itself" });

    // Verify both belong to this user (RLS + explicit filter)
    const { data: keep } = await req.sb.from("expenses").select("*").eq("id", keepId).eq("user_id", req.user.id).single();
    const { data: del }  = await req.sb.from("expenses").select("*").eq("id", deleteId).eq("user_id", req.user.id).single();
    if (!keep || !del) return res.status(404).json({ error: "One or both transactions not found" });

    // Apply user-selected field overrides (from MergeModal), then fall back to
    // auto-rescuing any missing fields from the deleted record.
    const { overrides = {} } = req.body;
    const ALLOWED_OVERRIDES = ['receipt_link', 'category', 'notes', 'tax_deductible', 'tax_bucket', 'business_use_pct'];
    const safeOverrides = {};
    for (const key of ALLOWED_OVERRIDES) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) safeOverrides[key] = overrides[key];
    }

    // Auto-rescue any fields not covered by overrides and missing from the kept record
    if (!('receipt_link'    in safeOverrides) && !keep.receipt_link    && del.receipt_link)    safeOverrides.receipt_link    = del.receipt_link;
    if (!('category'        in safeOverrides) && !keep.category        && del.category)        safeOverrides.category        = del.category;
    if (!('tax_bucket'      in safeOverrides) && !keep.tax_bucket      && del.tax_bucket)      safeOverrides.tax_bucket      = del.tax_bucket;
    if (!('tax_deductible'  in safeOverrides) && keep.tax_deductible == null && del.tax_deductible != null) safeOverrides.tax_deductible = del.tax_deductible;
    if (!('business_use_pct' in safeOverrides) && !keep.business_use_pct && del.business_use_pct) safeOverrides.business_use_pct = del.business_use_pct;

    // Notes: if not overridden, combine both
    if (!('notes' in safeOverrides)) {
      const combined = [keep.notes, del.notes].filter(Boolean).join(' | ');
      if (combined) safeOverrides.notes = combined;
    }

    const mergeNote = `[Merged: removed ${del.vendor} $${(Math.abs(del.amount_cents)/100).toFixed(2)} on ${del.expense_date}]`;
    const finalNotes = safeOverrides.notes
      ? `${safeOverrides.notes} | ${mergeNote}`
      : mergeNote;
    safeOverrides.notes = finalNotes;

    await req.sb.from("expenses")
      .update({ needs_review: false, review_pair_id: null, ...safeOverrides })
      .eq("id", keepId).eq("user_id", req.user.id);
    await req.sb.from("expenses").delete().eq("id", deleteId).eq("user_id", req.user.id);

    res.json({ ok: true, kept: { ...keep, ...safeOverrides }, rescued: Object.keys(safeOverrides) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

module.exports = router;
