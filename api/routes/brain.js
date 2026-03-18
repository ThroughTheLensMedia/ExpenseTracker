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
        const { data: settings } = await req.sb
            .from("settings")
            .select("*")
            .eq("user_id", req.user.id)
            .maybeSingle();
        
        const apiKey = settings?.gemini_api_key;
        if (!apiKey) return res.status(400).json({ error: "No API Key" });

        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Build context-aware prompt
        const systemPrompt = `
            You are "Your Assistant", an elite financial AI for professional photographers using Studio Tracker.
            Business context: ${context.business || 'Private Photography Studio'}.
            Current view: ${context.page}.
            The user is a creative entrepreneur. Your tone should be encouraging, analytical, and "first-class advisor". 
            Do not make up numbers, but guide them on how to find them in the app.
            If they ask about taxes, remind them you are an AI, not a CPA.
            If they ask about Gear, remind them to check their Assets tab.
        `;

        const result = await model.generateContent([systemPrompt, prompt]);
        const response = await result.response;
        const text = response.text().trim();

        res.json({ ok: true, answer: text });
    } catch (e) {
        console.error("Brain Ask Error:", e);
        res.status(500).json({ error: "The Brain is currently sleeping. Try again in a moment." });
    }
});

module.exports = router;
