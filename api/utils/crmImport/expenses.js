'use strict';

const { readRow, clip, parseMoney, parseNumber, parseDate, normName } = require('./common');

// Backend mirror of web-react/src/constants/categories.js CATEGORY_TAX_BUCKET_MAP (no shared package
// across the frontend/backend boundary — keep in sync by hand, same as billing.js / spendCategories.js).
const CATEGORY_BUCKETS = {
    'Advertising': { bucket: 'Advertising' },
    'Auto & Transport': { bucket: 'Car and truck' },
    'Bills & Utilities': { bucket: 'Utilities' },
    'Camera & Equipment': { bucket: 'Supplies' },
    'Dining & Drinks': { bucket: 'Meals (50%)', pct: 50 },
    'Education': { bucket: 'Other' },
    'Gas & Fuel': { bucket: 'Car and truck' },
    'Insurance (Business)': { bucket: 'Insurance' },
    'Office Supplies': { bucket: 'Office expense' },
    'Parking & Tolls': { bucket: 'Car and truck' },
    'Professional Services': { bucket: 'Legal and professional' },
    'Rent / Lease': { bucket: 'Rent/lease' },
    'Repairs & Maintenance': { bucket: 'Repairs and maintenance' },
    'Software & Tech': { bucket: 'Office expense' },
    'Subscriptions': { bucket: 'Office expense' },
    'Supplies': { bucket: 'Supplies' },
    'Taxes & Licenses': { bucket: 'Taxes and licenses' },
    'Travel & Vacation': { bucket: 'Travel' },
};

// Common accounting-system expense account names → Ledger categories. First match wins.
// Anything that doesn't match keeps its original name (and no tax bucket) — the user's own label is never lost.
const CATEGORY_PATTERNS = [
    [/fuel|gasoline|\bgas\b/i, 'Gas & Fuel'],
    [/parking|toll/i, 'Parking & Tolls'],
    [/automobile|vehicle|\bcar\b|\bauto\b/i, 'Auto & Transport'],
    [/meal|dining|restaurant/i, 'Dining & Drinks'],
    [/advertis|marketing|promotion/i, 'Advertising'],
    [/travel|lodging|airfare|hotel/i, 'Travel & Vacation'],
    [/office suppl|printing|postage|stationery/i, 'Office Supplies'],
    [/software|saas/i, 'Software & Tech'],
    [/subscri|\bdues\b/i, 'Subscriptions'],
    [/camera|equipment|photograph|\bgear\b/i, 'Camera & Equipment'],
    [/suppl/i, 'Supplies'],
    [/rent|lease/i, 'Rent / Lease'],
    [/utilit|telephone|internet|electric|\bphone\b/i, 'Bills & Utilities'],
    [/insurance/i, 'Insurance (Business)'],
    [/legal|professional|accounting|consult|contractor/i, 'Professional Services'],
    [/repair|maintenance/i, 'Repairs & Maintenance'],
    [/licen[sc]e|permit/i, 'Taxes & Licenses'],
    [/education|training|course|tuition/i, 'Education'],
];

function mapCategory(raw) {
    const name = clip(raw, 120);
    if (!name) return { category: 'Uncategorized', mapped: false };
    const exact = Object.keys(CATEGORY_BUCKETS).find(k => k.toLowerCase() === name.toLowerCase());
    if (exact) return { category: exact, mapped: exact !== name };
    const hit = CATEGORY_PATTERNS.find(([re]) => re.test(name));
    return hit ? { category: hit[1], mapped: true } : { category: name, mapped: false };
}

const KM_TO_MILES = 0.621371;
const dayNumber = ymd => Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400000);

// Builds expenses (and mileage log entries for rows that carry a distance) from CSV rows.
// Returns { expenses, mileage, errors, categoryMap }. rowNum is the 1-based data row.
function buildExpenses(rows, mapping, { markDeductible = true, sourceSystem = 'generic' } = {}) {
    const expenses = [];
    const mileage = [];
    const errors = [];
    const categoryMap = new Map(); // original → { category, count }
    const labelOf = target => Object.keys(mapping).find(h => mapping[h] === target);

    rows.forEach((row, i) => {
        const rowNum = i + 1;
        const { fields: f, holding } = readRow(row, mapping);
        if (!Object.keys(f).length && !Object.keys(holding).length) return;

        const date = parseDate(f.expense_date);
        if (!date) { errors.push({ row: rowNum, error: `Bad or missing expense date "${f.expense_date ?? ''}".` }); return; }
        if (f.currency && f.currency.toUpperCase() !== 'USD') { errors.push({ row: rowNum, error: `Currency ${f.currency} isn't supported (Ledger is single-currency, USD).` }); return; }

        const description = f.description ? clip(f.description, 1000) : '';
        const vendor = clip(f.vendor, 200) || clip(description, 60) || 'Unknown';

        // Distance rows are mileage claims, not spending — they belong in the mileage log
        // (importing them as dollar expenses too would double count the deduction).
        const distance = parseNumber(f.distance);
        if (distance !== null && distance > 0) {
            const km = /km|kilomet/i.test(f.mileage_unit || '');
            const miles = Math.round(distance * (km ? KM_TO_MILES : 1) * 100) / 100;
            const parts = [`Imported from ${sourceSystem === 'zoho' ? 'Zoho Books' : 'another system'}`];
            if (f.vehicle_name) parts.push(`Vehicle: ${clip(f.vehicle_name, 80)}`);
            if (f.odometer_start || f.odometer_end) parts.push(`Odometer ${f.odometer_start || '?'}–${f.odometer_end || '?'}`);
            if (km) parts.push(`${distance} km converted to miles`);
            mileage.push({
                rowNum,
                record: { log_date: date, miles, purpose: clip(description || vendor || 'Imported mileage', 200), notes: parts.join(' · '), source: `${sourceSystem}_import`, needs_review: false, import_source: sourceSystem },
            });
            return;
        }

        let cents = parseMoney(f.total);
        if (cents === null) {
            const base = parseMoney(f.amount);
            cents = base === null ? null : base + (parseMoney(f.tax_amount) || 0);
        }
        if (cents === null) { errors.push({ row: rowNum, error: 'Missing or unreadable amount.' }); return; }
        if (cents === 0) { errors.push({ row: rowNum, error: 'Amount is $0.00 — skipped.' }); return; }

        const { category, mapped } = mapCategory(f.category);
        if (f.category) {
            const entry = categoryMap.get(f.category) || { category, count: 0 };
            entry.count++;
            categoryMap.set(f.category, entry);
        }
        if (mapped && f.category) holding[labelOf('category') || 'Expense Account'] = clip(f.category, 2000);

        // Only categories with a known Schedule C bucket are marked deductible; unknown ones are left for the user to decide.
        const rule = CATEGORY_BUCKETS[category];
        const deductible = markDeductible && Boolean(rule);

        expenses.push({
            rowNum,
            record: {
                expense_date: date,
                vendor,
                category,
                amount_cents: cents,
                currency: 'USD',
                notes: description,
                source: clip(f.paid_through, 120) || (sourceSystem === 'zoho' ? 'Zoho Books' : 'Imported'),
                tax_deductible: deductible,
                tax_bucket: rule ? rule.bucket : '',
                business_use_pct: rule?.pct || 100,
                legacy_id: f.legacy_id ? clip(f.legacy_id, 100) : null,
                import_source: sourceSystem,
            },
            holding,
        });
    });

    return { expenses, mileage, errors, categoryMap };
}

// Same semantics as the bank import's rule loop (first matching rule wins) so imported rows follow the user's own rules.
function applyRules(record, rules) {
    for (const r of rules || []) {
        const text = r.match_column === 'vendor' ? record.vendor : r.match_column === 'notes' ? record.notes : '';
        const target = String(r.match_value || '').toLowerCase();
        const hay = String(text || '').toLowerCase();
        if (!target || !(r.match_type === 'exact' ? hay === target : hay.includes(target))) continue;
        if (r.assign_category) record.category = r.assign_category;
        if (r.assign_tax_bucket) record.tax_bucket = r.assign_tax_bucket;
        record.tax_deductible = !!r.assign_tax_deductible;
        if (r.assign_business_use_pct != null) record.business_use_pct = r.assign_business_use_pct;
        return;
    }
}

// Flags rows that already exist. Order matters and each existing row is used at most once:
//   already_imported — same ID from the same system (skip)
//   exact            — same date + vendor + amount (skip; counted, so genuinely repeated purchases still import)
//   similar          — same amount within ±2 days, e.g. the bank transaction for the same purchase (default merge: fills blanks only)
function findExpenseDuplicates(expenses, existing, sourceSystem) {
    const byLegacy = new Map(existing.filter(e => e.legacy_id && e.import_source === sourceSystem).map(e => [e.legacy_id, e]));
    const exact = new Map();
    const byAmount = new Map();
    for (const e of existing) {
        const key = `${e.expense_date}|${normName(e.vendor)}|${e.amount_cents}`;
        if (!exact.has(key)) exact.set(key, []);
        exact.get(key).push(e);
        const k = String(e.amount_cents);
        if (!byAmount.has(k)) byAmount.set(k, []);
        byAmount.get(k).push(e);
    }
    const used = new Set();
    const describe = (kind, row, defaultDecision) => ({ kind, existingId: row.id, existingVendor: row.vendor, existingDate: row.expense_date, existingSource: row.source || null, defaultDecision });

    for (const exp of expenses) {
        exp.dup = null;
        const r = exp.record;
        const legacy = r.legacy_id && byLegacy.get(r.legacy_id);
        if (legacy) { exp.dup = describe('already_imported', legacy, 'skip'); used.add(legacy.id); continue; }

        const pool = exact.get(`${r.expense_date}|${normName(r.vendor)}|${r.amount_cents}`) || [];
        const same = pool.find(e => !used.has(e.id));
        if (same) { used.add(same.id); exp.dup = describe('exact', same, 'skip'); continue; }

        const near = (byAmount.get(String(r.amount_cents)) || []).find(e => !used.has(e.id) && Math.abs(dayNumber(e.expense_date) - dayNumber(r.expense_date)) <= 2);
        if (near) { used.add(near.id); exp.dup = describe('similar', near, 'merge'); }
    }
    return expenses;
}

// Fill-blanks merge into an existing (usually bank-sourced) row; never changes date, vendor, amount or account.
function mergeExpenseFill(existing, record) {
    const updates = {};
    const blankCategory = !existing.category || existing.category === 'Uncategorized';
    if (blankCategory && record.category && record.category !== 'Uncategorized') updates.category = record.category;
    if (!existing.notes && record.notes) updates.notes = record.notes;
    if (!existing.tax_bucket && record.tax_bucket) {
        updates.tax_bucket = record.tax_bucket;
        updates.tax_deductible = record.tax_deductible;
        updates.business_use_pct = record.business_use_pct;
    }
    return updates;
}

module.exports = { buildExpenses, applyRules, findExpenseDuplicates, mergeExpenseFill, mapCategory, CATEGORY_BUCKETS };
