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

            // Standardize RocketMoney signs
            if (amount_cents < 0) amount_cents = Math.abs(amount_cents);
            else if (amount_cents > 0) amount_cents = -Math.abs(amount_cents);

            let vendor = pick(o, ["name", "custom name", "merchant", "payee", "description"]) || "Unknown";
            let category = pick(o, ["category", "transaction category"]) || "Uncategorized";
            const rm_id = pick(o, ["id", "transaction id", "transactionid"]) || null;
            const notes = pick(o, ["note", "notes", "memo", "description"]) || "";

            let tax_deductible = false;
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

module.exports = router;
