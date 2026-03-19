const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * AI Brain Core - Google Gemini 2.5 Flash Integration
 * 
 * Why 2.5 Flash? 
 * It is the industry standard for high-speed, cost-effective 
 * text processing in 2026.
 */

async function getGeminiModel(apiKey) {
    if (!apiKey) throw new Error("Gemini API Key is required to power the AI Brain.");
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

/**
 * Intelligent Transaction Categorizer & Normalizer
 * Process batches of transactions to clean up data and assign categories.
 */
async function repairLedgerBatch(apiKey, transactions) {
    const model = await getGeminiModel(apiKey);

    const prompt = `
        You are the "Intelligence Engine" for Studio Tracker, a financial tool for photographers.
        I will provide a JSON list of transactions. Your job is to:
        1. Clean the 'vendor' name (e.g., "AMZN MKTP US*123" -> "Amazon", "UT STATE PARKS SALT LAKE" -> "Utah State Parks").
        2. Identify the likely 'account' if it is missing or says "Rocket Money", using the 'notes' or context.
        3. Assign a 'category' from this list: [Advertising, Auto & Transport, Bills & Utilities, Camera & Equipment, Clothing, Dining & Drinks, Education, Entertainment, Gas & Fuel, Groceries, Health & Medical, Home & Garden, Insurance (Business), Insurance (Personal), Office Supplies, Parking & Tolls, Personal Care, Pets, Photography, Professional Services, Rent / Lease, Repairs & Maintenance, Shopping, Software & Tech, Subscriptions, Supplies, Taxes & Licenses, Travel & Vacation, Personal Expense, Photo Income, Freelance Income, Contract Income, Rental Income, Side Income].
        
        RETURN ONLY A JSON ARRAY of objects with: { "id": original_id, "vendor": "Cleaned Name", "source": "Account Name", "category": "Category Name" }.
        Do not include any text other than the JSON array.

        Transactions:
        ${JSON.stringify(transactions)}
    `;

    let attempt = 0;
    while (attempt < 2) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();
            const cleanedText = text.replace(/```json|```/g, "").trim();
            return JSON.parse(cleanedText);
        } catch (err) {
            attempt++;
            const isBusy = err.message?.toLowerCase().includes("503") || err.message?.toLowerCase().includes("high demand") || err.status === 503;
            if (isBusy && attempt < 2) {
                console.warn(`[AI BRAIN] Gemini is busy (503). Retrying in 1.2s... (Attempt ${attempt})`);
                await new Promise(r => setTimeout(r, 1200));
                continue;
            }
            throw err;
        }
    }
}

module.exports = {
    repairLedgerBatch
};
