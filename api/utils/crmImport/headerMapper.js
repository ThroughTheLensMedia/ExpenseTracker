'use strict';

const ZOHO = require('./zohoHeaders');

const HOLDING = '__holding__';
const IGNORE = '__ignore__';

// Normalize for comparison: lowercase, punctuation → single space ("Terms & Conditions" → "terms conditions").
const norm = h => String(h || '').toLowerCase().replace(/[^a-z0-9%#]+/g, ' ').trim();

// `syn` is ordered best-first. A target takes only the best-matching header; any other
// header that also matches it goes to the holding area instead of silently overwriting it.
const PARTY_TARGETS = [
        { key: 'name', label: 'Client name', syn: ['display name', 'client name', 'customer name', 'full name', 'name', 'contact name', 'client', 'customer'] },
        { key: 'company', label: 'Company (name fallback)', syn: ['company name', 'company', 'organization', 'business name'] },
        { key: 'first_name', label: 'First name (name fallback)', syn: ['first name', 'firstname', 'given name'] },
        { key: 'last_name', label: 'Last name (name fallback)', syn: ['last name', 'lastname', 'surname', 'family name'] },
        { key: 'email', label: 'Email', syn: ['emailid', 'email', 'email id', 'email address', 'e mail', 'primary contact emailid'] },
        { key: 'phone', label: 'Phone', syn: ['phone', 'phone number', 'work phone', 'telephone', 'tel'] },
        { key: 'phone_alt', label: 'Mobile phone', syn: ['mobilephone', 'mobile phone', 'mobile', 'cell', 'cell phone'] },
        { key: 'address_line1', label: 'Address – street', syn: ['billing address', 'address', 'street address', 'street', 'address line 1', 'address 1'] },
        { key: 'address_line2', label: 'Address – line 2', syn: ['billing street2', 'address line 2', 'street2', 'address 2'] },
        { key: 'address_city', label: 'Address – city', syn: ['billing city', 'city', 'town'] },
        { key: 'address_state', label: 'Address – state', syn: ['billing state', 'state', 'province', 'region'] },
        { key: 'address_zip', label: 'Address – ZIP / postal code', syn: ['billing code', 'zip', 'zip code', 'postal code', 'postcode', 'billing zip'] },
        { key: 'address_country', label: 'Address – country', syn: ['billing country', 'country'] },
        { key: 'notes', label: 'Notes', syn: ['notes', 'note', 'comments', 'memo'] },
        { key: 'tax_id', label: 'Tax ID (stored encrypted)', syn: ['taxid', 'tax id', 'tin', 'ein', 'ssn', 'tax identification number', 'taxpayer id', 'tax payer id'] },
        { key: 'legacy_id', label: 'ID in old system', syn: ['contact id', 'customer id', 'client id', 'vendor id', 'id'] },
];

const TARGETS = {
    contacts: PARTY_TARGETS,
    vendors: [
        ...PARTY_TARGETS.filter(t => t.key !== 'name'),
        { key: 'name', label: 'Vendor name', syn: ['display name', 'vendor name', 'supplier name', 'company name', 'name', 'contact name', 'vendor', 'supplier', 'payee'] },
        { key: 'website', label: 'Website', syn: ['website', 'web site', 'url'] },
        { key: 'track_1099', label: 'Track 1099 payments (yes/no)', syn: ['track 1099 payments', 'track 1099', '1099'] },
        { key: 'tin_type', label: 'Tax ID type (SSN/EIN)', syn: ['tintype', 'tin type', 'tax id type'] },
    ],
    expenses: [
        { key: 'expense_date', label: 'Expense date', syn: ['expense date', 'date', 'transaction date'] },
        { key: 'description', label: 'Description (saved as notes)', syn: ['expense description', 'description', 'memo', 'notes', 'note'] },
        { key: 'category', label: 'Category / expense account', syn: ['expense account', 'category', 'expense category'] },
        { key: 'paid_through', label: 'Paid from (account)', syn: ['paid through', 'payment account', 'paid from', 'account'] },
        { key: 'vendor', label: 'Vendor', syn: ['vendor', 'payee', 'merchant', 'supplier'] },
        { key: 'currency', label: 'Currency', syn: ['currency code', 'currency'] },
        { key: 'total', label: 'Total (including tax)', syn: ['total', 'total amount'] },
        { key: 'amount', label: 'Amount', syn: ['expense amount', 'amount', 'cost'] },
        { key: 'tax_amount', label: 'Tax amount', syn: ['tax amount'] },
        { key: 'legacy_id', label: 'ID in old system', syn: ['expense reference id'] },
        { key: 'distance', label: 'Distance (mileage rows)', syn: ['distance'] },
        { key: 'mileage_unit', label: 'Distance unit (mile/km)', syn: ['mileage unit', 'distance unit'] },
        { key: 'vehicle_name', label: 'Vehicle', syn: ['vehicle name', 'vehicle'] },
        { key: 'odometer_start', label: 'Start odometer', syn: ['start odometer reading', 'start odometer'] },
        { key: 'odometer_end', label: 'End odometer', syn: ['end odometer reading', 'end odometer'] },
    ],
    invoices: [
        { key: 'invoice_number', label: 'Invoice number', syn: ['invoice number', 'invoice no', 'invoice #', 'invoice num', 'inv number', 'number', 'invoice'] },
        { key: 'issue_date', label: 'Invoice date', syn: ['invoice date', 'issued date', 'issue date', 'date'] },
        { key: 'due_date', label: 'Due date', syn: ['due date', 'payment due', 'due'] },
        { key: 'status', label: 'Status', syn: ['invoice status', 'status'] },
        { key: 'customer_name', label: 'Customer name', syn: ['customer name', 'client name', 'client', 'customer', 'bill to'] },
        { key: 'customer_legacy_id', label: 'Customer ID in old system', syn: ['customer id', 'client id', 'contact id'] },
        { key: 'customer_email', label: 'Customer email', syn: ['primary contact emailid', 'customer email', 'client email', 'email'] },
        { key: 'total', label: 'Invoice total', syn: ['total', 'invoice total', 'grand total', 'amount'] },
        { key: 'subtotal', label: 'Subtotal', syn: ['subtotal', 'sub total'] },
        { key: 'balance', label: 'Balance still owed', syn: ['balance', 'balance due', 'amount due', 'outstanding'] },
        { key: 'currency', label: 'Currency', syn: ['currency code', 'currency'] },
        { key: 'notes', label: 'Invoice notes', syn: ['notes', 'note'] },
        { key: 'item_name', label: 'Line item name', syn: ['item name', 'item', 'product', 'service'] },
        { key: 'item_desc', label: 'Line item description', syn: ['item desc', 'item description', 'description'] },
        { key: 'quantity', label: 'Quantity', syn: ['quantity', 'qty'] },
        { key: 'item_price', label: 'Unit price', syn: ['item price', 'rate', 'unit price', 'price'] },
        { key: 'item_total', label: 'Line total', syn: ['item total', 'line total', 'line amount'] },
        { key: 'item_discount_amount', label: 'Line discount amount', syn: ['discount amount'] },
        { key: 'item_tax_pct', label: 'Line tax %', syn: ['item tax %', 'item tax percent', 'tax %', 'tax percentage'] },
        { key: 'invoice_tax_pct', label: 'Invoice tax %', syn: ['invoice level tax %', 'invoice tax %', 'tax rate'] },
        { key: 'discount_pct', label: 'Invoice discount %', syn: ['entity discount percent', 'discount percent', 'discount %'] },
        { key: 'discount_amount', label: 'Invoice discount amount', syn: ['entity discount amount', 'discount total'] },
        { key: 'shipping_charge', label: 'Shipping charge', syn: ['shipping charge', 'shipping'] },
        { key: 'adjustment', label: 'Adjustment', syn: ['adjustment'] },
        { key: 'adjustment_desc', label: 'Adjustment description', syn: ['adjustment description'] },
        { key: 'inclusive_tax', label: 'Prices include tax (yes/no)', syn: ['is inclusive tax', 'tax inclusive'] },
        { key: 'discount_before_tax', label: 'Discount applied before tax (yes/no)', syn: ['is discount before tax'] },
        { key: 'legacy_id', label: 'Invoice ID in old system', syn: ['invoice id'] },
    ],
};

// Multi-column targets: several source columns may feed these (e.g. an address split across columns is
// still one target each, but notes-like targets never collide because we allow only one best header).
const SPECIAL_TARGETS = [
    { key: HOLDING, label: 'Keep in holding area (nothing is lost)' },
    { key: IGNORE, label: 'Ignore this column' },
];

// Sensitive columns must never land in plaintext holding data.
const SENSITIVE = /^(tax id|taxid|tin|ssn|ein|social security( number)?|tax identification number|tax payer id|taxpayer id)$/;
const isSensitiveHeader = header => SENSITIVE.test(norm(header));

const REQUIRED = {
    contacts: { anyOf: [['name', 'company', 'first_name', 'last_name']], message: 'Map at least one column to Client name (or Company / First name / Last name).' },
    vendors: { anyOf: [['name', 'company', 'first_name', 'last_name']], message: 'Map at least one column to Vendor name (or Company / First name / Last name).' },
    expenses: { all: ['expense_date'], anyOf: [['total', 'amount']], message: 'Expenses need a date and an amount (Total or Amount).' },
    invoices: {
        all: ['invoice_number', 'issue_date'],
        anyOf: [['customer_name', 'customer_legacy_id', 'customer_email'], ['item_price', 'total']],
        message: 'Invoices need an invoice number, a date, a customer, and either unit prices or a total.',
    },
};

// Columns that are only present in one specific type's export — used to warn when the wrong file type is chosen.
const TYPE_SIGNALS = {
    invoices: ['invoice number', 'invoice id', 'invoice status'],
    contacts: ['customer sub type', 'contact type', 'portal enabled'],
    vendors: ['track 1099 payments', 'tintype', 'tin'],
    expenses: ['expense account', 'expense date', 'paid through'],
};

// Contact-like types: tax IDs are kept (encrypted) instead of ignored.
const PARTY_TYPES = new Set(['contacts', 'vendors']);

const ZOHO_SET = new Set(Object.values(ZOHO).flat().map(norm));

const targetsFor = type => TARGETS[type] || [];
const allowedTargetKeys = type => new Set([...targetsFor(type).map(t => t.key), HOLDING, IGNORE]);

function detectSource(headers) {
    if (!headers.length) return 'generic';
    const hits = headers.filter(h => ZOHO_SET.has(norm(h))).length;
    return hits / headers.length >= 0.6 && hits >= 8 ? 'zoho' : 'generic';
}

function guessFileType(headers) {
    const set = new Set(headers.map(norm));
    let best = null;
    let bestScore = 0;
    for (const [type, signals] of Object.entries(TYPE_SIGNALS)) {
        const score = signals.filter(s => set.has(s)).length;
        if (score > bestScore) { best = type; bestScore = score; }
    }
    return best;
}

const columnHasData = (rows, header) => rows.some(r => String(r[header] ?? '').trim() !== '');
const sampleValues = (rows, header, n = 3) => {
    if (isSensitiveHeader(header)) return rows.some(r => r[header]) ? ['••••'] : [];
    const out = [];
    for (const r of rows) {
        const v = String(r[header] ?? '').trim();
        if (v && !out.includes(v)) out.push(v.length > 60 ? `${v.slice(0, 57)}…` : v);
        if (out.length >= n) break;
    }
    return out;
};

// Deterministic first pass. Returns { mapping, unresolved, detectedSource }.
// mapping[header] = { target, confidence: 'high' | 'known' | 'empty' | 'sensitive' | 'duplicate', unresolved? }
function autoMap(type, headers, rows) {
    const targets = targetsFor(type);
    const detectedSource = detectSource(headers);
    const mapping = {};

    // Best header per target: lowest synonym index wins, ties go to the earlier column.
    const winner = {};
    headers.forEach((header, col) => {
        const n = norm(header);
        for (const t of targets) {
            const idx = t.syn.indexOf(n);
            if (idx === -1) continue;
            const cur = winner[t.key];
            if (!cur || idx < cur.idx || (idx === cur.idx && col < cur.col)) winner[t.key] = { header, idx, col };
        }
    });

    // A header matching several targets (e.g. "Customer ID" → customer_legacy_id) goes to the target where it ranks best.
    const claimed = new Map(); // header → target key
    for (const t of targets) {
        const w = winner[t.key];
        if (!w) continue;
        const prev = claimed.get(w.header);
        if (!prev) { claimed.set(w.header, t.key); continue; }
        const prevIdx = targets.find(x => x.key === prev).syn.indexOf(norm(w.header));
        if (w.idx < prevIdx) claimed.set(w.header, t.key);
    }

    const unresolved = [];
    for (const header of headers) {
        const n = norm(header);
        if (PARTY_TYPES.has(type) && isSensitiveHeader(header)) {
            mapping[header] = { target: 'tax_id', confidence: 'sensitive' };
        } else if (isSensitiveHeader(header)) {
            mapping[header] = { target: IGNORE, confidence: 'sensitive' };
        } else if (claimed.has(header)) {
            mapping[header] = { target: claimed.get(header), confidence: 'high' };
        } else if (targets.some(t => t.syn.includes(n))) {
            mapping[header] = { target: HOLDING, confidence: 'duplicate' };
        } else if (!columnHasData(rows, header)) {
            mapping[header] = { target: IGNORE, confidence: 'empty' };
        } else if (detectedSource === 'zoho' && ZOHO_SET.has(n)) {
            mapping[header] = { target: HOLDING, confidence: 'known' };
        } else {
            mapping[header] = { target: HOLDING, confidence: 'unresolved', unresolved: true };
            unresolved.push({ header, samples: sampleValues(rows, header) });
        }
    }
    return { mapping, unresolved, detectedSource };
}

// Missing required targets for a confirmed mapping ([] when fine).
function missingRequired(type, mapping) {
    const rules = REQUIRED[type];
    if (!rules) return [];
    const mapped = new Set(Object.values(mapping).map(m => (typeof m === 'string' ? m : m.target)));
    const missing = [];
    for (const key of rules.all || []) if (!mapped.has(key)) missing.push(key);
    for (const group of rules.anyOf || []) if (!group.some(k => mapped.has(k))) missing.push(group[0]);
    return missing;
}

// Validates + normalizes a user-confirmed mapping ({ header: targetKey }). Returns { mapping, errors }.
// Enforces: every header present, every target allowed, no two columns on one target,
// and sensitive columns never end up in plaintext holding data.
function finalizeMapping(type, headers, input) {
    const errors = [];
    const allowed = allowedTargetKeys(type);
    const out = {};
    const used = new Map();
    for (const header of headers) {
        let target = input?.[header];
        if (target === undefined) { errors.push(`Column "${header}" has no mapping.`); continue; }
        if (!allowed.has(target)) { errors.push(`Column "${header}" is mapped to an unknown field "${target}".`); continue; }
        if (isSensitiveHeader(header) && target === HOLDING) target = PARTY_TYPES.has(type) ? 'tax_id' : IGNORE;
        if (target !== HOLDING && target !== IGNORE) {
            if (used.has(target)) {
                errors.push(`"${used.get(target)}" and "${header}" are both mapped to "${target}". Pick one.`);
                continue;
            }
            used.set(target, header);
        }
        out[header] = target;
    }
    const missing = missingRequired(type, out);
    if (missing.length) errors.push(REQUIRED[type].message);
    return { mapping: out, errors };
}

module.exports = {
    HOLDING, IGNORE, SPECIAL_TARGETS, TARGETS, norm,
    targetsFor, allowedTargetKeys, autoMap, finalizeMapping, missingRequired,
    detectSource, guessFileType, isSensitiveHeader,
};
