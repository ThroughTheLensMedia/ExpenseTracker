'use strict';

const {
    readRow, clip, parseMoney, parseNumber, parseBool, parseDate,
    normName, normEmail, hasUnsafeScheme,
} = require('./common');

const STATUS_MAP = {
    draft: 'draft',
    sent: 'sent', viewed: 'sent', overdue: 'sent', unpaid: 'sent', open: 'sent', outstanding: 'sent',
    'partially paid': 'sent', partial: 'sent', pending: 'sent', approved: 'sent', 'payment initiated': 'sent',
    paid: 'paid', closed: 'paid',
    void: 'void', voided: 'void', cancelled: 'void', canceled: 'void', 'written off': 'void',
};
const mapStatus = raw => STATUS_MAP[String(raw ?? '').trim().toLowerCase()] || null;

// Fields that vary per CSV row (one row per line item); everything else is read once per invoice.
const LINE_KEYS = new Set(['item_name', 'item_desc', 'quantity', 'item_price', 'item_total', 'item_discount_amount', 'item_tax_pct']);

const fmt = cents => `$${(cents / 100).toFixed(2)}`;

// Mirrors the app's own math (metrics.js / pay.js): only quantity > 0 lines count,
// tax and discount are each a percent of the subtotal.
function invoiceTotalCents(lines, taxPct, discountBp) {
    const subtotal = lines.filter(l => l.quantity > 0).reduce((s, l) => s + l.quantity * l.unit_price_cents, 0);
    const tax = Math.round(subtotal * (taxPct / 100));
    const discount = Math.round(subtotal * (discountBp / 10000));
    return Math.round(subtotal) + tax - discount;
}
const subtotalOf = lines => lines.filter(l => l.quantity > 0).reduce((s, l) => s + l.quantity * l.unit_price_cents, 0);

function resolveTaxPct(header, lineInputs, warnings) {
    const invoiceLevel = parseNumber(header.invoice_tax_pct);
    if (invoiceLevel !== null && invoiceLevel > 0) return invoiceLevel;
    const pcts = lineInputs
        .map(l => ({ pct: parseNumber(l.item_tax_pct), weight: Math.abs((parseMoney(l.item_price) ?? parseMoney(l.item_total) ?? 0) * (parseNumber(l.quantity) ?? 1)) }))
        .filter(x => x.pct !== null && x.pct > 0);
    if (!pcts.length) return 0;
    if (pcts.every(x => x.pct === pcts[0].pct)) return pcts[0].pct;
    const weight = pcts.reduce((s, x) => s + x.weight, 0) || pcts.length;
    const avg = pcts.reduce((s, x) => s + x.pct * (x.weight || 1), 0) / weight;
    warnings.push({ code: 'mixed_tax_rates', message: `Line items use different tax rates; Ledger supports one rate per invoice, so a blended ${avg.toFixed(3)}% was used and the total was reconciled to the file.` });
    return Number(avg.toFixed(3));
}

function buildLines(lineInputs, taxPct, inclusive, warnings) {
    const lines = [];
    for (const input of lineInputs) {
        const name = clip(input.item_name, 300);
        const desc = clip(input.item_desc, 500);
        let qty = parseNumber(input.quantity);
        let price = parseMoney(input.item_price);
        const lineTotal = parseMoney(input.item_total);
        const discount = parseMoney(input.item_discount_amount) || 0;
        if (!name && !desc && price === null && lineTotal === null) continue;
        if (qty === null) qty = 1;
        if (price === null && lineTotal !== null) price = qty ? Math.round(lineTotal / qty) : lineTotal;
        if (price === null) { price = 0; warnings.push({ code: 'missing_price', message: `Line "${name || desc || 'item'}" has no price — imported as $0.00.` }); }
        let unit = price;
        if (discount > 0 && qty !== 0) unit = Math.round((price * qty - discount) / qty);
        if (inclusive && taxPct > 0) unit = Math.round(unit / (1 + taxPct / 100));
        const description = name && desc && name !== desc ? `${name} — ${desc}` : (name || desc || 'Imported item');
        lines.push({ description: clip(description, 800), quantity: qty, unit_price_cents: unit });
    }
    return lines;
}

function buildOne(number, group, sourceSystem) {
    const rowNums = group.map(g => g.rowNum);
    const header = {};
    const lineInputs = [];
    const holdingSets = {};
    for (const { fields, holding } of group) {
        const line = {};
        for (const [k, v] of Object.entries(fields)) {
            if (LINE_KEYS.has(k)) line[k] = v;
            else if (header[k] === undefined) header[k] = v;
        }
        lineInputs.push(line);
        for (const [h, v] of Object.entries(holding)) (holdingSets[h] ||= new Set()).add(v);
    }

    const fail = message => ({ error: { row: rowNums[0], invoice: number, error: message } });

    if (header.currency && header.currency.toUpperCase() !== 'USD') return fail(`Currency ${header.currency} isn't supported (Ledger is single-currency, USD).`);
    const issueDate = parseDate(header.issue_date);
    if (!issueDate) return fail(`Bad or missing invoice date "${header.issue_date ?? ''}".`);
    if (!header.customer_name && !header.customer_legacy_id && !header.customer_email) return fail('No customer on this invoice.');

    const warnings = [];
    let dueDate = null;
    if (header.due_date) {
        dueDate = parseDate(header.due_date);
        if (!dueDate) warnings.push({ code: 'bad_due_date', message: `Due date "${header.due_date}" couldn't be read — left blank.` });
    }

    const inclusive = parseBool(header.inclusive_tax);
    const taxPct = Math.min(100, Math.max(0, resolveTaxPct(header, lineInputs, warnings)));
    const lines = buildLines(lineInputs, taxPct, inclusive, warnings);

    const csvTotal = parseMoney(header.total);
    if (!lines.length) {
        let base = parseMoney(header.subtotal);
        if (base === null && csvTotal !== null) base = taxPct > 0 ? Math.round(csvTotal / (1 + taxPct / 100)) : csvTotal;
        if (base === null) return fail('No line items and no total in the file.');
        lines.push({ description: 'Imported invoice (no line items in file)', quantity: 1, unit_price_cents: base });
        warnings.push({ code: 'no_line_items', message: 'The file has no line items for this invoice — one summary line was created.' });
    }

    const shipping = parseMoney(header.shipping_charge);
    if (shipping && shipping > 0) lines.push({ description: 'Shipping', quantity: 1, unit_price_cents: shipping });
    const adjustment = parseMoney(header.adjustment);
    if (adjustment) lines.push({ description: clip(header.adjustment_desc, 200) || 'Adjustment', quantity: 1, unit_price_cents: adjustment });

    let discountBp = 0;
    const discountPct = parseNumber(header.discount_pct);
    if (discountPct !== null && discountPct > 0) {
        discountBp = Math.min(10000, Math.round(discountPct * 100));
    } else {
        const discountAmt = parseMoney(header.discount_amount);
        if (discountAmt && discountAmt > 0) {
            const beforeTax = header.discount_before_tax === undefined ? true : parseBool(header.discount_before_tax);
            lines.push({ description: 'Discount', quantity: 1, unit_price_cents: -(beforeTax || taxPct <= 0 ? discountAmt : Math.round(discountAmt / (1 + taxPct / 100))) });
        }
    }

    const factor = 1 + taxPct / 100 - discountBp / 10000;

    // Match the source system's total exactly — a visible "Imported adjustment" line beats silently different money.
    if (csvTotal !== null) {
        const diff = csvTotal - invoiceTotalCents(lines, taxPct, discountBp);
        if (Math.abs(diff) > 1 && factor > 0.01) {
            lines.push({ description: 'Imported adjustment', quantity: 1, unit_price_cents: Math.round(diff / factor) });
            warnings.push({ code: 'total_adjusted', message: `Line items were ${fmt(Math.abs(diff))} ${diff > 0 ? 'under' : 'over'} the file's total; an "Imported adjustment" line was added so the total matches.` });
        }
        if (Math.abs(csvTotal - invoiceTotalCents(lines, taxPct, discountBp)) > 2) {
            warnings.push({ code: 'total_mismatch', message: `Couldn't reconcile this invoice to the file's total of ${fmt(csvTotal)} — check it after import.` });
        }
    }

    // Status + balance. When both exist and disagree, the balance (actual money owed) wins.
    const rawStatus = header.status ?? '';
    const balance = parseMoney(header.balance);
    let total = invoiceTotalCents(lines, taxPct, discountBp);
    let status = mapStatus(rawStatus);
    if (!status) {
        status = balance === 0 && total > 0 ? 'paid' : 'sent';
        warnings.push({ code: 'unknown_status', message: rawStatus ? `Status "${rawStatus}" isn't recognized — treated as ${status === 'paid' ? 'paid (balance is $0.00)' : 'open'}.` : 'No status in the file — treated as open so you can review it.' });
    }
    if (status === 'sent' && balance === 0 && total > 0) {
        status = 'paid';
        warnings.push({ code: 'status_balance_conflict', message: `Status says open but the balance is $0.00 — imported as paid.` });
    } else if (status === 'paid' && balance !== null && balance > 0) {
        status = 'sent';
        warnings.push({ code: 'status_balance_conflict', message: `Status says paid but ${fmt(balance)} is still owed — imported as open.` });
    }

    const legacyOpen = status === 'sent';
    let legacyBalance = null;
    let partial = false;
    if (legacyOpen) {
        legacyBalance = balance !== null ? balance : total;
        // Partially paid: fold prior payments into the invoice so Ledger's total (and any payment link) equals what is still owed.
        if (balance !== null && balance > 0 && balance < total - 1 && factor > 0.01) {
            lines.push({ description: 'Payments received before import', quantity: 1, unit_price_cents: Math.round(balance / factor - subtotalOf(lines)) });
            partial = true;
            total = invoiceTotalCents(lines, taxPct, discountBp);
            if (Math.abs(total - balance) > 2) warnings.push({ code: 'balance_mismatch', message: `Couldn't make the invoice total match the ${fmt(balance)} still owed — check it after import.` });
        } else if (balance !== null && balance > total + 1) {
            warnings.push({ code: 'balance_exceeds_total', message: `Balance ${fmt(balance)} is larger than the invoice total ${fmt(total)}.` });
        }
    }

    let notes = header.notes ? clip(header.notes, 5000) : null;
    if (notes && hasUnsafeScheme(notes)) {
        (holdingSets['Notes (held back: contains a link scheme Ledger blocks)'] ||= new Set()).add(notes);
        notes = null;
        warnings.push({ code: 'unsafe_notes', message: 'Notes contained a javascript:/data: link, which Ledger blocks — moved to the holding area.' });
    }

    const holding = {};
    for (const [h, set] of Object.entries(holdingSets)) holding[h] = set.size === 1 ? [...set][0] : [...set];
    holding._import = {
        source_status: rawStatus || null,
        source_total_cents: csvTotal,
        source_balance_cents: balance,
        source_invoice_id: header.legacy_id || null,
        warnings: warnings.map(w => w.code),
    };

    return {
        invoice: {
            invoiceNumber: clip(number, 100),
            rowNums,
            record: {
                invoice_number: clip(number, 100),
                issue_date: issueDate,
                due_date: dueDate,
                status,
                notes,
                tax_percent: Number(taxPct.toFixed(3)),
                discount_cents: discountBp,
                photographer_signed: status !== 'draft',
                legacy_id: header.legacy_id ? clip(header.legacy_id, 100) : null,
                import_source: sourceSystem,
                legacy_open: legacyOpen,
                legacy_balance_cents: legacyBalance,
                created_at: `${issueDate}T12:00:00Z`,
            },
            items: lines,
            holding,
            warnings,
            customer: {
                legacyId: header.customer_legacy_id ? clip(header.customer_legacy_id, 100) : null,
                name: header.customer_name ? clip(header.customer_name, 200) : null,
                email: header.customer_email ? clip(header.customer_email, 254) : null,
            },
            totalCents: total,
            partial,
        },
    };
}

// Groups CSV rows (one per line item) by invoice number and builds an invoice per group.
// Returns { invoices, errors }.
function buildInvoices(rows, mapping, sourceSystem = 'generic') {
    const groups = new Map();
    const errors = [];
    rows.forEach((row, i) => {
        const rowNum = i + 1;
        const { fields, holding } = readRow(row, mapping);
        if (!Object.keys(fields).length && !Object.keys(holding).length) return;
        const number = (fields.invoice_number || '').trim();
        if (!number) { errors.push({ row: rowNum, error: 'Row has no invoice number.' }); return; }
        if (!groups.has(number)) groups.set(number, []);
        groups.get(number).push({ rowNum, fields, holding });
    });

    const invoices = [];
    for (const [number, group] of groups) {
        const out = buildOne(number, group, sourceSystem);
        if (out.error) errors.push(out.error);
        else invoices.push(out.invoice);
    }
    return { invoices, errors };
}

// Flags invoices that already exist. Unique per user on invoice_number, so "keep both" isn't possible —
// choices are skip (default) or renumber.
function findInvoiceDuplicates(invoices, existing, sourceSystem) {
    const byNumber = new Map(existing.map(e => [e.invoice_number, e]));
    const byLegacy = new Map(existing.filter(e => e.legacy_id && e.import_source === sourceSystem).map(e => [e.legacy_id, e]));
    for (const inv of invoices) {
        const legacyHit = inv.record.legacy_id && byLegacy.get(inv.record.legacy_id);
        const numberHit = byNumber.get(inv.record.invoice_number);
        inv.dup = legacyHit
            ? { kind: 'already_imported', existingNumber: legacyHit.invoice_number }
            : numberHit ? { kind: 'number', existingNumber: numberHit.invoice_number } : null;
    }
    return invoices;
}

// Links each invoice to an existing client: old-system ID (same system) → email → exact name.
// Returns the distinct customers that matched nobody.
function resolveCustomers(invoices, clients, sourceSystem) {
    const byLegacy = new Map();
    const byEmail = new Map();
    const byName = new Map();
    for (const c of clients) {
        if (c.legacy_id && c.import_source === sourceSystem) byLegacy.set(c.legacy_id, c);
        if (c.email) byEmail.set(normEmail(c.email), c);
        const n = normName(c.name);
        if (n && !byName.has(n)) byName.set(n, c);
    }
    const unmatched = new Map();
    for (const inv of invoices) {
        const { legacyId, email, name } = inv.customer;
        const hit = (legacyId && byLegacy.get(legacyId)) || (email && byEmail.get(normEmail(email))) || (name && byName.get(normName(name)));
        inv.clientId = hit ? hit.id : null;
        if (hit) continue;
        const key = legacyId ? `id:${legacyId}` : `n:${normName(name || email)}`;
        inv.customerKey = key;
        const entry = unmatched.get(key) || { key, name: name || email, email: email || null, legacyId: legacyId || null, invoiceCount: 0 };
        entry.invoiceCount++;
        unmatched.set(key, entry);
    }
    return [...unmatched.values()];
}

module.exports = {
    buildInvoices, findInvoiceDuplicates, resolveCustomers,
    mapStatus, invoiceTotalCents,
};
