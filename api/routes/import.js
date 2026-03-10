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
    { pattern: /starlink/i, name: 'Starlink Internet' },
    { pattern: /sams club|sam's club/i, name: "Sam's Club" },
    { pattern: /home depot/i, name: 'Home Depot' },
    { pattern: /lowes|lowe's/i, name: "Lowe's" },
    { pattern: /publix/i, name: 'Publix' },
    { pattern: /aldi/i, name: 'ALDI' },
];

function normalizeVendor(raw) {
    const s = String(raw || '').trim();
    for (const { pattern, name } of VENDOR_NORMALIZE) {
        if (pattern.test(s)) return name;
    }
    return s;
}

// ── Bank / Source Profiles ────────────────────────────────────────────────
// Each profile defines how to map a bank's CSV columns to our internal fields.
// signConvention:
//   'positive_is_expense'  → Rocket Money style (positive = you spent money)
//   'negative_is_expense'  → Chase/BofA style (negative = debit/expense)
//   'split_debit_credit'   → Capital One / US Bank style (separate Debit & Credit cols)
const BANK_PROFILES = {
    rocketmoney: {
        label: 'Rocket Money',
        dateCol: ['date'],
        amountCol: ['amount'],
        vendorCol: ['name', 'custom name'],
        categoryCol: ['category'],
        notesCol: ['note', 'notes', 'memo'],
        idCol: ['id', 'transaction id', 'transactionid'],
        taxDeductibleCol: ['tax deductible'],
        signConvention: 'positive_is_expense',
        // Signature headers used for auto-detection
        detectHeaders: ['tax deductible', 'custom name'],
    },
    chase: {
        label: 'Chase',
        dateCol: ['transaction date', 'post date'],
        amountCol: ['amount'],
        vendorCol: ['description'],
        categoryCol: ['category', 'type'],
        notesCol: ['memo', 'notes'],
        idCol: [],
        signConvention: 'negative_is_expense',
        detectHeaders: ['transaction date', 'post date', 'type'],
    },
    bankofamerica: {
        label: 'Bank of America',
        dateCol: ['date'],
        amountCol: ['amount'],
        vendorCol: ['description', 'payee'],
        categoryCol: [],
        notesCol: ['memo', 'reference number'],
        idCol: ['reference number'],
        signConvention: 'negative_is_expense',
        detectHeaders: ['reference number', 'address'],
    },
    wellsfargo: {
        label: 'Wells Fargo',
        dateCol: ['date'],
        amountCol: ['amount'],
        vendorCol: ['description'],
        categoryCol: [],
        notesCol: [],
        idCol: [],
        signConvention: 'negative_is_expense',
        detectHeaders: [],  // WF has no unique headers — generic fallback
    },
    usbank: {
        label: 'US Bank',
        dateCol: ['date', 'transaction date'],
        // US Bank personal: single Amount col (negative = debit/expense)
        // US Bank business: separate Debit / Credit cols
        amountCol: ['amount', 'transaction amount'],
        debitCol: ['debit', 'withdrawals', 'withdrawal'],
        creditCol: ['credit', 'deposits', 'deposit'],
        vendorCol: ['name', 'description', 'payee', 'merchant'],
        categoryCol: ['category'],
        notesCol: ['memo', 'notes'],
        idCol: ['transaction id', 'reference number'],
        signConvention: 'negative_is_expense',  // personal; split_debit_credit auto-detected
        detectHeaders: ['withdrawals', 'deposits'],  // business account signature
    },
    applecard: {
        label: 'Apple Card',
        dateCol: ['transaction date'],
        amountCol: ['amount (usd)', 'amount'],
        vendorCol: ['merchant', 'description'],
        categoryCol: ['category'],
        notesCol: ['type'],
        idCol: [],
        signConvention: 'negative_is_expense',
        detectHeaders: ['merchant', 'amount (usd)'],
    },
    capitalone: {
        label: 'Capital One',
        dateCol: ['transaction date', 'posted date', 'date'],
        amountCol: [],  // uses split debit/credit
        debitCol: ['debit'],
        creditCol: ['credit'],
        vendorCol: ['description'],
        categoryCol: ['category'],
        notesCol: [],
        idCol: [],
        signConvention: 'split_debit_credit',
        detectHeaders: ['debit', 'credit', 'posted date'],
    },
};

// Auto-detect bank from CSV header row
function detectBankProfile(headers) {
    const h = new Set(headers.map(s => String(s || '').trim().toLowerCase()));

    // Check each profile's signature headers — most specific first
    const order = ['rocketmoney', 'applecard', 'capitalone', 'usbank', 'chase', 'bankofamerica', 'wellsfargo'];
    for (const key of order) {
        const profile = BANK_PROFILES[key];
        if (profile.detectHeaders.length > 0 && profile.detectHeaders.every(sig => h.has(sig))) {
            return key;
        }
    }
    return null; // unknown — caller will show manual mapper
}

// Resolve amount from a row given a profile
function resolveAmount(row, profile) {
    const convention = profile.signConvention;

    // Check if this row actually has split debit/credit cols
    const rawDebit = pick(row, profile.debitCol || []);
    const rawCredit = pick(row, profile.creditCol || []);
    const hasSplit = rawDebit !== '' || rawCredit !== '';

    if (convention === 'split_debit_credit' || (hasSplit && (profile.debitCol || []).length > 0)) {
        // Debit = money out (expense = positive cents)
        // Credit = money in (income = negative cents)
        if (rawDebit) return parseMoneyToCents(rawDebit);   // positive
        if (rawCredit) return -(parseMoneyToCents(rawCredit) || 0); // negative
        return null;
    }

    const rawAmt = pick(row, profile.amountCol);
    if (!rawAmt) return null;
    const cents = parseMoneyToCents(rawAmt);
    if (cents === null) return null;

    if (convention === 'negative_is_expense') {
        // Bank exports: negative = debit (expense), positive = credit (income)
        // Flip so our DB stores expense as positive, income as negative (RM convention)
        return -cents;
    }
    // 'positive_is_expense' — Rocket Money default, no flip needed
    return cents;
}

// ── Shared CSV parse + import logic ────────────────────────────────────────
async function parseCsvAndImport(filePath, profileKey, res) {
    const profile = BANK_PROFILES[profileKey] || BANK_PROFILES.rocketmoney;

    try {
        const { data: rules, error: rulesError } = await supabase
            .from('classification_rules')
            .select('*');
        if (rulesError) throw rulesError;

        const items = [];
        const errors = [];
        let rowCount = 0;

        const stream = fs.createReadStream(filePath)
            .pipe(csvParser({ mapHeaders: ({ header }) => String(header || '').trim().toLowerCase().replace(/\s+/g, ' ') }));

        for await (const o of stream) {
            rowCount++;

            const rawDate = pick(o, profile.dateCol);
            const expense_date = mmddyyyyToYmd(rawDate);
            if (!expense_date) {
                errors.push({ row: rowCount, error: `Bad/missing date: "${rawDate}"` });
                continue;
            }

            const amount_cents = resolveAmount(o, profile);
            if (amount_cents === null) {
                errors.push({ row: rowCount, error: `Bad/missing amount in row ${rowCount}` });
                continue;
            }

            let vendor = pick(o, profile.vendorCol) || 'Unknown';
            vendor = normalizeVendor(vendor);
            let category = pick(o, profile.categoryCol) || 'Uncategorized';
            const rm_id = pick(o, profile.idCol || []) || null;
            const notes = pick(o, profile.notesCol || ['note', 'notes', 'memo', 'description']) || '';

            // Skip internal transfers
            const vendorUp = vendor.toUpperCase();
            const TRANSFERS = [
                'CREDIT CARD PAYMENT', 'FUNDS TRANSFER', 'ONLINE TRANSFER',
                'APPLECARD GSBANK PAYMENT', 'APPLE CARD PAYMENT',
                'TRANSFER FROM', 'TRANSFER TO', 'PAYMENT - THANK YOU',
                'AUTOPAY PAYMENT', 'ACH PAYMENT',
            ];
            if (TRANSFERS.some(t => vendorUp.includes(t))) {
                errors.push({ row: rowCount, error: `Skipped transfer: "${vendor}"` });
                continue;
            }

            // Tax deductible seed (Rocket Money has its own column; others start false)
            const rmTaxDeductible = profileKey === 'rocketmoney'
                ? pick(o, profile.taxDeductibleCol || ['tax deductible']).toLowerCase() === 'yes'
                : false;
            let tax_deductible = rmTaxDeductible;
            let tax_bucket = '';
            let business_use_pct = 100;

            // Apply classification rules
            for (const r of rules) {
                let textToMatch = '';
                if (r.match_column === 'vendor') textToMatch = vendor.toLowerCase();
                if (r.match_column === 'notes') textToMatch = notes.toLowerCase();
                const ruleVal = r.match_value.toLowerCase();
                let isMatch = false;
                if (r.match_type === 'exact') isMatch = textToMatch === ruleVal;
                if (r.match_type === 'contains') isMatch = textToMatch.includes(ruleVal);
                if (isMatch) {
                    if (r.assign_category) category = r.assign_category;
                    if (r.assign_tax_bucket) tax_bucket = r.assign_tax_bucket;
                    tax_deductible = !!r.assign_tax_deductible;
                    business_use_pct = r.assign_business_use_pct;
                    break;
                }
            }

            // Auto-mapping: vendor overrides, then RM category mapping
            if (!tax_bucket) {
                const VENDOR_MAPPING = [
                    { vendor: 't-mobile', bucket: 'Utilities', deductible: true, pct: 50 },
                    { vendor: 'starlink', bucket: 'Utilities', deductible: true, pct: 50 },
                    { vendor: 'tnsos', bucket: 'Taxes and licenses', deductible: true, pct: 100 },
                    { vendor: 'iapp press', bucket: 'Taxes and licenses', deductible: true, pct: 100 },
                    { vendor: 'booking', bucket: 'Travel', deductible: true, pct: 100 },
                    { vendor: 'harvest host', bucket: 'Travel', deductible: true, pct: 100 },
                    { vendor: 'amazon', bucket: 'Supplies', deductible: true, pct: 100 },
                    { vendor: 'taxact', bucket: 'Legal and professional', deductible: true, pct: 100 },
                    { vendor: 'print shop', bucket: 'Advertising', deductible: true, pct: 100 },
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
                        { categories: ['T-mobile', 'Phone'], bucket: 'Utilities', deductible: true, pct: 50 },
                    ];
                    for (const mapping of RM_MAPPING) {
                        if (mapping.categories.includes(category)) {
                            tax_bucket = mapping.bucket;
                            if (!rmTaxDeductible) tax_deductible = mapping.deductible;
                            business_use_pct = mapping.pct;
                            break;
                        }
                    }
                }
            }

            items.push({
                expense_date, vendor, category, amount_cents, currency: 'USD', notes,
                source: profileKey, rm_id, tax_deductible, tax_bucket, business_use_pct,
            });
        }

        fs.unlink(filePath, () => { });
        if (!items.length) {
            return res.status(400).json({ error: 'CSV appears empty or malformatted', rowsScanned: rowCount, parseErrors: errors.length });
        }

        // Deduplication by date+vendor+amount within the imported date range
        const dates = items.map(i => i.expense_date).sort();
        const { data: existing } = await supabase
            .from('expenses')
            .select('expense_date, vendor, amount_cents')
            .gte('expense_date', dates[0])
            .lte('expense_date', dates[dates.length - 1]);

        const existingKeys = new Set((existing || []).map(e => `${e.expense_date}|${e.vendor}|${e.amount_cents}`));
        const toInsert = items.filter(i => !existingKeys.has(`${i.expense_date}|${i.vendor}|${i.amount_cents}`));
        const skipped = items.length - toInsert.length;

        let inserted = 0;
        if (toInsert.length > 0) {
            const { data: insertedData, error: insertError } = await supabase
                .from('expenses').insert(toInsert).select();
            if (insertError) throw insertError;
            inserted = insertedData?.length || 0;
        }

        res.json({ ok: true, inserted, updated: 0, skipped, errors, source: profile.label, rowsScanned: rowCount });

    } catch (e) {
        fs.unlink(filePath, () => { });
        res.status(500).json({ error: String(e.message || e) });
    }
}

// ── POST /import/csv  (universal — pass source= query param or form field) ─
router.post("/csv", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const source = String(req.body?.source || req.query?.source || 'rocketmoney').toLowerCase();
    if (!BANK_PROFILES[source]) {
        fs.unlink(req.file.path, () => { });
        return res.status(400).json({ error: `Unknown source "${source}". Valid: ${Object.keys(BANK_PROFILES).join(', ')}` });
    }
    return parseCsvAndImport(req.file.path, source, res);
});

// ── POST /import/detect  (returns detected bank profile from CSV headers) ──
router.post("/detect", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    try {
        const headers = [];
        const stream = fs.createReadStream(req.file.path)
            .pipe(csvParser({ mapHeaders: ({ header }) => { const h = String(header || '').trim().toLowerCase(); headers.push(h); return h; } }));
        // Only need the first row to detect headers
        for await (const _ of stream) { break; }
        fs.unlink(req.file.path, () => { });
        const detected = detectBankProfile(headers);
        const profiles = Object.entries(BANK_PROFILES).map(([key, p]) => ({ key, label: p.label }));
        res.json({ detected, headers, profiles });
    } catch (e) {
        fs.unlink(req.file.path, () => { });
        res.status(500).json({ error: String(e.message || e) });
    }
});

// ── GET /import/profiles  (list available bank profiles) ───────────────────
router.get("/profiles", (req, res) => {
    const profiles = Object.entries(BANK_PROFILES).map(([key, p]) => ({ key, label: p.label }));
    res.json({ profiles });
});

// ── POST /import/rocketmoney  (legacy — delegates to shared logic) ─────────
router.post("/rocketmoney", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    return parseCsvAndImport(req.file.path, 'rocketmoney', res);
});

// POST /import/normalize-vendors
// Batch-updates all existing transactions with cleaned vendor names
router.post("/normalize-vendors", async (req, res) => {
    try {
        const data = await fetchAllRows("expenses", "id, vendor");

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

// Helper to fetch ALL rows from a table (Supabase defaults to 1000)
async function fetchAllRows(tableName, selectStr = "*") {
    let all = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
        const { data, error } = await supabase
            .from(tableName)
            .select(selectStr)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE_SIZE) break;
        page++;
    }
    return all;
}

// POST /import/apply-rules
// Retroactively runs all classification rules + vendor mapping against every existing transaction.
// Updates category, tax_bucket, tax_deductible, and business_use_pct where rules match.
router.post('/apply-rules', async (req, res) => {
    try {
        // Load rules
        const { data: rules, error: rulesError } = await supabase.from('classification_rules').select('*');
        if (rulesError) throw rulesError;

        // Load ALL expenses to ensure we catch those beyond the 1000-row default limit
        const expenses = await fetchAllRows('expenses', 'id, vendor, category, notes, tax_deductible, tax_bucket, business_use_pct');

        const VENDOR_MAPPING_LOCAL = [
            { vendor: 't-mobile', bucket: 'Utilities', category: 'Bills & Utilities', deductible: true, pct: 50 },
            { vendor: 'starlink', bucket: 'Utilities', category: 'Bills & Utilities', deductible: true, pct: 50 },
            { vendor: 'tnsos', bucket: 'Taxes and licenses', category: 'Taxes & Licenses', deductible: true, pct: 100 },
            { vendor: 'iapp press', bucket: 'Taxes and licenses', category: 'Taxes & Licenses', deductible: true, pct: 100 },
            { vendor: 'booking', bucket: 'Travel', category: 'Travel & Vacation', deductible: true, pct: 100 },
            { vendor: 'harvest host', bucket: 'Travel', category: 'Travel & Vacation', deductible: true, pct: 100 },
            { vendor: 'amazon', bucket: 'Supplies', category: 'Supplies', deductible: true, pct: 100 },
            { vendor: 'taxact', bucket: 'Legal and professional', category: 'Professional Services', deductible: true, pct: 100 },
            { vendor: 'print shop', bucket: 'Advertising', category: 'Advertising', deductible: true, pct: 100 },
        ];

        let updated = 0;
        const errors = [];

        for (const exp of expenses || []) {
            const vendorLow = (exp.vendor || '').toLowerCase();
            const notesLow = (exp.notes || '').toLowerCase();
            let newCat = exp.category;
            let newBucket = exp.tax_bucket;
            let newDeductible = exp.tax_deductible;
            let newPct = exp.business_use_pct;
            let changed = false;

            // 1. Run classification rules first (user-defined, highest priority)
            for (const r of rules) {
                const textToMatch = r.match_column === 'vendor' ? vendorLow : notesLow;
                const ruleVal = r.match_value.toLowerCase();
                const isMatch = r.match_type === 'exact' ? textToMatch === ruleVal : textToMatch.includes(ruleVal);
                if (isMatch) {
                    if (r.assign_category) newCat = r.assign_category;
                    if (r.assign_tax_bucket) newBucket = r.assign_tax_bucket;
                    if (r.assign_tax_deductible !== undefined) newDeductible = r.assign_tax_deductible;
                    if (r.assign_business_use_pct) newPct = r.assign_business_use_pct;
                    changed = true;
                    break;
                }
            }

            // 2. Vendor mapping (only if no rule matched)
            if (!changed) {
                for (const vmap of VENDOR_MAPPING_LOCAL) {
                    if (vendorLow.includes(vmap.vendor)) {
                        if (vmap.category) newCat = vmap.category;
                        newBucket = vmap.bucket;
                        newDeductible = vmap.deductible;
                        newPct = vmap.pct;
                        changed = true;
                        break;
                    }
                }
            }

            if (changed) {
                const { error: updErr } = await supabase.from('expenses').update({
                    category: newCat,
                    tax_bucket: newBucket,
                    tax_deductible: newDeductible,
                    business_use_pct: newPct,
                }).eq('id', exp.id);
                if (updErr) errors.push({ id: exp.id, error: updErr.message });
                else updated++;
            }
        }

        res.json({ ok: true, updated, total: (expenses || []).length, errors });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;

