const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const os = require("os");
const { supabase } = require("../db");

const router = express.Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 25 * 1024 * 1024 } });

// Helper functions (Supabase uses its own ID/Dates)
function parseMoneyToCents(s) {
    let t = String(s || "").trim();
    if (!t) return null;
    let neg = false;
    if (t.startsWith("(") && t.endsWith(")")) { neg = true; t = t.slice(1, -1); }
    t = t.replace(/[$,]/g, "");
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    let cents = Math.round(n * 100);
    if (neg) cents = -Math.abs(cents);
    return cents;
}

function mmddyyyyToYmd(s) {
    const t = String(s || "").trim();
    if (!t) return null;
    // Already in YYYY-MM-DD format (e.g. Rocket Money exports)
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    // MM/DD/YYYY format
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    return `${m[3]}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
}

function pick(o, keys) {
    for (const k of keys) {
        if (o[k] !== undefined && String(o[k]).trim() !== "") return String(o[k]).trim();
    }
    return "";
}

// ── Vendor Normalization ────────────────────────────────────────────────────
// Each entry: { pattern: RegExp, name: 'Clean Name' }
// Patterns tested case-insensitively. First match wins.
// Add new entries here as you discover messy vendor names in your CSV data.
const VENDOR_NORMALIZE = [
    { pattern: /amazon|amzn|amazon\.com|amazon mktpl|amazon mktplace/i, name: 'Amazon' },
    { pattern: /buc-ee|bucees|buc ee/i, name: "Buc-ee's" },
    { pattern: /t-mobile|tmobile|t mobile/i, name: 'T-Mobile' },
    { pattern: /walmart|wal-mart|wal mart/i, name: 'Walmart' },
    { pattern: /target\.com|target #|target store/i, name: 'Target' },
    { pattern: /starbucks/i, name: 'Starbucks' },
    { pattern: /apple\.com|apple store|apple inc/i, name: 'Apple' },
    { pattern: /google pay|google \*/i, name: 'Google' },
    { pattern: /netflix/i, name: 'Netflix' },
    { pattern: /spotify/i, name: 'Spotify' },
    { pattern: /adobe/i, name: 'Adobe' },
    { pattern: /squarespace/i, name: 'Squarespace' },
    { pattern: /dropbox/i, name: 'Dropbox' },
    { pattern: /paypal/i, name: 'PayPal' },
    { pattern: /venmo/i, name: 'Venmo' },
    { pattern: /doordash/i, name: 'DoorDash' },
    { pattern: /uber eats|ubereats/i, name: 'Uber Eats' },
    { pattern: /booking\.com|booking com/i, name: 'Booking.com' },
    { pattern: /airbnb/i, name: 'Airbnb' },
    { pattern: /mapco/i, name: 'MAPCO' },
    { pattern: /kroger/i, name: 'Kroger' },
    { pattern: /costco/i, name: 'Costco' },
    { pattern: /shell service|shell oil|shell #/i, name: 'Shell' },
    { pattern: /chevron/i, name: 'Chevron' },
    { pattern: /harvest host/i, name: 'Harvest Host' },
    { pattern: /the print shop|printshop/i, name: 'The Print Shop' },
    { pattern: /taxact/i, name: 'TaxAct' },
    { pattern: /tnsos|tn secretary of state/i, name: 'TNSOS' },
    { pattern: /iapp press/i, name: 'IAPP Press' },
    { pattern: /raphael.*coffee/i, name: "Raphael's Coffee Roastery" },
];

function normalizeVendor(raw) {
    const s = String(raw || '').trim();
    for (const { pattern, name } of VENDOR_NORMALIZE) {
        if (pattern.test(s)) return name;
    }
    return s;
}

router.post("/rocketmoney", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });

    try {
        // Load rules from Supabase
        const { data: rules, error: rulesError } = await supabase
            .from("classification_rules")
            .select("*");
        if (rulesError) throw rulesError;

        const items = [];
        const errors = [];
        let rowCount = 0;

        const stream = fs.createReadStream(req.file.path)
            .pipe(csvParser({ mapHeaders: ({ header }) => String(header || "").trim().toLowerCase().replace(/\s+/g, " ") }));

        for await (const o of stream) {
            rowCount++;
            const rawDate = pick(o, ["date", "transaction date", "posted date", "transactiondate", "posteddate"]);
            const expense_date = mmddyyyyToYmd(rawDate);
            if (!expense_date) {
                errors.push({ row: rowCount, error: `Bad/missing date: "${rawDate}"` });
                continue;
            }

            const rawAmt = pick(o, ["amount", "transaction amount", "value", "amt", "total"]);
            let amount_cents = parseMoneyToCents(rawAmt);
            if (amount_cents === null) {
                errors.push({ row: rowCount, error: `Bad/missing amount: "${rawAmt}"` });
                continue;
            }

            // In Rocket Money: positive = expense (money out), negative = income (money in)
            // Keep as-is — do NOT flip signs.

            let vendor = pick(o, ['name', 'custom name', 'merchant', 'payee', 'description']) || 'Unknown';
            vendor = normalizeVendor(vendor); // ← Apply clean name normalization
            let category = pick(o, ['category', 'transaction category']) || 'Uncategorized';
            const rm_id = pick(o, ["id", "transaction id", "transactionid"]) || null;
            const notes = pick(o, ["note", "notes", "memo", "description"]) || "";

            // Skip internal account-to-account transfers (CC payments, fund moves, etc.)
            // These are NOT income or expenses — just money moving between your own accounts
            const vendorUp = vendor.toUpperCase();
            const TRANSFERS = [
                'CREDIT CARD PAYMENT', 'FUNDS TRANSFER',
                'APPLECARD GSBANK PAYMENT', 'APPLE CARD PAYMENT',
                'TRANSFER FROM', 'TRANSFER TO',
            ];
            if (TRANSFERS.some(t => vendorUp.includes(t))) {
                errors.push({ row: rowCount, error: `Skipped transfer: "${vendor}"` });
                continue;
            }

            // Read Rocket Money's own "Tax Deductible" column (Yes/No) as the starting default
            const rmTaxDeductible = pick(o, ["tax deductible"]).toLowerCase() === "yes";
            let tax_deductible = rmTaxDeductible;
            let tax_bucket = "";
            let business_use_pct = 100;

            for (const r of rules) {
                let textToMatch = "";
                if (r.match_column === "vendor") textToMatch = vendor.toLowerCase();
                if (r.match_column === "notes") textToMatch = notes.toLowerCase();

                const ruleVal = r.match_value.toLowerCase();
                let isMatch = false;
                if (r.match_type === "exact") isMatch = textToMatch === ruleVal;
                else if (r.match_type === "contains") isMatch = textToMatch.includes(ruleVal);

                if (isMatch) {
                    if (r.assign_category) category = r.assign_category;
                    if (r.assign_tax_bucket) tax_bucket = r.assign_tax_bucket;
                    tax_deductible = !!r.assign_tax_deductible;
                    business_use_pct = r.assign_business_use_pct;
                    break;
                }
            }

            // --- Seamless background auto-mapping for Rocket Money categories ---
            if (!tax_bucket) {
                // First: Specific Vendor overrides (case-insensitive substring match)
                const VENDOR_MAPPING = [
                    { vendor: 't-mobile', bucket: 'Utilities', deductible: true, pct: 50 },
                    { vendor: 'tnsos', bucket: 'Taxes and licenses', deductible: true, pct: 100 },
                    { vendor: 'iapp press', bucket: 'Taxes and licenses', deductible: true, pct: 100 },
                    { vendor: 'booking', bucket: 'Travel', deductible: true, pct: 100 },
                    { vendor: 'amazon', bucket: 'Supplies', deductible: true, pct: 100 },
                    { vendor: 'taxact', bucket: 'Legal and professional', deductible: true, pct: 100 },
                    { vendor: 'harvest', bucket: 'Travel', deductible: true, pct: 100 },
                    { vendor: 'print shop', bucket: 'Advertising', deductible: true, pct: 100 }
                ];
                let matchedVendor = false;
                for (const vmap of VENDOR_MAPPING) {
                    if (vendor.toLowerCase().includes(vmap.vendor)) {
                        tax_bucket = vmap.bucket;
                        if (!rmTaxDeductible) tax_deductible = vmap.deductible;
                        business_use_pct = vmap.pct;
                        matchedVendor = true;
                        break;
                    }
                }

                // Second: Category mapping
                if (!matchedVendor) {
                    const RM_MAPPING = [
                        { categories: ['Bills & Utilities'], bucket: 'Utilities', deductible: false, pct: 100 },
                        { categories: ['Auto & Transport', 'Fuel (Van)', 'Gas & Fuel'], bucket: 'Car and truck', deductible: true, pct: 50 },
                        { categories: ['Travel & Vacation', 'Travel', 'Harvest host', 'Booking.com'], bucket: 'Travel', deductible: true, pct: 100 },
                        { categories: ['Dining & Drinks', 'Food & Dining', 'Restaurants'], bucket: 'Meals (50%)', deductible: true, pct: 50 },
                        { categories: ['Software & Tech', 'Office Supplies', 'Software', 'Electronics & Software'], bucket: 'Office expense', deductible: true, pct: 100 },
                        { categories: ['Advertising', 'The Print Shop'], bucket: 'Advertising', deductible: true, pct: 100 },
                        { categories: ['Insurance (Business)', 'Insurance'], bucket: 'Insurance', deductible: true, pct: 100 },
                        { categories: ['Professional Services', 'Legal', 'TaxAct'], bucket: 'Legal and professional', deductible: true, pct: 100 },
                        { categories: ['Photography', 'Camera & Photo', 'Equipment', 'Amazon'], bucket: 'Supplies', deductible: true, pct: 100 },
                        { categories: ['TNSOS', 'IAPP Press'], bucket: 'Taxes and licenses', deductible: true, pct: 100 },
                        { categories: ['T-mobile', 'Phone'], bucket: 'Utilities', deductible: true, pct: 50 }
                    ];

                    for (const mapping of RM_MAPPING) {
                        if (mapping.categories.includes(category)) {
                            tax_bucket = mapping.bucket;
                            if (!rmTaxDeductible) {
                                tax_deductible = mapping.deductible;
                            }
                            business_use_pct = mapping.pct;
                            break;
                        }
                    }
                }
            }

            items.push({
                expense_date, vendor, category, amount_cents, currency: "USD", notes,
                source: "rocketmoney", rm_id, tax_deductible, tax_bucket, business_use_pct
            });
        }

        fs.unlink(req.file.path, () => { });
        if (!items.length) return res.status(400).json({ error: "CSV appears empty or malformatted", rowsScanned: rowCount, parseErrors: errors.length });

        // Since RM CSVs have no unique transaction ID, deduplicate by date+vendor+amount
        // Get the date range of items being imported to check for existing data
        const dates = items.map(i => i.expense_date).sort();
        const rangeStart = dates[0];
        const rangeEnd = dates[dates.length - 1];

        const { data: existing } = await supabase
            .from("expenses")
            .select("expense_date, vendor, amount_cents")
            .gte("expense_date", rangeStart)
            .lte("expense_date", rangeEnd);

        const existingKeys = new Set((existing || []).map(e => `${e.expense_date}|${e.vendor}|${e.amount_cents}`));

        const toInsert = items.filter(i => !existingKeys.has(`${i.expense_date}|${i.vendor}|${i.amount_cents}`));
        const skipped = items.length - toInsert.length;

        let inserted = 0;
        if (toInsert.length > 0) {
            const { data: insertedData, error: insertError } = await supabase
                .from("expenses")
                .insert(toInsert)
                .select();
            if (insertError) throw insertError;
            inserted = insertedData?.length || 0;
        }

        res.json({ ok: true, inserted, updated: 0, skipped, errors });

    } catch (e) {
        if (req.file) fs.unlink(req.file.path, () => { });
        res.status(500).json({ error: String(e.message || e) });
    }
});

// POST /import/normalize-vendors
// Batch-updates all existing transactions with cleaned vendor names
router.post("/normalize-vendors", async (req, res) => {
    try {
        const { data, error } = await supabase.from("expenses").select("id, vendor");
        if (error) throw error;

        let updated = 0;
        const batch = [];
        for (const row of data || []) {
            const clean = normalizeVendor(row.vendor || '');
            if (clean !== row.vendor) {
                batch.push({ id: row.id, vendor: clean });
            }
        }

        // Update in chunks of 100
        for (let i = 0; i < batch.length; i += 100) {
            const chunk = batch.slice(i, i + 100);
            for (const item of chunk) {
                await supabase.from("expenses").update({ vendor: item.vendor }).eq("id", item.id);
            }
            updated += chunk.length;
        }

        res.json({ ok: true, updated, total: (data || []).length });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;

