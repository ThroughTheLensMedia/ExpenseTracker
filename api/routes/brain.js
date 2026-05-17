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
            description: 'Search expenses and transactions from the ledger. Use for spending questions, category totals, vendor lookups, date-range queries, or tax deduction totals. Returns transaction IDs that can be used with link_transaction_to_lead.',
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
        },
        {
            name: 'get_accounts',
            description: 'List all bank accounts and credit cards that have transactions in the ledger. Use when the user asks about their accounts, banks, cards, or sources. Optionally filter by year.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    year: { type: 'INTEGER', description: 'Filter to only accounts with transactions in this year (e.g. 2026). Omit for all-time.' }
                }
            }
        },
        {
            name: 'get_invoice',
            description: 'Look up a SINGLE invoice by number, client name, or status. Call this ONCE PER INVOICE — never combine multiple invoice numbers into one call. Invoice numbers may be stored as "2026-0428"; partial matches work so "0428" will find "2026-0428". Strip any leading # before passing.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    invoice_number: { type: 'STRING', description: 'ONE invoice number only, e.g. "0428" or "2026-0428". Never pass multiple numbers here.' },
                    client_name:    { type: 'STRING', description: 'Client name — partial match' },
                    status:         { type: 'STRING', description: 'Filter by status: draft, sent, paid, void' },
                    limit:          { type: 'INTEGER', description: 'Max results (default 10)' }
                }
            }
        },

        // ── Write Tools (return pending confirmation — never execute directly) ──
        {
            name: 'update_lead_status',
            description: 'Update the status of a CRM lead. Always call get_lead first to get the exact lead ID. Returns a pending action for user confirmation — never executes directly.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    lead_id:   { type: 'STRING', description: 'UUID of the lead — get this from get_lead first' },
                    lead_name: { type: 'STRING', description: 'Lead name for display' },
                    status:    { type: 'STRING', description: 'New status: Inquiry, Contacted, Booked, Completed, Lost' }
                }
            }
        },
        {
            name: 'create_transaction',
            description: 'Create a new expense or income transaction in the ledger. Returns a pending action for user confirmation — never executes directly. If vendor, amount, or date are missing, ask the user before calling this tool.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    vendor:         { type: 'STRING',  description: 'Vendor or payee name — required' },
                    amount_dollars: { type: 'NUMBER',  description: 'Amount in dollars — required. Positive for expense, negative for income/refund.' },
                    date:           { type: 'STRING',  description: 'Transaction date YYYY-MM-DD — required. Use today if the user says "today".' },
                    category:       { type: 'STRING',  description: 'Category name' },
                    account:        { type: 'STRING',  description: 'Account or source name' },
                    notes:          { type: 'STRING',  description: 'Optional notes' }
                },
                required: ['vendor', 'amount_dollars', 'date']
            }
        },
        {
            name: 'link_transaction_to_lead',
            description: 'Link an existing transaction to a CRM lead. Returns a pending action for user confirmation — never executes directly.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    transaction_id:     { type: 'STRING', description: 'UUID of the transaction' },
                    transaction_vendor: { type: 'STRING', description: 'Vendor name for display' },
                    lead_id:            { type: 'STRING', description: 'UUID of the lead' },
                    lead_name:          { type: 'STRING', description: 'Lead name for display' }
                }
            }
        },
        {
            name: 'update_invoice_status',
            description: 'Mark an invoice as paid, sent, draft, or void. Always call get_invoice first to get the invoice UUID and total. Returns a pending action for user confirmation — never executes directly.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    invoice_id:     { type: 'STRING', description: 'UUID of the invoice — get this from get_invoice first' },
                    invoice_number: { type: 'STRING', description: 'Invoice number for display, e.g. "2026-0428"' },
                    client_name:    { type: 'STRING', description: 'Client name for display' },
                    status:         { type: 'STRING', description: 'New status: paid, sent, draft, void' },
                    amount_paid_cents: { type: 'INTEGER', description: 'Amount paid in cents — required when marking paid. Use the invoice total_cents if paid in full.' }
                },
                required: ['invoice_id', 'status']
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
                .select('id, vendor, amount_cents, expense_date, category, tax_deductible, tax_bucket, notes')
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
                    id: r.id,
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
                .select('status, total_cents, amount_paid_cents, issue_date, clients(name)')
                .eq('user_id', userId);
            if (args.status) q = q.eq('status', args.status);
            q = q.order('issue_date', { ascending: false }).limit(args.limit || 20);

            const { data, error } = await q;
            if (error) return { error: error.message };

            const paid        = (data || []).filter(i => i.status === 'paid').reduce((s, r) => s + toDollars(r.total_cents), 0);
            const outstanding = (data || []).filter(i => i.status !== 'paid').reduce((s, r) => s + toDollars(r.total_cents) - toDollars(r.amount_paid_cents), 0);

            return {
                count: data?.length || 0,
                total_revenue: fmt(paid),
                total_outstanding: fmt(outstanding),
                invoices: (data || []).map(r => ({
                    client: r.clients?.name || 'Unknown',
                    status: r.status,
                    total: fmt(toDollars(r.total_cents)),
                    paid: fmt(toDollars(r.amount_paid_cents)),
                    date: r.issue_date
                }))
            };
        }

        case 'get_lead': {
            let q = sb.from('leads')
                .select('id, name, status, quoted_value_cents, project_type, created_at')
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
                    id: r.id,
                    name: r.name,
                    status: r.status,
                    value: fmt(toDollars(r.quoted_value_cents)),
                    project_type: r.project_type,
                    created: r.created_at?.slice(0, 10)
                }))
            };
        }

        case 'get_invoice': {
            let q = sb.from('invoices')
                .select('id, invoice_number, status, total_cents, amount_paid_cents, issue_date, due_date, clients(name)')
                .eq('user_id', userId);
            if (args.invoice_number) q = q.ilike('invoice_number', `%${args.invoice_number.replace(/^#/, '')}%`);
            if (args.client_name)    q = q.ilike('clients.name', `%${args.client_name}%`);
            if (args.status)         q = q.eq('status', args.status);
            q = q.order('issue_date', { ascending: false }).limit(args.limit || 10);

            const { data, error } = await q;
            if (error) return { error: error.message };
            return {
                count: data?.length || 0,
                invoices: (data || []).map(r => ({
                    id: r.id,
                    invoice_number: r.invoice_number,
                    client: r.clients?.name || 'Unknown',
                    status: r.status,
                    total: fmt(toDollars(r.total_cents)),
                    total_cents: r.total_cents,
                    amount_paid: fmt(toDollars(r.amount_paid_cents)),
                    issued: r.issue_date,
                    due: r.due_date
                }))
            };
        }

        case 'get_accounts': {
            let q = sb.from('expenses')
                .select('source, expense_date')
                .eq('user_id', userId)
                .not('source', 'is', null);
            if (args.year) {
                q = q.gte('expense_date', `${args.year}-01-01`).lte('expense_date', `${args.year}-12-31`);
            }
            const { data, error } = await q;
            if (error) return { error: error.message };

            const counts = {};
            (data || []).forEach(r => {
                if (r.source) counts[r.source] = (counts[r.source] || 0) + 1;
            });
            const accounts = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([source, txCount]) => ({ account: source, transactions: txCount }));

            return {
                year_filter: args.year || 'all-time',
                total_accounts: accounts.length,
                accounts
            };
        }

        // ── Write tools — resolve entity, return pending (never write directly) ──

        case 'update_lead_status': {
            const { data: lead } = await sb.from('leads').select('id, name, status')
                .eq('id', args.lead_id).eq('user_id', userId).maybeSingle();
            if (!lead) return { error: `Lead not found with ID: ${args.lead_id}. Call get_lead first to find the correct ID.` };
            return {
                __pending: true,
                pendingAction: {
                    id: `pending_${Date.now()}`,
                    type: 'update_lead_status',
                    description: `Mark **${lead.name}** as **${args.status}** (currently: ${lead.status})`,
                    payload: { leadId: lead.id, leadName: lead.name, status: args.status }
                },
                message: `Pending confirmation: update ${lead.name} status to ${args.status}.`
            };
        }

        case 'create_transaction': {
            if (!args.vendor)         return { error: 'Missing vendor name. Ask the user for it before creating the transaction.' };
            if (!args.amount_dollars) return { error: 'Missing amount. Ask the user for the dollar amount before creating the transaction.' };
            if (!args.date)           return { error: 'Missing date. Ask the user for the transaction date before creating the transaction.' };
            const amountCents = Math.round(args.amount_dollars * 100);
            const display = `$${Math.abs(args.amount_dollars).toFixed(2)} — ${args.vendor} on ${args.date}${args.category ? ` [${args.category}]` : ''}`;
            return {
                __pending: true,
                pendingAction: {
                    id: `pending_${Date.now()}`,
                    type: 'create_transaction',
                    description: `Add **${args.vendor}** — **$${Math.abs(args.amount_dollars || 0).toFixed(2)}** on ${args.date}${args.category ? ` · ${args.category}` : ''}`,
                    payload: {
                        vendor: args.vendor,
                        amount_cents: amountCents,
                        expense_date: args.date,
                        category: args.category || null,
                        source: args.account || 'manual',
                        notes: args.notes || null
                    }
                },
                message: `Pending confirmation: add transaction ${display}.`
            };
        }

        case 'link_transaction_to_lead': {
            return {
                __pending: true,
                pendingAction: {
                    id: `pending_${Date.now()}`,
                    type: 'link_transaction_to_lead',
                    description: `Link **${args.transaction_vendor || args.transaction_id}** → **${args.lead_name || args.lead_id}**`,
                    payload: { transactionId: args.transaction_id, leadId: args.lead_id }
                },
                message: `Pending confirmation: link transaction to lead.`
            };
        }

        case 'update_invoice_status': {
            const { data: inv } = await sb.from('invoices')
                .select('id, invoice_number, status, total_cents, clients(name)')
                .eq('id', args.invoice_id).eq('user_id', userId).maybeSingle();
            if (!inv) return { error: `Invoice not found with ID: ${args.invoice_id}. Call get_invoice first.` };

            const newStatus = args.status;
            const isPaid = newStatus === 'paid';
            const amountPaidCents = isPaid
                ? (args.amount_paid_cents ?? inv.total_cents)
                : undefined;

            const clientName = inv.clients?.name || 'Unknown';
            const displayTotal = fmt(toDollars(inv.total_cents));
            const desc = isPaid
                ? `Mark invoice **#${inv.invoice_number}** (${clientName}) as **Paid** — ${displayTotal}`
                : `Mark invoice **#${inv.invoice_number}** (${clientName}) as **${newStatus}** (currently: ${inv.status})`;

            return {
                __pending: true,
                pendingAction: {
                    id: `pending_${Date.now()}`,
                    type: 'update_invoice_status',
                    description: desc,
                    payload: {
                        invoiceId: inv.id,
                        invoiceNumber: inv.invoice_number,
                        clientName: clientName,
                        status: newStatus,
                        ...(amountPaidCents !== undefined && { amount_paid_cents: amountPaidCents })
                    }
                },
                message: `Pending confirmation: update invoice #${inv.invoice_number} to ${newStatus}.`
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

You have live tools to query and update the ledger, invoices, CRM, and metrics.

RULES:
- For data questions: call the appropriate read tool and answer with real numbers.
- For write requests: always use a read tool first to get the exact UUID, then call the write tool.
- Write tools return a pending confirmation — tell the user Approve/Reject cards will appear.
- Never fabricate data. Never guess a UUID. If a lookup returns no results, tell the user exactly what was searched.

INVOICE RULES (critical):
- To mark invoices paid/sent/void: call get_invoice SEPARATELY for EACH invoice number — one tool call per number. Never combine multiple invoice numbers in a single get_invoice call.
- Invoice numbers may be partial: "0428" will match "2026-0428". Strip any # prefix.
- After each get_invoice returns a UUID, call update_invoice_status with that UUID.
- If marking paid, use total_cents as amount_paid_cents unless the user specifies a different amount.

TRANSACTION RULES:
- Before calling create_transaction, confirm you have: vendor name, dollar amount, and date. If any are missing, ask the user first.
- search_transactions returns transaction IDs — use them with link_transaction_to_lead.`,
        });

        const chat = model.startChat({ tools: BRAIN_TOOLS });
        let result = await chat.sendMessage(prompt);

        // Function calling loop — max 6 rounds
        // Supports multi-step requests (e.g. look up 2 invoices then write 2 updates = 4 rounds)
        // result is GenerateContentResult; text/functionCalls live on result.response
        const pendingActions = [];
        for (let round = 0; round < 6; round++) {
            const calls = result.response.functionCalls?.() ?? [];
            if (calls.length === 0) break;

            const toolResults = await Promise.all(
                calls.map(async (call) => {
                    console.log(`[AI Brain] Tool call: ${call.name}`, call.args);
                    const toolResult = await executeTool(call.name, call.args || {}, req.sb, req.user.id);
                    // Collect pending write actions; send clean status back to Gemini
                    if (toolResult.__pending) {
                        pendingActions.push(toolResult.pendingAction);
                        return { functionResponse: { name: call.name, response: { status: 'pending_confirmation', message: toolResult.message } } };
                    }
                    return { functionResponse: { name: call.name, response: toolResult } };
                })
            );

            result = await chat.sendMessage(toolResults);
        }

        const text = result.response.text().trim();
        if (!text) return res.status(500).json({ error: "The Brain returned an empty response. Try again." });

        res.json({ ok: true, answer: text, pendingActions: pendingActions.length > 0 ? pendingActions : undefined });

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
