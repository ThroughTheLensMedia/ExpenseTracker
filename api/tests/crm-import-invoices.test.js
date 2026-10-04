const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseCsvText } = require('../utils/crmImport/csv');
const { autoMap, finalizeMapping, IGNORE } = require('../utils/crmImport/headerMapper');
const { buildInvoices, findInvoiceDuplicates, resolveCustomers, mapStatus, invoiceTotalCents } = require('../utils/crmImport/invoices');

const FIX = path.join(__dirname, 'fixtures', 'crm-import');
const HEADERS = fs.readFileSync(path.join(FIX, 'zoho-invoices-headers.txt'), 'utf8').trim().split(',');

async function load(rows) {
    const esc = v => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
    const text = [HEADERS.join(','), ...rows.map(r => HEADERS.map(h => esc(r[h] ?? '')).join(','))].join('\n');
    const { headers, rows: parsed } = await parseCsvText(text);
    const { mapping } = autoMap('invoices', headers, parsed);
    const final = finalizeMapping('invoices', headers, Object.fromEntries(Object.entries(mapping).map(([h, m]) => [h, m.target])));
    assert.deepEqual(final.errors, []);
    return buildInvoices(parsed, final.mapping, 'zoho');
}

const line = (over = {}) => ({
    'Invoice Number': 'INV-100', 'Invoice ID': 'z-100', 'Invoice Date': '2026-03-01', 'Due Date': '2026-03-15',
    'Invoice Status': 'Paid', 'Customer ID': '9001', 'Customer Name': 'Chelsea Harrison', 'Currency Code': 'USD',
    'Item Name': 'Portrait session', 'Item Desc': '2 hours', Quantity: '1', 'Item Price': '500.00', 'Item Total': '500.00',
    SubTotal: '500.00', Total: '500.00', Balance: '0.00', ...over,
});

const only = out => { assert.deepEqual(out.errors, []); assert.equal(out.invoices.length, 1); return out.invoices[0]; };

test('Zoho invoice headers map with no prompts and the right targets', async () => {
    const { headers, rows } = await parseCsvText([HEADERS.join(','), HEADERS.map(h => (h === 'Invoice Number' ? 'INV-1' : 'x')).join(',')].join('\n'));
    const { mapping, unresolved } = autoMap('invoices', headers, rows);
    assert.deepEqual(unresolved, []);
    const t = h => mapping[h].target;
    assert.equal(t('Invoice Number'), 'invoice_number');
    assert.equal(t('Invoice Date'), 'issue_date');
    assert.equal(t('Issued Date'), '__holding__');
    assert.equal(t('Invoice Status'), 'status');
    assert.equal(t('Customer ID'), 'customer_legacy_id');
    assert.equal(t('Customer Name'), 'customer_name');
    assert.equal(t('Primary Contact EmailID'), 'customer_email');
    assert.equal(t('Total'), 'total');
    assert.equal(t('Balance'), 'balance');
    assert.equal(t('Item Price'), 'item_price');
    assert.equal(t('Item Tax %'), 'item_tax_pct');
    assert.equal(t('Invoice Level Tax %'), 'invoice_tax_pct');
    assert.equal(t('Entity Discount Percent'), 'discount_pct');
    assert.equal(t('Invoice ID'), 'legacy_id');
    assert.equal(t('Tax ID'), IGNORE); // sensitive-pattern header never reaches plaintext holding
    assert.equal(t('Stripe'), '__holding__');
});

test('rows are grouped by invoice number into one invoice with multiple line items', async () => {
    const out = await load([
        line({ 'Item Name': 'Session', 'Item Price': '300.00', 'Item Total': '300.00', Total: '500.00' }),
        line({ 'Item Name': 'Prints', 'Item Desc': '', Quantity: '4', 'Item Price': '50.00', 'Item Total': '200.00', Total: '500.00' }),
        line({ 'Invoice Number': 'INV-101', 'Invoice ID': 'z-101', Total: '500.00' }),
    ]);
    assert.equal(out.invoices.length, 2);
    const inv = out.invoices.find(i => i.invoiceNumber === 'INV-100');
    assert.deepEqual(inv.items.map(i => [i.description, i.quantity, i.unit_price_cents]), [['Session — 2 hours', 1, 30000], ['Prints', 4, 5000]]);
    assert.equal(inv.totalCents, 50000);
    assert.equal(inv.warnings.length, 0);
    assert.equal(inv.record.status, 'paid');
    assert.equal(inv.record.legacy_open, false);
    assert.equal(inv.record.legacy_balance_cents, null);
    assert.equal(inv.record.photographer_signed, true);
    assert.equal(inv.record.legacy_id, 'z-100');
    assert.equal(inv.record.created_at, '2026-03-01T12:00:00Z');
});

test('unpaid invoices are flagged open in the old system with their balance', async () => {
    const inv = only(await load([line({ 'Invoice Status': 'Overdue', Balance: '500.00' })]));
    assert.equal(inv.record.status, 'sent');
    assert.equal(inv.record.legacy_open, true);
    assert.equal(inv.record.legacy_balance_cents, 50000);
    assert.equal(inv.partial, false);
});

test('partial payments fold into the invoice so the Ledger total equals what is still owed', async () => {
    const inv = only(await load([line({ 'Invoice Status': 'Partially Paid', Balance: '200.00' })]));
    assert.equal(inv.record.status, 'sent');
    assert.equal(inv.record.legacy_balance_cents, 20000);
    assert.equal(inv.partial, true);
    assert.equal(inv.totalCents, 20000);
    const adj = inv.items.at(-1);
    assert.equal(adj.description, 'Payments received before import');
    assert.equal(adj.unit_price_cents, -30000);
});

test('partial payment on a taxed invoice still lands on the balance', async () => {
    const inv = only(await load([line({
        'Invoice Status': 'Partially Paid', 'Item Price': '1000.00', 'Item Total': '1000.00',
        'Invoice Level Tax %': '8.375', Total: '1083.75', Balance: '400.00',
    })]));
    assert.equal(inv.record.tax_percent, 8.375);
    assert.ok(Math.abs(inv.totalCents - 40000) <= 2, `total ${inv.totalCents}`);
});

test('status mapping covers common values and unknowns fall back safely', async () => {
    assert.equal(mapStatus('Viewed'), 'sent');
    assert.equal(mapStatus('VOID'), 'void');
    assert.equal(mapStatus('Draft'), 'draft');
    assert.equal(mapStatus('???'), null);

    const draft = only(await load([line({ 'Invoice Status': 'Draft', Balance: '500.00' })]));
    assert.equal(draft.record.status, 'draft');
    assert.equal(draft.record.legacy_open, false);
    assert.equal(draft.record.photographer_signed, false);

    const voided = only(await load([line({ 'Invoice Status': 'Void', Balance: '0.00' })]));
    assert.equal(voided.record.status, 'void');
    assert.equal(voided.record.legacy_open, false);

    const odd = only(await load([line({ 'Invoice Status': 'Mystery', Balance: '500.00' })]));
    assert.equal(odd.record.status, 'sent');
    assert.ok(odd.warnings.some(w => w.code === 'unknown_status'));
});

test('when status and balance disagree the balance wins and a warning is raised', async () => {
    const paidButOwed = only(await load([line({ 'Invoice Status': 'Paid', Balance: '500.00' })]));
    assert.equal(paidButOwed.record.status, 'sent');
    assert.equal(paidButOwed.record.legacy_open, true);
    assert.ok(paidButOwed.warnings.some(w => w.code === 'status_balance_conflict'));

    const openButZero = only(await load([line({ 'Invoice Status': 'Sent', Balance: '0.00' })]));
    assert.equal(openButZero.record.status, 'paid');
    assert.equal(openButZero.record.legacy_open, false);
});

test('tax comes from the invoice or uniform line rate, and totals reconcile to the file', async () => {
    const lineLevel = only(await load([line({ 'Item Tax %': '7', Total: '535.00' })]));
    assert.equal(lineLevel.record.tax_percent, 7);
    assert.equal(lineLevel.totalCents, 53500);
    assert.equal(lineLevel.warnings.length, 0);

    const mixed = only(await load([
        line({ 'Item Name': 'A', 'Item Price': '100.00', 'Item Tax %': '10', Total: '115.00' }),
        line({ 'Item Name': 'B', 'Item Price': '0.00', 'Item Tax %': '', Total: '115.00' }),
    ]));
    assert.ok(mixed.totalCents >= 11499 && mixed.totalCents <= 11501);
});

test('a total that line items cannot explain is matched with a visible adjustment line', async () => {
    const inv = only(await load([line({ Total: '525.00', Balance: '0.00' })]));
    assert.equal(inv.totalCents, 52500);
    assert.equal(inv.items.at(-1).description, 'Imported adjustment');
    assert.ok(inv.warnings.some(w => w.code === 'total_adjusted'));
});

test('shipping and adjustment become line items so totals reconcile', async () => {
    const inv = only(await load([line({ 'Shipping Charge': '25.00', Adjustment: '-5.00', 'Adjustment Description': 'Loyalty credit', Total: '520.00' })]));
    assert.deepEqual(inv.items.slice(1).map(i => [i.description, i.unit_price_cents]), [['Shipping', 2500], ['Loyalty credit', -500]]);
    assert.equal(inv.totalCents, 52000);
    assert.equal(inv.warnings.length, 0);
});

test('percent discounts use the app discount field; dollar discounts become a negative line', async () => {
    const pct = only(await load([line({ 'Entity Discount Percent': '10', Total: '450.00' })]));
    assert.equal(pct.record.discount_cents, 1000);
    assert.equal(pct.totalCents, 45000);
    assert.equal(invoiceTotalCents(pct.items, pct.record.tax_percent, pct.record.discount_cents), 45000);

    const amt = only(await load([line({ 'Entity Discount Amount': '50.00', Total: '450.00' })]));
    assert.equal(amt.record.discount_cents, 0);
    assert.deepEqual([amt.items.at(-1).description, amt.items.at(-1).unit_price_cents], ['Discount', -5000]);
    assert.equal(amt.totalCents, 45000);
});

test('tax-inclusive prices are converted so the total is not double taxed', async () => {
    const inv = only(await load([line({ 'Is Inclusive Tax': 'true', 'Item Price': '107.00', 'Item Total': '107.00', 'Invoice Level Tax %': '7', Total: '107.00' })]));
    assert.equal(inv.items[0].unit_price_cents, 10000);
    assert.equal(inv.totalCents, 10700);
});

test('line-level discounts reduce the effective unit price', async () => {
    const inv = only(await load([line({ Quantity: '2', 'Item Price': '100.00', 'Discount Amount': '20.00', 'Item Total': '180.00', Total: '180.00' })]));
    assert.equal(inv.items[0].unit_price_cents, 9000);
    assert.equal(inv.totalCents, 18000);
});

test('invoices without line items get one summary line from the total', async () => {
    const inv = only(await load([line({ 'Item Name': '', 'Item Desc': '', Quantity: '', 'Item Price': '', 'Item Total': '', SubTotal: '', Total: '250.00', Balance: '0.00' })]));
    assert.equal(inv.items.length, 1);
    assert.equal(inv.totalCents, 25000);
    assert.ok(inv.warnings.some(w => w.code === 'no_line_items'));
});

test('invalid rows report an error and never block valid ones', async () => {
    const out = await load([
        line({ 'Invoice Number': 'OK-1', 'Invoice ID': 'z1' }),
        line({ 'Invoice Number': 'BADDATE', 'Invoice Date': 'sometime' }),
        line({ 'Invoice Number': 'EUR-1', 'Currency Code': 'EUR' }),
        line({ 'Invoice Number': 'NOCUST', 'Customer Name': '', 'Customer ID': '' }),
        line({ 'Invoice Number': '' }),
    ]);
    assert.deepEqual(out.invoices.map(i => i.invoiceNumber), ['OK-1']);
    assert.equal(out.errors.length, 4);
    assert.ok(out.errors.some(e => /date/i.test(e.error)));
    assert.ok(out.errors.some(e => /EUR/.test(e.error)));
    assert.ok(out.errors.some(e => /customer/i.test(e.error)));
    assert.ok(out.errors.some(e => /no invoice number/i.test(e.error)));
});

test('notes with blocked link schemes are held back instead of stored', async () => {
    const inv = only(await load([line({ Notes: 'click javascript:alert(1)' })]));
    assert.equal(inv.record.notes, null);
    assert.ok(inv.warnings.some(w => w.code === 'unsafe_notes'));
});

test('holding data keeps unmapped columns and import metadata, without tax IDs', async () => {
    const inv = only(await load([line({ 'Sales person': 'Dana', 'Terms & Conditions': 'Net 14', 'Tax ID': '555', Stripe: 'yes' })]));
    assert.equal(inv.holding['Sales person'], 'Dana');
    assert.equal(inv.holding['Terms & Conditions'], 'Net 14');
    assert.equal(inv.holding._import.source_status, 'Paid');
    assert.equal(inv.holding._import.source_total_cents, 50000);
    assert.ok(!JSON.stringify(inv.holding).includes('555'));
});

test('invoice duplicates: same number or same old-system ID are flagged', async () => {
    const { invoices } = await load([line({ 'Invoice Number': 'A', 'Invoice ID': 'z1' }), line({ 'Invoice Number': 'B', 'Invoice ID': 'z2' }), line({ 'Invoice Number': 'C', 'Invoice ID': 'z3' })]);
    findInvoiceDuplicates(invoices, [
        { invoice_number: 'A', legacy_id: null, import_source: null },
        { invoice_number: 'OLD-B', legacy_id: 'z2', import_source: 'zoho' },
    ], 'zoho');
    assert.deepEqual(invoices.map(i => i.dup && i.dup.kind), ['number', 'already_imported', null]);
});

test('customers link by old-system ID, then email, then name; the rest are reported once', async () => {
    const { invoices } = await load([
        line({ 'Invoice Number': '1', 'Customer ID': '9001', 'Customer Name': 'Renamed Client' }),
        line({ 'Invoice Number': '2', 'Customer ID': '', 'Primary Contact EmailID': 'EMAIL@x.test', 'Customer Name': 'Someone' }),
        line({ 'Invoice Number': '3', 'Customer ID': '', 'Customer Name': 'name   match' }),
        line({ 'Invoice Number': '4', 'Customer ID': '777', 'Customer Name': 'Brand New' }),
        line({ 'Invoice Number': '5', 'Customer ID': '777', 'Customer Name': 'Brand New' }),
    ]);
    const unmatched = resolveCustomers(invoices, [
        { id: 10, name: 'Chelsea', email: null, legacy_id: '9001', import_source: 'zoho' },
        { id: 11, name: 'Em', email: 'email@x.test', legacy_id: null, import_source: null },
        { id: 12, name: 'Name Match', email: null, legacy_id: null, import_source: null },
    ], 'zoho');
    assert.deepEqual(invoices.map(i => i.clientId), [10, 11, 12, null, null]);
    assert.equal(unmatched.length, 1);
    assert.equal(unmatched[0].invoiceCount, 2);
    assert.equal(unmatched[0].legacyId, '777');
});
