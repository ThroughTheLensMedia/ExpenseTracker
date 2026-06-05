const { getGeminiModel } = require('./gemini');

const RECEIPT_PROMPT_TEMPLATE = (today, senderDomain, subject) => `You are a receipt parser for an expense tracker.
Extract transaction details from this forwarded receipt email.

Sender domain: ${senderDomain}
Subject: ${subject}
Today's date: ${today}

Extract these fields:
- vendor: business name (use sender domain as fallback if not found in body — e.g. "venmo.com" → "Venmo", "rei.com" → "REI Co-op")
- date: transaction date in YYYY-MM-DD format (use "${today}" if not found)
- amount_cents: total amount charged as integer cents (e.g. $21.95 → 2195). Use the FINAL total, not subtotal. null if no dollar amount found.
- tax_cents: tax amount as integer cents, null if not found
- category: best match from — Advertising, Auto & Transport, Bills & Utilities, Camera & Equipment, Clothing, Dining & Drinks, Education, Entertainment, Gas & Fuel, Groceries, Health & Medical, Home & Garden, Insurance (Business), Insurance (Personal), Office Supplies, Parking & Tolls, Personal Care, Pets, Photography, Professional Services, Rent / Lease, Repairs & Maintenance, Shopping, Software & Tech, Subscriptions, Supplies, Taxes & Licenses, Travel & Vacation, Personal Expense
- notes: one short phrase about what was purchased (10 words max)
- is_p2p: true if this is a person-to-person payment (Venmo, Zelle, Cash App, PayPal to a person), false otherwise
- confidence: "high" if amount and vendor are clear, "low" if guessed

Return ONLY a valid JSON object. Use null for fields you cannot find.
Example: {"vendor":"Anthropic","date":"${today}","amount_cents":2195,"tax_cents":195,"category":"Subscriptions","notes":"Auto recharge extra usage","is_p2p":false,"confidence":"high"}

EMAIL BODY:
`;

/**
 * parseReceiptFromEmailBody(apiKey, body, senderDomain, subject)
 * Uses Gemini text mode to extract transaction fields from an email body.
 * Returns { vendor, date, amount_cents, tax_cents, category, notes, is_p2p, confidence }
 * Returns null if Gemini fails or body is unparseable.
 */
async function parseReceiptFromEmailBody(apiKey, body, senderDomain, subject) {
    if (!apiKey) throw new Error('Gemini API key required');

    const model = await getGeminiModel(apiKey);
    const today = new Date().toISOString().slice(0, 10);

    // Strip forwarded/quoted reply chains before sending to Gemini
    const cleanBody = stripQuotedReplies(body);

    const prompt = RECEIPT_PROMPT_TEMPLATE(today, senderDomain, subject) + cleanBody.slice(0, 4000);

    let raw;
    try {
        const result = await model.generateContent(prompt);
        raw = result.response.text().trim().replace(/```json|```/g, '').trim();
    } catch (err) {
        console.error('[EmailParser] Gemini call failed:', err.message);
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (_) {
        console.error('[EmailParser] JSON parse failed. Raw:', raw.slice(0, 200));
        return null;
    }
}

/**
 * parseReceiptFromFile(apiKey, buffer, mimeType)
 * Uses Gemini Vision to extract receipt fields from a PDF or image buffer.
 * Same return shape as parseReceiptFromEmailBody.
 */
async function parseReceiptFromFile(apiKey, buffer, mimeType) {
    if (!apiKey) throw new Error('Gemini API key required');

    const model = await getGeminiModel(apiKey);
    const today = new Date().toISOString().slice(0, 10);

    const prompt = `You are a receipt parser for an expense tracker.
Extract these fields from the receipt image or PDF:
- vendor: business name only
- date: transaction date in YYYY-MM-DD format (use "${today}" if not visible)
- amount_cents: final total as integer cents (e.g. $21.95 → 2195), null if not visible
- tax_cents: tax amount as integer cents, null if not visible
- category: best match from — Advertising, Auto & Transport, Bills & Utilities, Camera & Equipment, Clothing, Dining & Drinks, Education, Entertainment, Gas & Fuel, Groceries, Health & Medical, Home & Garden, Insurance (Business), Insurance (Personal), Office Supplies, Parking & Tolls, Personal Care, Pets, Photography, Professional Services, Rent / Lease, Repairs & Maintenance, Shopping, Software & Tech, Subscriptions, Supplies, Taxes & Licenses, Travel & Vacation, Personal Expense
- notes: one short phrase about what was purchased (10 words max)
- is_p2p: false
- confidence: "high" if amount and vendor are clear, "low" if guessed

Return ONLY a valid JSON object. Use null for fields you cannot read.`;

    const imagePart = {
        inlineData: {
            data: buffer.toString('base64'),
            mimeType
        }
    };

    let raw;
    try {
        const result = await model.generateContent([prompt, imagePart]);
        raw = result.response.text().trim().replace(/```json|```/g, '').trim();
    } catch (err) {
        console.error('[EmailParser] Gemini Vision call failed:', err.message);
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (_) {
        console.error('[EmailParser] Vision JSON parse failed. Raw:', raw.slice(0, 200));
        return null;
    }
}

/**
 * stripQuotedReplies(text)
 * Removes forwarded/quoted reply chains (FWD:, ----Original Message----, > lines, etc.)
 */
function stripQuotedReplies(text) {
    if (!text) return '';
    return text
        .split('\n')
        .filter(line => !line.trimStart().startsWith('>'))
        .join('\n')
        .replace(/[-]{3,}.*?(Original Message|Forwarded Message|Begin forwarded).*?[-]{3,}/gi, '')
        .replace(/On .+wrote:/gi, '')
        .trim();
}

module.exports = { parseReceiptFromEmailBody, parseReceiptFromFile, stripQuotedReplies };
