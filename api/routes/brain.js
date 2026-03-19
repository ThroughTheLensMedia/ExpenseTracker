const express = require("express");
const router = express.Router();
const { repairLedgerBatch } = require("../utils/gemini");

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
            .select("id, vendor, notes, source, category, date")
            .eq("source", "rocketmoney")
            .order("date", { ascending: false })
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
        res.status(500).json({ error: e.message || "Something went wrong in the Brain." });
    }
});

// POST /api/brain/ask
// Chat with the Assistant
router.post("/ask", async (req, res) => {
    try {
        const { prompt, context } = req.body;
        
        // Detailed logging for debugging
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
            console.warn(`[AI Brain] No API Key found in settings for user: ${req.user.id}`);
            return res.status(400).json({ error: "No API Key found. Please set your key in the Control Center." });
        }

        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // --- STEP 1: Fetch Financial Intelligence Context ---
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(currentYear, 0, 1).toISOString();
        
        // Fetch Top 10 biggest purchases this year
        const { data: topPurchases } = await req.sb
            .from("expenses")
            .select("vendor, amount, date, category")
            .gte("date", startOfYear)
            .order("amount", { ascending: false })
            .limit(10);

        // Fetch total spending for the year
        const { data: allSpent } = await req.sb
            .from("expenses")
            .select("amount")
            .gte("date", startOfYear);
        
        const totalYearlySum = allSpent?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;

        const dataContext = `
            REAL STUDIO DATA FOR ${currentYear}:
            - Total Annual Studio Burn: $${totalYearlySum.toFixed(2)}
            - Your Largest Transactions:
              ${topPurchases?.slice(0, 5).map(p => `- ${p.vendor}: $${p.amount} on ${p.date}`).join("\n")}
        `;

        // Build context-aware prompt
        const systemPrompt = `
            You are "Your Assistant", an elite financial AI for professional photographers using Studio Tracker.
            Current view: ${context.page}.
            
            REAL-TIME ACCURATE DATA:
            ${dataContext}

            The user is a creative entrepreneur. Your tone should be encouraging, analytical, and providing first-class advice. 
            When they ask about "largest purchase" or "total spend", answer using the numbers provided above. 
            Keep answers concise and professional.
        `;

        const result = await model.generateContent([systemPrompt, prompt]);
        const response = await result.response;
        const text = response.text().trim();

        res.json({ ok: true, answer: text });
    } catch (e) {
        console.error("[AI Brain] Critical Execution Error:", e);
        const isQuota = e.message?.toLowerCase().includes("quota") || e.status === 429;
        res.status(500).json({ 
            error: isQuota 
                ? "AI Rate Limit Reached. Try again in 60 seconds." 
                : "The Brain is currently sleeping. Try again in a moment." 
        });
    }
});

module.exports = router;
