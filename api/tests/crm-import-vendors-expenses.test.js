const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseCsvText } = require('../utils/crmImport/csv');
const { autoMap, finalizeMapping, IGNORE, HOLDING } = require('../utils/crmImport/headerMapper');
const { buildClients, findClientDuplicates, mergeFill } = require('../utils/crmImport/contacts');
const { buildExpenses, applyRules, findExpenseDuplicates, mergeExpenseFill, mapCategory } = require('../utils/crmImport/expenses');

const FIX = path.join(__dirname, 'fixtures', 'crm-import');
const headersOf = n => fs.readFileSync(path.join(FIX, `zoho-${n}-headers.txt`), 'utf8').trim().split(',');

async function load(type, rows) {
    const headers = headersOf(type);
    const esc = v => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
    const text = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h] ?? '')).join(','))].join('\n');
    const parsed = await parseCsvText(text);
    const { mapping, unresolved, detectedSource } = autoMap(type, parsed.headers, parsed.rows);
    const final = finalizeMapping(type, parsed.headers, Object.fromEntries(Object.entries(mapping).map(([h, m]) => [h, m.target])));
    assert.deepEqual(final.errors, []);
    return { ...parsed, mapping: final.mapping, auto: mapping, unresolved, detectedSource };
}

// --- Vendors ---

const vendorRow = (over = {}) => ({
    'Contact ID': 'v100', 'Contact Name': 'Pat Owner', 'Company Name': 'Mesa Print Shop', 'Display Name': 'Mesa Print Shop',
    EmailID: 'orders@mesa.test', Phone: '555-0111', Website: 'https://mesa.test', Status: 'Active',
    'Track 1099 Payments': 'true', TINType: 'EIN', TIN: '12-3456789', 'Billing Address': '5 Press Way', 'Billing City': 'Reno', 'Billing State': 'NV', 'Billing Code': '89501', ...over,
});

test('Zoho vendor headers map cleanly, including website, 1099 and the encrypted TIN', async () => {
    const { auto, unresolved, detectedSource } = await load('vendors', [vendorRow()]);
    assert.equal(detectedSource, 'zoho');
    assert.deepEqual(unresolved, []);
    assert.equal(auto['Display Name'].target, 'name');
    assert.equal(auto['Company Name'].target, 'company');
    assert.equal(auto['Website'].target, 'website');
    assert.equal(auto['Track 1099 Payments'].target, 'track_1099');
    assert.equal(auto['TINType'].target, 'tin_type');
    assert.equal(auto['TIN'].target, 'tax_id');
    assert.equal(auto['TIN'].confidence, 'sensitive');
    assert.equal(auto['Contact ID'].target, 'legacy_id');
    assert.equal(auto['EmailID'].target, 'email');
});

test('vendors build with website, 1099 flag and TIN kept out of holding data', async () => {
    const { rows, mapping } = await load('vendors', [vendorRow(), vendorRow({ 'Display Name': '', 'Company Name': '', 'Contact Name': '', 'Contact ID': 'v101' })]);
    const { candidates, errors } = buildClients(rows, mapping, 'vendors');
    assert.equal(candidates.length, 1);
    assert.match(errors[0].error, /vendor name/);
    const v = candidates[0];
    assert.equal(v.record.name, 'Mesa Print Shop');
    assert.equal(v.record.website, 'https://mesa.test');
    assert.equal(v.record.track_1099, true);
    assert.equal(v.taxId, '12-3456789');
    assert.equal(v.tinType, 'EIN');
    assert.equal(v.record.address, '5 Press Way\nReno, NV 89501');
    assert.ok(!JSON.stringify(v.holding).includes('12-3456789'));
    assert.equal(v.holding['Contact Name'], 'Pat Owner');
});

test('contacts records never gain vendor-only fields', async () => {
    const { rows, mapping } = await load('vendors', [vendorRow()]);
    const { candidates } = buildClients(rows, mapping); // default kind = contacts
    assert.ok(!('website' in candidates[0].record));
    assert.ok(!('track_1099' in candidates[0].record));
});

test('vendor duplicates: name match merges (names are unique per user) and in-file repeats skip', () => {
    const existing = [{ id: 1, name: 'Mesa Print Shop', email: null, website: null, legacy_id: null, import_source: null }];
    const cands = [
        { record: { name: 'mesa  print shop', email: null }, legacyId: null },
        { record: { name: 'Fresh Vendor', email: null }, legacyId: null },
        { record: { name: 'Fresh Vendor', email: null }, legacyId: null },
    ];
    findClientDuplicates(cands, existing, 'zoho', 'vendors');
    assert.deepEqual(cands.map(c => c.dup && [c.dup.kind, c.dup.defaultDecision]), [['name', 'merge'], null, ['in_file', 'skip']]);
    assert.deepEqual(mergeFill({ website: null, email: 'keep@x.test' }, { website: 'https://a.test', email: 'new@x.test' }), { website: 'https://a.test' });
});

// --- Expenses ---

const expRow = (over = {}) => ({
    'Expense Date': '2026-02-10', 'Expense Description': 'Lens cleaning kit', 'Expense Account': 'Office Supplies', 'Paid Through': 'Chase Checking',
    Vendor: 'B&H Photo', 'Currency Code': 'USD', 'Expense Amount': '40.00', 'Tax Amount': '3.20', Total: '43.20', 'Expense Reference ID': 'e1', 'Reference#': 'R-77', ...over,
});

test('Zoho expense headers map with no prompts; mileage and notes land on the right targets', async () => {
    const { auto, unresolved, detectedSource } = await load('expenses', [expRow()]);
    assert.equal(detectedSource, 'zoho');
    assert.deepEqual(unresolved, []);
    const t = h => auto[h].target;
    assert.equal(t('Expense Date'), 'expense_date');
    assert.equal(t('Expense Description'), 'description');
    assert.equal(t('Expense Account'), 'category');
    assert.equal(t('Paid Through'), 'paid_through');
    assert.equal(t('Vendor'), 'vendor');
    assert.equal(t('Total'), 'total');
    assert.equal(t('Expense Amount'), 'amount');
    assert.equal(t('Distance'), 'distance');
    assert.equal(t('Expense Reference ID'), 'legacy_id');
    assert.equal(t('Reference#'), HOLDING);
    assert.equal(t('Paid Through Account Code'), IGNORE); // blank column
});

test('expenses build with category mapping, deductible defaults, source account and held-back originals', async () => {
    const { rows, mapping } = await load('expenses', [
        expRow(),
        expRow({ 'Expense Account': 'Fuel/Mileage Expenses', Vendor: 'Shell', 'Expense Amount': '60.00', 'Tax Amount': '', Total: '', 'Expense Reference ID': 'e2' }),
        expRow({ 'Expense Account': 'Bank Charges', Vendor: '', 'Expense Description': 'Monthly bank fee', Total: '12.00', 'Expense Reference ID': 'e3' }),
        expRow({ 'Expense Account': 'Meals and Entertainment', Total: '30.00', 'Expense Reference ID': 'e4' }),
    ]);
    const out = buildExpenses(rows, mapping, { markDeductible: true, sourceSystem: 'zoho' });
    assert.deepEqual(out.errors, []);
    const [office, fuel, bank, meals] = out.expenses.map(e => e.record);

    assert.equal(office.amount_cents, 4320);
    assert.equal(office.category, 'Office Supplies');
    assert.equal(office.tax_bucket, 'Office expense');
    assert.equal(office.tax_deductible, true);
    assert.equal(office.source, 'Chase Checking');
    assert.equal(office.notes, 'Lens cleaning kit');
    assert.equal(office.legacy_id, 'e1');
    assert.ok(!('rm_id' in office), 'never touches the globally-unique rm_id');

    assert.equal(fuel.amount_cents, 6000);           // no Total: amount + tax
    assert.equal(fuel.category, 'Gas & Fuel');
    assert.equal(out.expenses[1].holding['Expense Account'], 'Fuel/Mileage Expenses');

    assert.equal(bank.category, 'Bank Charges');     // unknown accounts keep the user's own label
    assert.equal(bank.tax_bucket, '');
    assert.equal(bank.tax_deductible, false);        // unknown bucket → user decides
    assert.equal(bank.vendor, 'Monthly bank fee');   // falls back to the description

    assert.equal(meals.category, 'Dining & Drinks');
    assert.equal(meals.business_use_pct, 50);
    assert.equal(out.categoryMap.get('Bank Charges').category, 'Bank Charges');
    assert.equal(out.expenses[0].holding['Reference#'], 'R-77');
});

test('markDeductible off leaves every expense non-deductible', async () => {
    const { rows, mapping } = await load('expenses', [expRow()]);
    const out = buildExpenses(rows, mapping, { markDeductible: false, sourceSystem: 'zoho' });
    assert.equal(out.expenses[0].record.tax_deductible, false);
    assert.equal(out.expenses[0].record.tax_bucket, 'Office expense'); // bucket is still suggested
});

test('mileage rows become mileage log entries, not dollar expenses (km converted)', async () => {
    const { rows, mapping } = await load('expenses', [
        expRow({ 'Expense Description': 'Client shoot', Distance: '20', 'Mileage Unit': 'mile', 'Vehicle Name': 'Van', 'Start Odometer Reading': '1000', 'End Odometer Reading': '1020', 'Expense Amount': '14.00', Total: '14.00' }),
        expRow({ 'Expense Description': 'Airport run', Distance: '10', 'Mileage Unit': 'km', 'Expense Amount': '4.00', Total: '4.00' }),
    ]);
    const out = buildExpenses(rows, mapping, { sourceSystem: 'zoho' });
    assert.equal(out.expenses.length, 0);
    assert.equal(out.mileage.length, 2);
    assert.equal(out.mileage[0].record.miles, 20);
    assert.equal(out.mileage[0].record.purpose, 'Client shoot');
    assert.equal(out.mileage[0].record.source, 'zoho_import');
    assert.match(out.mileage[0].record.notes, /Vehicle: Van · Odometer 1000–1020/);
    assert.equal(out.mileage[1].record.miles, 6.21);
});

test('invalid expense rows are reported without blocking valid ones', async () => {
    const { rows, mapping } = await load('expenses', [
        expRow({ 'Expense Reference ID': 'ok' }),
        expRow({ 'Expense Date': 'whenever' }),
        expRow({ 'Currency Code': 'EUR' }),
        expRow({ Total: '', 'Expense Amount': '' }),
        expRow({ Total: '0.00' }),
    ]);
    const out = buildExpenses(rows, mapping, { sourceSystem: 'zoho' });
    assert.equal(out.expenses.length, 1);
    assert.equal(out.errors.length, 4);
    assert.ok(out.errors.some(e => /date/i.test(e.error)));
    assert.ok(out.errors.some(e => /EUR/.test(e.error)));
    assert.ok(out.errors.some(e => /amount/i.test(e.error)));
    assert.ok(out.errors.some(e => /\$0\.00/.test(e.error)));
});

test('category mapping covers common accounting names and preserves unknown ones', () => {
    assert.equal(mapCategory('Automobile Expense').category, 'Auto & Transport');
    assert.equal(mapCategory('Advertising And Marketing').category, 'Advertising');
    assert.equal(mapCategory('Telephone Expense').category, 'Bills & Utilities');
    assert.equal(mapCategory('Rent Expense').category, 'Rent / Lease');
    assert.equal(mapCategory('Dues and Subscriptions').category, 'Subscriptions');
    assert.equal(mapCategory('gas & fuel').category, 'Gas & Fuel');
    assert.deepEqual(mapCategory('Gas & Fuel'), { category: 'Gas & Fuel', mapped: false });
    assert.deepEqual(mapCategory('Payroll'), { category: 'Payroll', mapped: false });
    assert.deepEqual(mapCategory(''), { category: 'Uncategorized', mapped: false });
});

test('user classification rules override defaults, first match wins (same semantics as the bank import)', () => {
    const rec = { vendor: 'Adobe Systems', notes: '', category: 'Uncategorized', tax_bucket: '', tax_deductible: false, business_use_pct: 100 };
    applyRules(rec, [
        { match_column: 'vendor', match_type: 'contains', match_value: 'adobe', assign_category: 'Software & Tech', assign_tax_bucket: 'Office expense', assign_tax_deductible: true, assign_business_use_pct: 80 },
        { match_column: 'vendor', match_type: 'contains', match_value: 'adobe', assign_category: 'Other' },
    ]);
    assert.deepEqual([rec.category, rec.tax_bucket, rec.tax_deductible, rec.business_use_pct], ['Software & Tech', 'Office expense', true, 80]);
    const untouched = { vendor: 'Shell', notes: '', category: 'X', tax_deductible: true };
    applyRules(untouched, [{ match_column: 'vendor', match_type: 'exact', match_value: 'adobe' }]);
    assert.equal(untouched.category, 'X');
});

test('expense duplicates: exact skips (counted), similar bank rows merge, genuine repeats still import', () => {
    const mk = (date, vendor, cents, extra = {}) => ({ record: { expense_date: date, vendor, amount_cents: cents, category: 'Office Supplies', notes: 'n', tax_bucket: 'Office expense', tax_deductible: true, business_use_pct: 100, legacy_id: null, ...extra } });
    const existing = [
        { id: 1, expense_date: '2026-02-10', vendor: 'B&H Photo', amount_cents: 4320, source: 'Chase', category: 'Uncategorized', notes: '', tax_bucket: '', legacy_id: null, import_source: null },
        { id: 2, expense_date: '2026-03-01', vendor: 'AMZN MKTP US*123', amount_cents: 2500, source: 'Chase', category: 'Shopping', notes: 'mine', tax_bucket: 'Supplies', legacy_id: null, import_source: null },
        { id: 3, expense_date: '2026-04-01', vendor: 'Coffee', amount_cents: 500, source: 'Cash', category: 'Dining & Drinks', notes: '', tax_bucket: '', legacy_id: 'zz', import_source: 'zoho' },
    ];
    const list = [
        mk('2026-02-10', 'B&H Photo', 4320),                 // exact → skip
        mk('2026-02-10', 'B&H Photo', 4320),                 // second identical purchase, only one exists → imports
        mk('2026-03-02', 'Amazon', 2500),                    // same amount, 1 day apart → similar
        mk('2026-04-01', 'Coffee', 500, { legacy_id: 'zz' }), // same ID from same system
        mk('2026-05-05', 'New thing', 999),
    ];
    findExpenseDuplicates(list, existing, 'zoho');
    assert.deepEqual(list.map(e => e.dup && [e.dup.kind, e.dup.defaultDecision, e.dup.existingId]), [
        ['exact', 'skip', 1], null, ['similar', 'merge', 2], ['already_imported', 'skip', 3], null,
    ]);
});

test('merging into an existing expense only fills blanks', () => {
    const rec = { category: 'Office Supplies', notes: 'Lens kit', tax_bucket: 'Office expense', tax_deductible: true, business_use_pct: 100 };
    assert.deepEqual(mergeExpenseFill({ category: 'Uncategorized', notes: '', tax_bucket: '' }, rec),
        { category: 'Office Supplies', notes: 'Lens kit', tax_bucket: 'Office expense', tax_deductible: true, business_use_pct: 100 });
    assert.deepEqual(mergeExpenseFill({ category: 'Shopping', notes: 'mine', tax_bucket: 'Supplies' }, rec), {});
});
