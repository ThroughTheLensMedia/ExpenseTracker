const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const os = require("os");

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
        detectHeaders: ['ignored from', 'custom name'],
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
        detectHeaders: [],
    },
    usbank: {
        label: 'US Bank',
        dateCol: ['date', 'transaction date'],
        amountCol: ['amount', 'transaction amount'],
        debitCol: ['debit', 'withdrawals', 'withdrawal'],
        creditCol: ['credit', 'deposits', 'deposit'],
        vendorCol: ['name', 'description', 'payee', 'merchant'],
        categoryCol: ['category'],
        notesCol: ['memo', 'notes'],
        idCol: ['transaction id', 'reference number'],
        signConvention: 'negative_is_expense',
        detectHeaders: ['withdrawals', 'deposits'],
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
        amountCol: [],
        debitCol: ['debit'],
        creditCol: ['credit'],
        vendorCol: ['description'],
        categoryCol: ['category'],
        notesCol: [],
        idCol: [],
        signConvention: 'split_debit_credit',
        detectHeaders: ['debit', 'credit', 'posted date'],
    },
    usaa: {
        label: 'USAA',
        dateCol: ['date'],
        amountCol: ['amount'],
        vendorCol: ['description'],
        categoryCol: ['category'],
        notesCol: [],
        signConvention: 'negative_is_expense',
        detectHeaders: ['description', 'post date'],
    },
    navyfcu: {
        label: 'Navy Federal',
        dateCol: ['transaction date', 'date'],
        amountCol: ['amount'],
        vendorCol: ['description'],
        categoryCol: ['category'],
        notesCol: [],
        signConvention: 'negative_is_expense',
        detectHeaders: ['transaction date', 'post date', 'description', 'amount'],
    },
    wise: {
        label: 'Wise Bank',
        dateCol: ['date', 'transaction date'],
        amountCol: ['amount'],
        vendorCol: ['description', 'merchant'],
        categoryCol: ['category'],
        notesCol: ['reference'],
        signConvention: 'negative_is_expense',
        detectHeaders: ['exchange rate', 'merchant'],
    },
    universal: {
        label: 'Universal / Generic Mapper',
        dateCol: ['date', 'transaction date', 'posted date', 'log date'],
        amountCol: ['amount', 'transaction amount', 'value', 'price'],
        vendorCol: ['description', 'name', 'vendor', 'payee', 'merchant'],
        categoryCol: ['category', 'type', 'tags'],
        notesCol: ['notes', 'memo', 'comment', 'description'],
        signConvention: 'negative_is_expense',
        detectHeaders: [],
    }
};

// Auto-detect bank from CSV header row
function detectBankProfile(headers) {
    const h = new Set(headers.map(s => String(s || '').trim().toLowerCase()));
    const order = ['rocketmoney', 'applecard', 'capitalone', 'usbank', 'usaa', 'navyfcu', 'wise', 'chase', 'bankofamerica', 'wellsfargo'];
    for (const key of order) {
        const profile = BANK_PROFILES[key];
        if (profile.detectHeaders.length > 0 && profile.detectHeaders.every(sig => h.has(sig))) {
            return key;
        }
    }
    return null;
}

// Resolve amount from a row given a profile
function resolveAmount(row, profile) {
    const convention = profile.signConvention;
    const rawDebit = pick(row, profile.debitCol || []);
    const rawCredit = pick(row, profile.creditCol || []);
    const hasSplit = rawDebit !== '' || rawCredit !== '';

    if (convention === 'split_debit_credit' || (hasSplit && (profile.debitCol || []).length > 0)) {
        if (rawDebit) return parseMoneyToCents(rawDebit);
        if (rawCredit) return -(parseMoneyToCents(rawCredit) || 0);
        return null;
    }

    const rawAmt = pick(row, profile.amountCol);
    if (!rawAmt) return null;
    const cents = parseMoneyToCents(rawAmt);
    if (cents === null) return null;
    if (convention === 'negative_is_expense') return -cents;
    return cents;
}

// ── Shared CSV parse + import logic ────────────────────────────────────────
async function parseCsvAndImport(sb, filePath, profileKey, res) {
    const profile = BANK_PROFILES[profileKey] || BANK_PROFILES.rocketmoney;

    try {
        const { data: rules, error: rulesError } = await sb
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

            const vendorUp = vendor.toUpperCase();
            const TRANSFERS = ['CREDIT CARD PAYMENT', 'FUNDS TRANSFER', 'ONLINE TRANSFER', 'APPLECARD GSBANK PAYMENT', 'APPLE CARD PAYMENT', 'TRANSFER FROM', 'TRANSFER TO', 'PAYMENT - THANK YOU', 'AUTOPAY PAYMENT', 'ACH PAYMENT'];
            if (TRANSFERS.some(t => vendorUp.includes(t))) {
                errors.push({ 
                    row: rowCount, 
                    type: 'info', 
                    error: `Filtered internal transfer: "${vendor}"` 
                });
                continue;
            }

            const rmTaxDeductible = profileKey === 'rocketmoney' ? pick(o, profile.taxDeductibleCol || ['tax deductible']).toLowerCase() === 'yes' : false;
            let tax_deductible = rmTaxDeductible;
            let tax_bucket = '';
            let business_use_pct = 100;

            for (const r of rules) {
                let textToMatch = '';
                if (r.match_column === 'vendor') textToMatch = vendor.toLowerCase();
                if (r.match_column === 'notes') textToMatch = notes.toLowerCase();
                const ruleVal = r.match_value.toLowerCase();
                let isMatch = r.match_type === 'exact' ? textToMatch === ruleVal : textToMatch.includes(ruleVal);
                if (isMatch) {
                    if (r.assign_category) category = r.assign_category;
                    if (r.assign_tax_bucket) tax_bucket = r.assign_tax_bucket;
                    tax_deductible = !!r.assign_tax_deductible;
                    business_use_pct = r.assign_business_use_pct;
                    break;
                }
            }
            if (!tax_bucket) {
                const VENDOR_MAPPING = [{ vendor: 't-mobile', bucket: 'Utilities', deductible: true, pct: 50 }, { vendor: 'starlink', bucket: 'Utilities', deductible: true, pct: 50 }, { vendor: 'tnsos', bucket: 'Taxes and licenses', deductible: true, pct: 100 }, { vendor: 'iapp press', bucket: 'Taxes and licenses', deductible: true, pct: 100 }, { vendor: 'booking', bucket: 'Travel', deductible: true, pct: 100 }, { vendor: 'harvest host', bucket: 'Travel', deductible: true, pct: 100 }, { vendor: 'amazon', bucket: 'Supplies', deductible: true, pct: 100 }, { vendor: 'taxact', bucket: 'Legal and professional', deductible: true, pct: 100 }, { vendor: 'print shop', bucket: 'Advertising', deductible: true, pct: 100 }];
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
                    const RM_MAPPING = [{ categories: ['Bills & Utilities'], bucket: 'Utilities', deductible: false, pct: 100 }, { categories: ['Auto & Transport', 'Fuel (Van)', 'Gas & Fuel'], bucket: 'Car and truck', deductible: true, pct: 50 }, { categories: ['Travel & Vacation', 'Travel', 'Harvest host', 'Booking.com'], bucket: 'Travel', deductible: true, pct: 100 }, { categories: ['Dining & Drinks', 'Food & Dining', 'Restaurants'], bucket: 'Meals (50%)', deductible: true, pct: 50 }, { categories: ['Software & Tech', 'Office Supplies', 'Software', 'Electronics & Software'], bucket: 'Office expense', deductible: true, pct: 100 }, { categories: ['Advertising', 'The Print Shop'], bucket: 'Advertising', deductible: true, pct: 100 }, { categories: ['Insurance (Business)', 'Insurance'], bucket: 'Insurance', deductible: true, pct: 100 }, { categories: ['Professional Services', 'Legal', 'TaxAct'], bucket: 'Legal and professional', deductible: true, pct: 100 }, { categories: ['Photography', 'Camera & Photo', 'Equipment', 'Amazon'], bucket: 'Supplies', deductible: true, pct: 100 }, { categories: ['TNSOS', 'IAPP Press'], bucket: 'Taxes and licenses', deductible: true, pct: 100 }, { categories: ['T-mobile', 'Phone'], bucket: 'Utilities', deductible: true, pct: 50 }];
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
            items.push({ expense_date, vendor, category, amount_cents, currency: 'USD', notes, source: profileKey, rm_id, tax_deductible, tax_bucket, business_use_pct });
        }

        fs.unlink(filePath, () => { });
        if (!items.length) {
            return res.status(400).json({ error: 'CSV appears empty or malformatted', rowsScanned: rowCount, parseErrors: errors.length });
        }

        const dates = items.map(i => i.expense_date).sort();
        const { data: existing } = await sb
            .from('expenses')
            .select('expense_date, vendor, amount_cents')
            .gte('expense_date', dates[0])
            .lte('expense_date', dates[dates.length - 1]);

        const existingKeys = new Set((existing || []).map(e => `${e.expense_date}|${e.vendor}|${e.amount_cents}`));
        const toInsert = items.filter(i => !existingKeys.has(`${i.expense_date}|${i.vendor}|${i.amount_cents}`));
        const skipped = items.length - toInsert.length;

        let inserted = 0;
        if (toInsert.length > 0) {
            const { data: insertedData, error: insertError } = await sb
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

// ── POST /import/csv  ──
router.post("/csv", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const source = String(req.body?.source || req.query?.source || 'rocketmoney').toLowerCase();
    if (!BANK_PROFILES[source]) {
        fs.unlink(req.file.path, () => { });
        return res.status(400).json({ error: `Unknown source "${source}".` });
    }
    return parseCsvAndImport(req.sb, req.file.path, source, res);
});

// ── POST /import/detect  ──
router.post("/detect", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    try {
        const headers = [];
        let detected = null;

        const stream = fs.createReadStream(req.file.path).pipe(csvParser());

        // We listen to the 'headers' event which csv-parser emits as soon as it parses the first line
        const headerPromise = new Promise((resolve, reject) => {
            stream.on('headers', (headerList) => {
                const normalized = headerList.map(h => 
                    String(h || '').trim().toLowerCase().replace(/\s+/g, ' ')
                );
                headers.push(...normalized);
                detected = detectBankProfile(normalized);
                resolve();
            });
            stream.on('error', reject);
            // Safety timeout
            setTimeout(() => resolve(), 3000);
        });

        // Trigger the stream
        for await (const _ of stream) { break; }
        await headerPromise;

        fs.unlink(req.file.path, () => { });
        
        const profiles = Object.entries(BANK_PROFILES).map(([key, p]) => ({ key, label: p.label }));
        res.json({ detected, headers, profiles });
    } catch (e) {
        if (req.file) fs.unlink(req.file.path, () => { });
        res.status(500).json({ error: String(e.message || e) });
    }
});

router.get("/profiles", (req, res) => {
    const profiles = Object.entries(BANK_PROFILES).map(([key, p]) => ({ key, label: p.label }));
    res.json({ profiles });
});

router.post("/rocketmoney", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    return parseCsvAndImport(req.sb, req.file.path, 'rocketmoney', res);
});

async function fetchAllRows(sb, tableName, selectStr = "*") {
    let all = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    while (true) {
        const { data, error } = await sb
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

router.post("/normalize-vendors", async (req, res) => {
    try {
        const data = await fetchAllRows(req.sb, "expenses", "id, vendor");
        let updated = 0;
        const batch = [];
        for (const row of data || []) {
            const clean = normalizeVendor(row.vendor || '');
            if (clean !== row.vendor) batch.push({ id: row.id, vendor: clean });
        }
        for (const item of batch) {
            await req.sb.from("expenses").update({ vendor: item.vendor }).eq("id", item.id);
            updated++;
        }
        res.json({ ok: true, updated, total: (data || []).length });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

router.post('/apply-rules', async (req, res) => {
    try {
        const { data: rules, error: rulesError } = await req.sb.from('classification_rules').select('*');
        if (rulesError) throw rulesError;
        const expenses = await fetchAllRows(req.sb, 'expenses', 'id, vendor, category, notes, tax_deductible, tax_bucket, business_use_pct');
        const VENDOR_MAPPING_LOCAL = [{ vendor: 't-mobile', bucket: 'Utilities', category: 'Bills & Utilities', deductible: true, pct: 50 }, { vendor: 'starlink', bucket: 'Utilities', category: 'Bills & Utilities', deductible: true, pct: 50 }, { vendor: 'tnsos', bucket: 'Taxes and licenses', category: 'Taxes & Licenses', deductible: true, pct: 100 }, { vendor: 'iapp press', bucket: 'Taxes and licenses', category: 'Taxes & Licenses', deductible: true, pct: 100 }, { vendor: 'booking', bucket: 'Travel', category: 'Travel & Vacation', deductible: true, pct: 100 }, { vendor: 'harvest host', bucket: 'Travel', category: 'Travel & Vacation', deductible: true, pct: 100 }, { vendor: 'amazon', bucket: 'Supplies', category: 'Supplies', deductible: true, pct: 100 }, { vendor: 'taxact', bucket: 'Legal and professional', category: 'Professional Services', deductible: true, pct: 100 }, { vendor: 'print shop', bucket: 'Advertising', category: 'Advertising', deductible: true, pct: 100 }];
        let updated = 0;
        const errors = [];
        for (const exp of expenses || []) {
            let newCat = exp.category, newBucket = exp.tax_bucket, newDeductible = exp.tax_deductible, newPct = exp.business_use_pct, changed = false;
            for (const r of rules) {
                const text = r.match_column === 'vendor' ? exp.vendor.toLowerCase() : exp.notes.toLowerCase();
                const v = r.match_value.toLowerCase();
                if (r.match_type === 'exact' ? text === v : text.includes(v)) {
                    if (r.assign_category) newCat = r.assign_category;
                    if (r.assign_tax_bucket) newBucket = r.assign_tax_bucket;
                    if (r.assign_tax_deductible !== undefined) newDeductible = r.assign_tax_deductible;
                    if (r.assign_business_use_pct) newPct = r.assign_business_use_pct;
                    changed = true; break;
                }
            }
            if (!changed) {
                for (const vmap of VENDOR_MAPPING_LOCAL) {
                    if (exp.vendor.toLowerCase().includes(vmap.vendor)) {
                        newCat = vmap.category; newBucket = vmap.bucket; newDeductible = vmap.deductible; newPct = vmap.pct; changed = true; break;
                    }
                }
            }
            if (changed) {
                const { error } = await req.sb.from('expenses').update({ category: newCat, tax_bucket: newBucket, tax_deductible: newDeductible, business_use_pct: newPct }).eq('id', exp.id);
                if (error) errors.push({ id: exp.id, error: error.message }); else updated++;
            }
        }
        res.json({ ok: true, updated, total: expenses.length, errors });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

module.exports = router;
