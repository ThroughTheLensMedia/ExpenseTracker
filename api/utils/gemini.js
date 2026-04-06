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
 * 2B-2: Batch requests into 500-txn chunks to stay within model reliability limits.
 */
async function repairLedgerBatch(apiKey, transactions) {
    if (!transactions || transactions.length === 0) return [];
    const model = await getGeminiModel(apiKey);
    const CHUNK_SIZE = 500;
    const finalResults = [];

    // 2C: Strip user_id/invoice_id from Gemini payload for ~60% reduction
    const sourceData = transactions.map(t => ({
        id: t.id,
        vendor: t.vendor,
        amount_cents: t.amount_cents,
        category: t.category,
        notes: t.notes,
        source: t.source || 'manual'
    }));

    for (let i = 0; i < sourceData.length; i += CHUNK_SIZE) {
        const chunk = sourceData.slice(i, i + CHUNK_SIZE);
        const prompt = `
            You are the "Intelligence Engine" for Studio Tracker, a financial tool for photographers.
            I will provide a JSON list of transactions. Your job is to:
            1. Clean the 'vendor' name (e.g., "AMZN MKTP US*123" -> "Amazon", "UT STATE PARKS SALT LAKE" -> "Utah State Parks").
            2. Identify the likely 'account' if it is missing or says "Rocket Money", using the 'notes' or context.
            3. Assign a 'category' from this list: [Advertising, Auto & Transport, Bills & Utilities, Camera & Equipment, Clothing, Dining & Drinks, Education, Entertainment, Gas & Fuel, Groceries, Health & Medical, Home & Garden, Insurance (Business), Insurance (Personal), Office Supplies, Parking & Tolls, Personal Care, Pets, Photography, Professional Services, Rent / Lease, Repairs & Maintenance, Shopping, Software & Tech, Subscriptions, Supplies, Taxes & Licenses, Travel & Vacation, Personal Expense, Photo Income, Freelance Income, Contract Income, Rental Income, Side Income, Dividend Income, Interest Income].

            RETURN ONLY A JSON ARRAY of objects with: { "id": original_id, "vendor": "Cleaned Name", "source": "Account Name", "category": "Category Name" }.
            Do not include any text other than the JSON array.

            Transactions:
            ${JSON.stringify(chunk)}
        `;

        let attempt = 0;
        let chunkResult = null;
        while (attempt < 3) {
            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text().trim();
                const cleanedText = text.replace(/```json|```/g, "").trim();
                chunkResult = JSON.parse(cleanedText);
                break;
            } catch (err) {
                attempt++;
                const isBusy = (err.status === 503 || err.message?.includes("503") || err.message?.includes("high demand"));
                if (isBusy && attempt < 3) {
                    await new Promise(r => setTimeout(r, attempt * 1500));
                    continue;
                }
                throw err;
            }
        }
        if (chunkResult) finalResults.push(...chunkResult);
    }
    return finalResults;
}

/**
 * Smart Auto-Categorizer for new transactions coming through Plaid or CSV import.
 * Uses lighter prompt for single-transaction or small batch classification.
 */
async function classifyTransactions(apiKey, transactions) {
    if (!transactions || transactions.length === 0) return [];
    const model = await getGeminiModel(apiKey);
    const CHUNK_SIZE = 500;
    const finalResults = [];

    // 2C: Strip user_id/invoice_id from Gemini payload
    const sourceData = transactions.map(t => ({
        id: t.id,
        vendor: t.vendor,
        amount_cents: t.amount_cents,
        notes: t.notes,
        category: t.category
    }));

    for (let i = 0; i < sourceData.length; i += CHUNK_SIZE) {
        const chunk = sourceData.slice(i, i + CHUNK_SIZE);
        const prompt = `
            You are the Intelligence Engine for Studio Tracker, a financial tool for professional photographers.

            Classify these transactions. For each, assign:
            - category: From [Advertising, Auto & Transport, Bills & Utilities, Camera & Equipment, Clothing, Dining & Drinks, Education, Entertainment, Gas & Fuel, Groceries, Health & Medical, Home & Garden, Insurance (Business), Insurance (Personal), Office Supplies, Parking & Tolls, Personal Care, Pets, Photography, Professional Services, Rent / Lease, Repairs & Maintenance, Shopping, Software & Tech, Subscriptions, Supplies, Taxes & Licenses, Travel & Vacation, Personal Expense, Photo Income, Freelance Income, Contract Income, Rental Income, Side Income, Dividend Income, Interest Income]
            - tax_bucket: From [Advertising, Car and truck, Commissions and fees, Contract labor, Depreciation, Insurance, Interest, Legal and professional, Office expense, Rent/lease, Repairs and maintenance, Supplies, Taxes and licenses, Travel, Meals (50%), Utilities, Wages, Other, Personal Expense]
            - tax_deductible: true if it's a business expense, false if personal
            - business_use_pct: 100 for purely business, lower for mixed use

            Consider the photographer context: Adobe subscriptions, camera gear, travel for shoots, client meetings, etc.

            RETURN ONLY a JSON ARRAY: [{ "id": original_id, "category": "...", "tax_bucket": "...", "tax_deductible": bool, "business_use_pct": number }]

            Transactions:
            ${JSON.stringify(chunk)}
        `;

        let attempt = 0;
        let chunkResult = null;
        while (attempt < 3) {
            try {
                const result = await model.generateContent(prompt);
                const text = result.response.text().trim().replace(/```json|```/g, "").trim();
                chunkResult = JSON.parse(text);
                break;
            } catch (err) {
                attempt++;
                if ((err.status === 503 || err.message?.includes("503")) && attempt < 3) {
                    await new Promise(r => setTimeout(r, attempt * 1500));
                    continue;
                }
                throw err;
            }
        }
        if (chunkResult) finalResults.push(...chunkResult);
    }
    return finalResults;
}

module.exports = {
    getGeminiModel,
    repairLedgerBatch,
    classifyTransactions
};
