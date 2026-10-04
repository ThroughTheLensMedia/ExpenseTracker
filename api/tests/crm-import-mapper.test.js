const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseCsvText } = require('../utils/crmImport/csv');
const { autoMap, finalizeMapping, guessFileType, detectSource, HOLDING, IGNORE } = require('../utils/crmImport/headerMapper');
const { buildClients, findClientDuplicates, mergeFill, composeAddress } = require('../utils/crmImport/contacts');

const FIX = path.join(__dirname, 'fixtures', 'crm-import');
const zohoHeaders = name => fs.readFileSync(path.join(FIX, `zoho-${name}-headers.txt`), 'utf8').trim().split(',');

// Builds a CSV (exact Zoho headers, fake rows) and parses it back through the real parser.
async function zohoCsv(type, rows) {
    const headers = zohoHeaders(type);
    const esc = v => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
    const text = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h] ?? '')).join(','))].join('\n');
    return parseCsvText(text);
}

const contactRow = (over = {}) => ({
    'Display Name': 'Chelsea Harrison', 'Company Name': '', 'First Name': 'Chelsea', 'Last Name': 'Harrison',
    'EmailID': 'chelsea@example.test', 'Phone': '555-0100', 'MobilePhone': '555-0199', 'Contact ID': '9001',
    'Billing Address': '12 Elm St', 'Billing City': 'Las Vegas', 'Billing State': 'NV', 'Billing Code': '89101', 'Billing Country': 'USA',
    'Status': 'Active', 'Currency Code': 'USD', 'Contact Name': 'Chelsea Harrison', 'Notes': 'Wedding client', ...over,
});

// --- CSV parsing ---

test('CSV parser strips BOM, keeps quoted commas, and suffixes repeated headers', async () => {
    const { headers, rows } = await parseCsvText('﻿Name,Notes,Name\n"Doe, Jane","said ""hi""",dup\n');
    assert.deepEqual(headers, ['Name', 'Notes', 'Name (2)']);
    assert.equal(rows[0].Name, 'Doe, Jane');
    assert.equal(rows[0].Notes, 'said "hi"');
    assert.equal(rows[0]['Name (2)'], 'dup');
});

// --- Header mapping: Zoho contacts ---

test('Zoho contacts headers auto-map with no unresolved columns', async () => {
    const { headers, rows } = await zohoCsv('contacts', [contactRow()]);
    const { mapping, unresolved, detectedSource } = autoMap('contacts', headers, rows);
    assert.equal(detectedSource, 'zoho');
    assert.deepEqual(unresolved, []);
    assert.equal(mapping['Display Name'].target, 'name');
    assert.equal(mapping['EmailID'].target, 'email');
    assert.equal(mapping['Phone'].target, 'phone');
    assert.equal(mapping['MobilePhone'].target, 'phone_alt');
    assert.equal(mapping['Billing Address'].target, 'address_line1');
    assert.equal(mapping['Billing City'].target, 'address_city');
    assert.equal(mapping['Billing Code'].target, 'address_zip');
    assert.equal(mapping['Contact ID'].target, 'legacy_id');
    assert.equal(mapping['Company Name'].target, 'company');
    assert.equal(mapping['TaxID'].target, 'tax_id');
    // A second column that also looks like "name" must not overwrite the winner.
    assert.equal(mapping['Contact Name'].target, HOLDING);
    // Populated but homeless Zoho columns are kept, not dropped or prompted.
    assert.equal(mapping['Status'].target, HOLDING);
    assert.equal(mapping['Status'].confidence, 'known');
});

test('blank unknown columns are ignored; populated unknown columns are surfaced with samples', () => {
    const headers = ['Name', 'Email', 'Location', 'Shoe Size', 'Referral Code'];
    const rows = [
        { Name: 'A', Email: 'a@x.test', Location: '', 'Shoe Size': '9', 'Referral Code': 'ZZ1' },
        { Name: 'B', Email: 'b@x.test', Location: '', 'Shoe Size': '11', 'Referral Code': '' },
    ];
    const { mapping, unresolved, detectedSource } = autoMap('contacts', headers, rows);
    assert.equal(detectedSource, 'generic');
    assert.equal(mapping.Location.target, IGNORE);
    assert.equal(mapping.Location.confidence, 'empty');
    assert.deepEqual(unresolved.map(u => u.header).sort(), ['Referral Code', 'Shoe Size']);
    assert.deepEqual(unresolved.find(u => u.header === 'Shoe Size').samples, ['9', '11']);
});

test('tax-ID columns are masked in samples and can never be sent to plaintext holding', () => {
    const rows = [{ Name: 'A', TaxID: '123-45-6789' }];
    const { mapping } = autoMap('contacts', ['Name', 'TaxID'], rows);
    assert.equal(mapping.TaxID.target, 'tax_id');

    const forced = finalizeMapping('contacts', ['Name', 'TaxID'], { Name: 'name', TaxID: HOLDING });
    assert.equal(forced.mapping.TaxID, 'tax_id');
    const ignored = finalizeMapping('invoices', ['Invoice Number', 'Invoice Date', 'Customer Name', 'Total', 'Tax ID'], {
        'Invoice Number': 'invoice_number', 'Invoice Date': 'issue_date', 'Customer Name': 'customer_name', Total: 'total', 'Tax ID': HOLDING,
    });
    assert.equal(ignored.mapping['Tax ID'], IGNORE);
});

test('finalizeMapping rejects duplicate targets, unknown targets, unmapped columns and missing required fields', () => {
    const dup = finalizeMapping('contacts', ['A', 'B'], { A: 'name', B: 'name' });
    assert.ok(dup.errors.some(e => /both mapped/.test(e)));
    const unknown = finalizeMapping('contacts', ['A'], { A: 'banana' });
    assert.ok(unknown.errors.some(e => /unknown field/.test(e)));
    const unmapped = finalizeMapping('contacts', ['A', 'B'], { A: 'name' });
    assert.ok(unmapped.errors.some(e => /no mapping/.test(e)));
    const noName = finalizeMapping('contacts', ['A'], { A: 'email' });
    assert.ok(noName.errors.some(e => /Client name/.test(e)));
    const ok = finalizeMapping('contacts', ['A', 'B'], { A: 'name', B: HOLDING });
    assert.deepEqual(ok.errors, []);
});

test('file type guess catches the wrong file being uploaded', () => {
    assert.equal(guessFileType(zohoHeaders('invoices')), 'invoices');
    assert.equal(guessFileType(zohoHeaders('contacts')), 'contacts');
    assert.equal(guessFileType(zohoHeaders('vendors')), 'vendors');
    assert.equal(guessFileType(zohoHeaders('expenses')), 'expenses');
    assert.equal(guessFileType(['Foo', 'Bar']), null);
    assert.equal(detectSource(['Foo', 'Bar']), 'generic');
});

// --- Contacts → clients ---

test('contacts build into clients with composed address, holding data and name fallbacks', async () => {
    const { headers, rows } = await zohoCsv('contacts', [
        contactRow(),
        contactRow({ 'Display Name': '', 'Company Name': 'Mesa Events', 'First Name': '', 'Last Name': '', EmailID: 'bad-email', 'Contact ID': '9002', Phone: '', MobilePhone: '555-0123', 'Contact Name': '' }),
        contactRow({ 'Display Name': '', 'Company Name': '', 'First Name': 'Pat', 'Last Name': 'Lee', 'Contact ID': '9003' }),
        contactRow({ 'Display Name': '', 'Company Name': '', 'First Name': '', 'Last Name': '', 'Contact ID': '9004', 'Contact Name': '' }),
        {},
    ]);
    const { mapping } = autoMap('contacts', headers, rows);
    const { candidates, errors } = buildClients(rows, finalizeMapping('contacts', headers, Object.fromEntries(Object.entries(mapping).map(([h, m]) => [h, m.target]))).mapping);

    assert.equal(candidates.length, 3);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].row, 4);

    const [chelsea, mesa, pat] = candidates;
    assert.equal(chelsea.record.name, 'Chelsea Harrison');
    assert.equal(chelsea.record.email, 'chelsea@example.test');
    assert.equal(chelsea.record.phone, '555-0100');
    assert.equal(chelsea.record.address, '12 Elm St\nLas Vegas, NV 89101\nUSA');
    assert.equal(chelsea.holding.MobilePhone, '555-0199');
    assert.equal(chelsea.holding.Status, 'Active');
    assert.equal(chelsea.legacyId, '9001');

    assert.equal(mesa.record.name, 'Mesa Events');
    assert.equal(mesa.record.email, null);
    assert.equal(mesa.holding.EmailID, 'bad-email');
    assert.equal(mesa.record.phone, '555-0123');
    assert.equal(mesa.warnings.length, 1);

    assert.equal(pat.record.name, 'Pat Lee');
});

test('tax IDs are carried separately and never appear in holding data', async () => {
    const { headers, rows } = await zohoCsv('contacts', [contactRow({ TaxID: '98-7654321' })]);
    const { mapping } = autoMap('contacts', headers, rows);
    const final = finalizeMapping('contacts', headers, Object.fromEntries(Object.entries(mapping).map(([h, m]) => [h, m.target]))).mapping;
    const { candidates } = buildClients(rows, final);
    assert.equal(candidates[0].taxId, '98-7654321');
    assert.ok(!JSON.stringify(candidates[0].holding).includes('98-7654321'));
});

test('composeAddress skips blanks', () => {
    assert.equal(composeAddress({ address_city: 'Reno', address_state: 'NV' }), 'Reno, NV');
    assert.equal(composeAddress({}), '');
});

// --- Duplicate detection ---

test('client duplicate detection: already-imported skips, email merges, name-only keeps both, in-file repeats skip', () => {
    const existing = [
        { id: 1, name: 'Ann Smith', email: 'ann@x.test', legacy_id: null, import_source: null },
        { id: 2, name: 'Bob Jones', email: null, legacy_id: null, import_source: null },
        { id: 3, name: 'Old Import', email: null, legacy_id: '77', import_source: 'zoho' },
    ];
    const c = (name, email, legacyId) => ({ record: { name, email }, legacyId });
    const cands = [
        c('Annie S', 'ANN@x.test', null),     // email match (case-insensitive)
        c('bob  jones', null, null),           // name-only match
        c('Whoever', null, '77'),              // same ID from same system
        c('Fresh Face', 'f@x.test', '5'),      // new
        c('Fresh Face', 'f@x.test', '6'),      // repeated in file
    ];
    findClientDuplicates(cands, existing, 'zoho');
    assert.deepEqual(cands.map(x => x.dup && [x.dup.kind, x.dup.defaultDecision]), [
        ['email', 'merge'], ['name', 'keep_both'], ['already_imported', 'skip'], null, ['in_file', 'skip'],
    ]);
    assert.equal(cands[0].dup.existingId, 1);
});

test('legacy IDs from a different system never count as already imported', () => {
    const cands = [{ record: { name: 'X', email: null }, legacyId: '77' }];
    findClientDuplicates(cands, [{ id: 3, name: 'Other', email: null, legacy_id: '77', import_source: 'zoho' }], 'generic');
    assert.equal(cands[0].dup, null);
});

test('mergeFill only fills empty fields and never overwrites existing data', () => {
    const updates = mergeFill(
        { email: 'keep@x.test', phone: '', address: null, notes: 'mine' },
        { email: 'new@x.test', phone: '555', address: '1 Main', notes: 'theirs' },
    );
    assert.deepEqual(updates, { phone: '555', address: '1 Main' });
});
