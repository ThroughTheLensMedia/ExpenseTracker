const express = require("express");
const router = express.Router();
const { repairLedgerBatch, getGeminiModel } = require("../utils/gemini");

/**
 * AI Brain Entry Point - Intelligence Actions
 */

// POST /api/brain/repair-ledger
// Retroactive cleanup of existing "Rocket Money" entries and vendor names.
router.post("/repair-ledger", async (req, res) => {
    try {
        const { data: settings } = await req.sb
            .from("settings")
            .select("*")
            .eq("user_id", req.user.id)
            .maybeSingle();

        const apiKey = settings?.gemini_api_key;
        if (!apiKey) {
            return res.status(400).json({
                error: "AI Brain is missing its API key.",
                detail: "Go to Studio Control Center → AI Settings to set your Gemini API Key."
            });
        }

        // Fetch "Rocket Money" entries to fix (Targeted Scan)
        const { data: items, error } = await req.sb
            .from("expenses")
            .select("id, vendor, notes, source, category, expense_date")
            .eq("source", "rocketmoney")
            .order("expense_date", { ascending: false })
            .limit(50);

        if (error) throw error;
        if (!items || items.length === 0) return res.json({ ok: true, message: "Ledger is already clean." });

        // Process through Gemini
        const cleaned = await repairLedgerBatch(apiKey, items);

        // Update in DB (Batch updates in Supabase/Postgres)
        let updatedCount = 0;
        for (const item of cleaned) {
            await req.sb
                .from("expenses")
                .update({
                    vendor: item.vendor,
                    source: item.source,
                    category: item.category
                })
                .eq("id", item.id);
            updatedCount++;
        }

        res.json({ ok: true, scanned: items.length, updated: updatedCount, detail: cleaned });
    } catch (e) {
        console.error("AI Brain Error:", e);
        res.status(500).json({ error: formatAIError(e) });
    }
});

// POST /api/brain/ask
// Chat with the Assistant — Enhanced with deep financial intelligence
router.post("/ask", async (req, res) => {
    try {
        const { prompt, context } = req.body;

        console.log(`[AI Brain] Processing request for User: ${req.user.id} on page: ${context.page}`);

        const { data: settings, error: settingsError } = await req.sb
            .from("settings")
            .select("*")
            .eq("user_id", req.user.id)
            .maybeSingle();

        if (settingsError) {
            console.error("[AI Brain] Settings DB Error:", settingsError);
            return res.status(500).json({ error: "Database Link Error" });
        }

        const apiKey = settings?.gemini_api_key;
        if (!apiKey) {
            return res.status(400).json({ error: "No API Key found. Please set your key in the Control Center." });
        }

        const model = await getGeminiModel(apiKey);

        // --- Gather Rich Financial Intelligence Context ---
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const startOfYear = `${currentYear}-01-01`;
        const today = new Date().toISOString().slice(0, 10);

        // Parallel data fetches for speed
        const [
            { data: topPurchases },
            { data: allSpentRows },
            { count: totalArchivedItems },
            { data: recentTransactions },
            { data: categoryBreakdown },
            { data: taxDeductibleRows },
            { data: mileageLogs },
            { data: equipmentAssets },
            { data: mileageRateRows },
            { data: allLeads },
            { data: allInvoices },
        ] = await Promise.all([
            // Top 10 biggest purchases this year
            req.sb.from("expenses").select("vendor, amount_cents, expense_date, category")
                .gte("expense_date", startOfYear).order("amount_cents", { ascending: false }).limit(10),
            // All spending for the year
            req.sb.from("expenses").select("amount_cents, category, expense_date, tax_bucket, tax_deductible")
                .gte("expense_date", startOfYear),
            // Global archive count
            req.sb.from("expenses").select("*", { count: 'exact', head: true }),
            // Last 15 transactions (for recency context)
            req.sb.from("expenses").select("vendor, amount_cents, expense_date, category")
                .order("expense_date", { ascending: false }).limit(15),
            // Category spending breakdown YTD
            req.sb.from("expenses").select("category, amount_cents")
                .gte("expense_date", startOfYear),
            // Tax deductible total
            req.sb.from("expenses").select("amount_cents, tax_bucket")
                .gte("expense_date", startOfYear).eq("tax_deductible", true),
            // Mileage logs this year
            req.sb.from("mileage_logs").select("miles, log_date")
                .gte("log_date", startOfYear),
            // Equipment assets
            req.sb.from("equipment_assets").select("description, cost_cents, purchase_date, depreciation_method, useful_life_years")
                .limit(20),
            // IRS mileage rate for current year
            req.sb.from("mileage_rates").select("rate_per_mile").eq("year", currentYear).maybeSingle(),
            // CRM Leads pipeline
            req.sb.from("leads").select("name, status, quoted_value_cents, project_type, created_at"),
            // Invoices pipeline
            req.sb.from("invoices").select("status, total_cents, amount_paid_cents, issue_date"),
        ]);

        // Helper: cents to dollars
        const toDollars = (cents) => (Number(cents) || 0) / 100;
        const irsRate = mileageRateRows?.rate_per_mile ?? 0.70;

        // --- Compute Analytics ---
        const totalYearlySpend = (allSpentRows || []).reduce((acc, r) => acc + toDollars(r.amount_cents), 0);
        const totalDeductible = (taxDeductibleRows || []).reduce((acc, r) => acc + toDollars(r.amount_cents), 0);

        // Monthly spend breakdown
        const monthlySpend = {};
        (allSpentRows || []).forEach(r => {
            const month = String(r.expense_date || '').slice(0, 7); // YYYY-MM
            monthlySpend[month] = (monthlySpend[month] || 0) + toDollars(r.amount_cents);
        });
        const avgMonthlyBurn = currentMonth > 0 ? totalYearlySpend / currentMonth : 0;

        // Category totals
        const categoryTotals = {};
        (categoryBreakdown || []).forEach(r => {
            if (r.category) categoryTotals[r.category] = (categoryTotals[r.category] || 0) + toDollars(r.amount_cents);
        });
        const topCategories = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([cat, total]) => `${cat}: $${total.toFixed(2)}`);

        // Tax bucket breakdown
        const taxBuckets = {};
        (taxDeductibleRows || []).forEach(r => {
            if (r.tax_bucket) taxBuckets[r.tax_bucket] = (taxBuckets[r.tax_bucket] || 0) + toDollars(r.amount_cents);
        });

        // Mileage totals
        const totalMiles = (mileageLogs || []).reduce((acc, r) => acc + (r.miles || 0), 0);

        // CRM & Invoice Totals
        const bookedLeads = (allLeads || []).filter(l => l.status === 'Booked');
        const totalPipelineValue = (allLeads || []).reduce((acc, r) => acc + toDollars(r.quoted_value_cents), 0);
        const totalBookedValue = bookedLeads.reduce((acc, r) => acc + toDollars(r.quoted_value_cents), 0);
        
        const openInvoicesValue = (allInvoices || []).filter(i => i.status !== 'Paid').reduce((acc, r) => acc + toDollars(r.total_cents - (r.amount_paid_cents || 0)), 0);

        // Projected year-end burn
        const projectedAnnualBurn = avgMonthlyBurn * 12;

        // --- Estimate Quarterly Tax Deadlines ---
        const taxDeadlines = getTaxDeadlines(currentYear);
        const upcomingDeadlines = taxDeadlines
            .filter(d => d.date >= today)
            .slice(0, 2)
            .map(d => `${d.label}: ${d.date}`);

        const dataContext = `
REAL STUDIO DATA FOR ${currentYear} (as of ${today}):

FINANCIAL SUMMARY:
- Total YTD Spend: $${totalYearlySpend.toFixed(2)}
- Total Tax-Deductible: $${totalDeductible.toFixed(2)}
- Average Monthly Burn Rate: $${avgMonthlyBurn.toFixed(2)}/mo
- Projected Annual Burn: $${projectedAnnualBurn.toFixed(2)}
- Months Elapsed: ${currentMonth} of 12

TOP SPENDING CATEGORIES (YTD):
${topCategories.length > 0 ? topCategories.join("\n") : "No categorized spending yet."}

TOP 5 LARGEST TRANSACTIONS (YTD):
${(topPurchases && topPurchases.length > 0)
    ? topPurchases.slice(0, 5).map(p => `- ${p.vendor}: $${toDollars(p.amount_cents).toFixed(2)} on ${p.expense_date} [${p.category || 'Uncategorized'}]`).join("\n")
    : "None recorded yet for " + currentYear}

LAST 5 TRANSACTIONS (Most Recent Activity):
${(recentTransactions && recentTransactions.length > 0)
    ? recentTransactions.slice(0, 5).map(p => `- ${p.vendor}: $${toDollars(p.amount_cents).toFixed(2)} on ${p.expense_date}`).join("\n")
    : "No recent activity."}

MONTHLY BURN TREND:
${Object.entries(monthlySpend).sort().map(([m, v]) => `${m}: $${v.toFixed(2)}`).join("\n") || "No monthly data."}

TAX DEDUCTION BUCKETS (Schedule C):
${Object.entries(taxBuckets).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([b, v]) => `${b}: $${v.toFixed(2)}`).join("\n") || "No tax assignments yet."}

MILEAGE:
- Total Miles Logged (YTD): ${totalMiles} miles
- Estimated Mileage Deduction: $${(totalMiles * irsRate).toFixed(2)} (at $${irsRate.toFixed(3)}/mile — ${currentYear} IRS rate)

EQUIPMENT ASSETS:
${(equipmentAssets && equipmentAssets.length > 0)
    ? equipmentAssets.slice(0, 10).map(a => `- ${a.description}: $${toDollars(a.cost_cents).toFixed(2)} (${a.depreciation_method}, ${a.useful_life_years}yr life)`).join("\n")
    : "No equipment tracked yet."}

GLOBAL ARCHIVE: ${totalArchivedItems || 0}+ total historical items.

CRM PIPELINE (SALES & BOOKINGS):
- Total Active Leads: ${(allLeads || []).length} leads
- Total Booked Projects: ${bookedLeads.length} booked
- Pipeline Value (Total): $${totalPipelineValue.toFixed(2)}
- Pipeline Value (Booked): $${totalBookedValue.toFixed(2)}
- Outstanding Invoices (Unpaid): $${openInvoicesValue.toFixed(2)}
- Latest Bookings: ${bookedLeads.slice(0, 3).map(l => `${l.name} ($${toDollars(l.quoted_value_cents)})`).join(", ") || "None"}

UPCOMING TAX DEADLINES:
${upcomingDeadlines.length > 0 ? upcomingDeadlines.join("\n") : "No upcoming deadlines in the near term."}
        `;

        // Build context-aware prompt with forward-thinking persona
        const systemPrompt = `
You are "Your Assistant", an elite financial AI advisor for professional photographers using Lumière Ledger.
Current view: ${context.page}. Today's date: ${today}.

${dataContext}

PERSONA & BEHAVIOR:
- You are an expert CPA-level advisor who specializes in creative entrepreneurs and photographers.
- Your tone is confident, encouraging, analytical, and actionable. Never generic. Always reference the user's REAL data above.
- Format responses with clear headers and bullet points for readability.
- Use dollar amounts from the data. Never say "I don't have access to your data" — you DO.

FORWARD-THINKING INTELLIGENCE:
- Proactively analyze burn rate trends. If spending is accelerating month-over-month, flag it.
- Suggest tax-saving strategies: home office deduction, Section 179 for equipment, mileage optimization, meal deduction tips.
- Reference upcoming estimated tax deadlines and remind them to set aside ~25-30% of net profit.
- If they have uncategorized or unassigned expenses, suggest running the Automation Rules Engine.
- If equipment is approaching end of useful life, mention replacement planning.
- Compare their current year pace to projected annual totals.

CRITICAL RULES:
- If "Total YTD Spend" is $0, check the GLOBAL ARCHIVE count. If it has data, tell the user: "I see you have ${totalArchivedItems} transactions in your history, but none imported for ${currentYear} yet. Would you like to analyze a previous year or sync your recent bank data?"
- Never say "undefined" or "NaN" to the user.
- Never fabricate data. Only reference what's in the context above.
- Keep responses focused and under 500 words unless a detailed breakdown is requested.
        `;

        const result = await model.generateContent([systemPrompt, prompt]);
        const response = await result.response;
        const text = response.text().trim();

        res.json({ ok: true, answer: text });
    } catch (e) {
        console.error("[AI Brain] Critical Execution Error:", e);
        res.status(500).json({ error: formatAIError(e) });
    }
});

// --- Helpers ---

function formatAIError(e) {
    const msg = String(e.message || "");
    const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
    const isBusy = msg.includes("503") || msg.toLowerCase().includes("high demand") || msg.toLowerCase().includes("overloaded");

    if (isQuota) return "AI Quota Reached. Please wait exactly 60 seconds before your next request.";
    if (isBusy) return "The Intelligence Engine is currently experiencing high global demand. Please wait a few seconds and try again.";
    return "The Brain is currently recharging. Please try your search again in a moment.";
}

function getTaxDeadlines(year) {
    return [
        { date: `${year}-01-15`, label: `Q4 ${year - 1} Estimated Tax Payment` },
        { date: `${year}-04-15`, label: `Q1 ${year} Estimated Tax Payment & Tax Filing Deadline` },
        { date: `${year}-06-15`, label: `Q2 ${year} Estimated Tax Payment` },
        { date: `${year}-09-15`, label: `Q3 ${year} Estimated Tax Payment` },
    ];
}

module.exports = router;
