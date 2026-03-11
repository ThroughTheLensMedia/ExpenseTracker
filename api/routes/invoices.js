const express = require("express");
const { supabase } = require("../db");
const z = require("zod");

const router = express.Router();

const ClientSchema = z.object({
    name: z.string().trim().min(1),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

const InvoiceItemSchema = z.object({
    description: z.string().min(1),
    quantity: z.number().default(1),
    unit_price_cents: z.number().int(),
});

const InvoiceSchema = z.object({
    client_id: z.coerce.number().int(),
    invoice_number: z.string().min(1),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    status: z.enum(["draft", "sent", "paid", "void"]).default("draft"),
    notes: z.string().optional().nullable(),
    tax_percent: z.number().min(0).max(100).default(0),
    discount_cents: z.number().int().default(0),
    lead_id: z.coerce.number().int().optional().nullable(),
    items: z.array(InvoiceItemSchema).min(1),
});

// --- CLIENTS ---

router.get("/clients", async (req, res) => {
    try {
        const { data, error } = await supabase.from("clients").select("*").order("name");
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post("/clients", async (req, res) => {
    try {
        const body = ClientSchema.parse(req.body);
        const { data, error } = await supabase.from("clients").insert(body).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// --- INVOICES ---

router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("invoices")
            .select("*, clients(name, email)")
            .order("issue_date", { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("invoices")
            .select("*, clients(*), invoice_items(*)")
            .eq("id", req.params.id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(404).json({ error: "Invoice not found" });
    }
});

router.post("/", async (req, res) => {
    try {
        const body = InvoiceSchema.parse(req.body);
        const { items, ...invoiceData } = body;

        // 1. Insert Invoice
        const { data: invoice, error: invError } = await supabase
            .from("invoices")
            .insert(invoiceData)
            .select()
            .single();

        if (invError) throw invError;

        // 2. Insert Items
        const itemsWithId = items.map(item => ({ ...item, invoice_id: invoice.id }));
        const { error: itemsError } = await supabase.from("invoice_items").insert(itemsWithId);

        if (itemsError) throw itemsError;

        res.json(invoice);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.patch("/:id", async (req, res) => {
    try {
        const { status, notes } = req.body;
        const { data, error } = await supabase
            .from("invoices")
            .update({ status, notes, updated_at: new Date() })
            .eq("id", req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const { error } = await supabase.from("invoices").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
