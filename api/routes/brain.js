const express = require("express");
const router = express.Router();
const { repairLedgerBatch, getGeminiModel } = require("../utils/gemini");

// ─── Tool Definitions ────────────────────────────────────────────────────────
// Gemini function declarations — the model decides which to call based on the
// user's question. Replaces the old context-stuffing approach.

const BRAIN_TOOLS = [{
    functionDeclarations: [
        {
            name: 'search_transactions',
            description: 'Search expenses and transactions from the ledger. Use for spending questions, category totals, vendor lookups, date-range queries, or tax deduction totals.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    category:            { type: 'STRING',  description: 'Category to filter by (e.g. "Camera & Equipment", "Dining & Drinks")' },
                    start_date:          { type: 'STRING',  description: 'Start date YYYY-MM-DD' },
                    end_date:            { type: 'STRING',  description: 'End date YYYY-MM-DD' },
                    vendor:              { type: 'STRING',  description: 'Vendor name — partial match' },
                    tax_deductible:      { type: 'BOOLEAN', description: 'Filter to only tax-deductible expenses' },
                    min_amount_dollars:  { type: 'NUMBER',  description: 'Minimum transaction amount in dollars' },
                    limit:               { type: 'INTEGER', description: 'Max results (default 25, max 100)' }
                }
            }
        },
        {
            name: 'get_metrics_snapshot',
            description: 'Get aggregated YTD financial KPIs — total spend, deductibles, monthly burn rate, top categories, mileage deduction. Use for broad financial health questions.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    year: { type: 'INTEGER', description: 'Year to analyze (default: current year)' }
                }
            }
        },
        {
            name: 'get_invoice_summary',
            description: 'Get invoice data, payment status, and revenue totals. Use for income questions, unpaid invoices, and revenue tracking.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    status: { type: 'STRING',  description: 'Filter by status: draft, sent, paid' },
                    limit:  { type: 'INTEGER', description: 'Max results (default 20)' }
                }
            }
        },
        {
            name: 'get_lead',
            description: 'Get CRM leads and client pipeline data. Use for booking questions, pipeline value, lead status, and client lookups.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    status: { type: 'STRING',  description: 'Filter by status: Inquiry, Contacted, Booked, Completed, Lost' },
                    name:   { type: 'STRING',  description: 'Search by client name — partial match' },
                    limit:  { type: 'INTEGER', description: 'Max results (default 20)' }
                }
            }
        }
    ]
}];

// ─── Tool Executor ────────────────────────────────────────────────────────────

async function executeTool(name, args, sb, userId) {
    const toDollars = c => ((Number(c) || 0) / 100);
    const fmt = n => `$${n.toFixed(2)}`;

    switch (name) {

        case 'search_transactions': {
            let q = sb.from('expenses')
                .select('vendor, amount_cents, expense_date, category, tax_deductible, tax_bucket, notes')
                .eq('user_id', userId);
            if (args.category)           q = q.eq('category', args.category);
            if (args.start_date)         q = q.gte('expense_date', args.start_date);
            if (args.end_date)           q = q.lte('expense_date', args.end_date);
            if (args.vendor)             q = q.ilike('vendor', `%${args.vendor}%`);
            if (args.tax_deductible !== undefined) q = q.eq('tax_deductible', args.tax_deductible);
            if (args.min_amount_dollars) q = q.gte('amount_cents', Math.round(args.min_amount_dollars * 100));
            q = q.order('expense_date', { ascending: false }).limit(Math.min(args.limit || 25, 100));

            const { data, error } = await q;
            if (error) return { error: error.message };
            const total = (data || []).reduce((s, r) => s + (Number(r.amount_cents) || 0), 0);
            return {
                count: data?.length || 0,
                total: fmt(toDollars(total)),
                transactions: (data || []).map(r => ({
                    vendor: r.vendor,
                    amount: fmt(toDollars(r.amount_cents)),
                    date: r.expense_date,
                    category: r.category,
                    tax_deductible: r.tax_deductible
                }))
            };
        }

        case 'get_metrics_snapshot': {
            const year = args.year || new Date().getFullYear();
            const currentMonth = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
            const start = `${year}-01-01`;
            const end   = `${year}-12-31`;
            const today = new Date().toISOString().slice(0, 10);

            const [
                { data: expenses },
                { data: deductible },
                { count: totalCount },
                { data: mileage },
                { data: mileageRate }
            ] = await Promise.all([
                sb.from('expenses').select('amount_cents, category').eq('user_id', userId).gte('expense_date', start).lte('expense_date', end),
                sb.from('expenses').select('amount_cents, tax_bucket').eq('user_id', userId).gte('expense_date', start).eq('tax_deductible', true),
                sb.from('expenses').select('*', { count: 'exact', head: true }).eq('user_id', userId),
                sb.from('mileage_logs').select('miles').eq('user_id', userId).gte('log_date', start),
                sb.from('mileage_rates').select('rate_per_mile').eq('year', year).maybeSingle()
            ]);

            const totalSpend     = (expenses || []).reduce((s, r) => s + toDollars(r.amount_cents), 0);
            const totalDeductible = (deductible || []).reduce((s, r) => s + toDollars(r.amount_cents), 0);
            const totalMiles     = (mileage || []).reduce((s, r) => s + (r.miles || 0), 0);
            const irsRate        = mileageRate?.rate_per_mile || 0.70;

            const categoryTotals = {};
            (expenses || []).forEach(r => {
                if (r.category) categoryTotals[r.category] = (categoryTotals[r.category] || 0) + toDollars(r.amount_cents);
            });
            const topCategories = Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1]).slice(0, 6)
                .map(([cat, amt]) => `${cat}: ${fmt(amt)}`);

            // Upcoming estimated tax deadlines
            const deadlines = [
                { date: `${year}-04-15`, label: `Q1 ${year} Estimated Tax` },
                { date: `${year}-06-15`, label: `Q2 ${year} Estimated Tax` },
                { date: `${year}-09-15`, label: `Q3 ${year} Estimated Tax` },
                { date: `${year + 1}-01-15`, label: `Q4 ${year} Estimated Tax` }
            ].filter(d => d.date >= today).slice(0, 2);

            return {
                year,
                total_spend: fmt(totalSpend),
                total_tax_deductible: fmt(totalDeductible),
                avg_monthly_burn: fmt(totalSpend / currentMonth),
                projected_annual_burn: fmt((totalSpend / currentMonth) * 12),
                total_transactions: totalCount || 0,
                top_categories: topCategories,
                total_miles: totalMiles,
                mileage_deduction: fmt(totalMiles * irsRate),
                irs_rate: irsRate,
                upcoming_tax_deadlines: deadlines
            };
        }

        case 'get_invoice_summary': {
            let q = sb.from('invoices')
                .select('status, total_cents, amount_paid_cents, issue_date, client_name')
                .eq('user_id', userId);
            if (args.status) q = q.eq('status', args.status);
            q = q.order('issue_date', { ascending: false }).limit(args.limit || 20);

            const { data, error } = await q;
            if (error) return { error: error.message };

            const paid       = (data || []).filter(i => i.status === 'paid').reduce((s, r) => s + toDollars(r.total_cents), 0);
            const outstanding = (data || []).filter(i => i.status !== 'paid').reduce((s, r) => s + toDollars(r.total_cents) - toDollars(r.amount_paid_cents), 0);

            return {
                count: data?.length || 0,
                total_revenue: fmt(paid),
                total_outstanding: fmt(outstanding),
                invoices: (data || []).map(r => ({
                    client: r.client_name,
                    status: r.status,
                    total: fmt(toDollars(r.total_cents)),
                    paid: fmt(toDollars(r.amount_paid_cents)),
                    date: r.issue_date
                }))
            };
        }

        case 'get_lead': {
            let q = sb.from('leads')
                .select('name, status, quoted_value_cents, project_type, created_at')
                .eq('user_id', userId);
            if (args.status) q = q.eq('status', args.status);
            if (args.name)   q = q.ilike('name', `%${args.name}%`);
            q = q.order('created_at', { ascending: false }).limit(args.limit || 20);

            const { data, error } = await q;
            if (error) return { error: error.message };

            const totalValue = (data || []).reduce((s, r) => s + toDollars(r.quoted_value_cents), 0);
            return {
                count: data?.length || 0,
                total_pipeline_value: fmt(totalValue),
                leads: (data || []).map(r => ({
                    name: r.name,
                    status: r.status,
                    value: fmt(toDollars(r.quoted_value_cents)),
                    project_type: r.project_type,
                    created: r.created_at?.slice(0, 10)
                }))
            };
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

// ─── POST /api/brain/ask ──────────────────────────────────────────────────────

router.post("/ask", async (req, res) => {
    try {
        const { prompt, context } = req.body;

        const { data: settings, error: settingsError } = await req.sb
            .from("settings").select("*").eq("user_id", req.user.id).maybeSingle();
        if (settingsError) return res.status(500).json({ error: "Database Link Error" });

        const apiKey = settings?.gemini_api_key;
        if (!apiKey) return res.status(400).json({ error: "No API Key found. Please set your key in the Control Center." });

        const businessName = settings?.business_name || "your studio";
        const today = new Date().toISOString().slice(0, 10);

        const genAI = require("@google/generative-ai");
        const client = new genAI.GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `You are the Lumière Assistant — an elite financial AI advisor for ${businessName}, a professional photography business. Today is ${today}. Current view: ${context?.page || "dashboard"}.

You have live tools to query the ledger, invoices, CRM, and metrics. Always call a tool to get real data before answering financial questions. Be direct and specific — reference actual dollar amounts and dates from tool results. Never fabricate numbers.`,
        });

        const chat = model.startChat({ tools: BRAIN_TOOLS });
        let response = await chat.sendMessage(prompt);

        // Function calling loop — max 3 rounds
        for (let round = 0; round < 3; round++) {
            const calls = response.functionCalls?.() ?? [];
            if (calls.length === 0) break;

            const toolResults = await Promise.all(
                calls.map(async (call) => {
                    console.log(`[AI Brain] Tool call: ${call.name}`, call.args);
                    const result = await executeTool(call.name, call.args || {}, req.sb, req.user.id);
                    return { functionResponse: { name: call.name, response: result } };
                })
            );

            response = await chat.sendMessage(toolResults);
        }

        const text = response.text?.()?.trim();
        if (!text) return res.status(500).json({ error: "The Brain returned an empty response. Try again." });

        res.json({ ok: true, answer: text });

    } catch (e) {
        console.error("[AI Brain] Critical Execution Error:", e);
        res.status(500).json({ error: formatAIError(e) });
    }
});

// ─── POST /api/brain/repair-ledger ───────────────────────────────────────────

router.post("/repair-ledger", async (req, res) => {
    try {
        const { data: settings } = await req.sb
            .from("settings").select("*").eq("user_id", req.user.id).maybeSingle();

        const apiKey = settings?.gemini_api_key;
        if (!apiKey) return res.status(400).json({
            error: "AI Brain is missing its API key.",
            detail: "Go to Ledger Control Center → Intelligence to set your Gemini API Key."
        });

        const { data: items, error } = await req.sb
            .from("expenses").select("id, vendor, notes, source, category, expense_date")
            .eq("source", "rocketmoney")
            .order("expense_date", { ascending: false }).limit(50);

        if (error) throw error;
        if (!items || items.length === 0) return res.json({ ok: true, message: "Ledger is already clean." });

        const cleaned = await repairLedgerBatch(apiKey, items);

        let updatedCount = 0;
        for (const item of cleaned) {
            await req.sb.from("expenses")
                .update({ vendor: item.vendor, source: item.source, category: item.category })
                .eq("id", item.id);
            updatedCount++;
        }

        res.json({ ok: true, scanned: items.length, updated: updatedCount, detail: cleaned });
    } catch (e) {
        console.error("AI Brain Error:", e);
        res.status(500).json({ error: formatAIError(e) });
    }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAIError(e) {
    const msg = String(e.message || "");
    if (msg.includes("429") || msg.toLowerCase().includes("quota"))
        return "AI Quota Reached. Please wait 60 seconds before your next request.";
    if (msg.includes("503") || msg.toLowerCase().includes("overloaded") || msg.toLowerCase().includes("high demand"))
        return "The Intelligence Engine is experiencing high demand. Try again in a few seconds.";
    return "The Brain is currently recharging. Please try again in a moment.";
}

module.exports = router;
