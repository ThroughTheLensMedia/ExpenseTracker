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
            .select("id, vendor, notes, source, category")
            .eq("source", "rocketmoney")
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

        res.json({ ok: true, updated: updatedCount, detail: cleaned });
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

        // Build context-aware prompt
        const systemPrompt = `
            You are "Your Assistant", an elite financial AI for professional photographers using Studio Tracker.
            Business context: ${context.business || 'Private Photography Studio'}.
            Current view: ${context.page}.
            The user is a creative entrepreneur. Your tone should be encouraging, analytical, and providing first-class advice. 
            Keep answers concise but high-value.
            Do not make up financial numbers; instead, interpret the trends they see on screen.
            If they ask about taxes, remind them you are an AI, not a CPA.
            If they ask about Gear, remind them to check their Assets tab.
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
