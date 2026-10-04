const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');

process.env.ENCRYPTION_KEY = '0'.repeat(64);

const router = require('../routes/crmImport');
const { decrypt } = require('../utils/cryptoUtil');

// ---- Minimal in-memory stand-in for the Supabase client (only what the route uses) ----
function makeDb() {
    const tables = { clients: [], invoices: [], invoice_items: [], import_batches: [], import_holding: [], client_tax_ids: [], settings: [], vendors: [], vendor_tax_ids: [], expenses: [], mileage_logs: [], classification_rules: [] };
    let seq = 100;
    let failInsertOn = null;
    const uuid = () => `batch-${++seq}`;

    function builder(table) {
        const q = { op: 'select', filters: [], rows: null, payload: null, opts: {}, returning: false, range: null, head: false, wantCount: false };
        const api = {
            select(_cols, opts = {}) { if (q.op !== 'select') q.returning = true; if (opts.head) q.head = true; if (opts.count) q.wantCount = true; return api; },
            insert(rows) { q.op = 'insert'; q.rows = Array.isArray(rows) ? rows : [rows]; return api; },
            update(payload) { q.op = 'update'; q.payload = payload; return api; },
            delete() { q.op = 'delete'; return api; },
            upsert(rows, opts = {}) { q.op = 'upsert'; q.rows = Array.isArray(rows) ? rows : [rows]; q.opts = opts; return api; },
            eq(col, val) { q.filters.push(r => String(r[col]) === String(val)); return api; },
            in(col, vals) { q.filters.push(r => vals.map(String).includes(String(r[col]))); return api; },
            gte(col, val) { q.filters.push(r => String(r[col]) >= String(val)); return api; },
            lte(col, val) { q.filters.push(r => String(r[col]) <= String(val)); return api; },
            order() { return api; },
            range(a, b) { q.range = [a, b]; return api; },
            maybeSingle() { q.single = 'maybe'; return api; },
            single() { q.single = 'one'; return api; },
            then(resolve, reject) { try { resolve(run()); } catch (e) { reject(e); } },
        };

        function run() {
            const rows = tables[table];
            const matches = () => rows.filter(r => q.filters.every(f => f(r)));
            const shape = data => {
                if (q.single) return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
                return { data, error: null };
            };
            if (q.op === 'select') {
                let out = matches();
                const count = out.length;
                if (q.range) out = out.slice(q.range[0], q.range[1] + 1);
                if (q.head) return { data: null, error: null, count };
                const res = shape(out.map(r => ({ ...r })));
                if (q.wantCount) res.count = count;
                return res;
            }
            if (q.op === 'insert') {
                if (failInsertOn === table) return { data: null, error: { message: `forced failure inserting into ${table}` } };
                const created = q.rows.map(r => {
                    const row = { ...r };
                    if (row.id === undefined) row.id = table === 'import_batches' || table === 'import_holding' ? uuid() : ++seq;
                    rows.push(row);
                    return { ...row };
                });
                return shape(q.returning || q.single ? created : null);
            }
            if (q.op === 'update') {
                const hit = matches();
                hit.forEach(r => Object.assign(r, q.payload));
                return shape(q.returning ? hit.map(r => ({ ...r })) : null);
            }
            if (q.op === 'delete') {
                const hit = new Set(matches());
                tables[table] = rows.filter(r => !hit.has(r));
                if (table === 'invoices') { const ids = new Set([...hit].map(r => r.id)); tables.invoice_items = tables.invoice_items.filter(i => !ids.has(i.invoice_id)); }
                if (table === 'vendors') {
                    const ids = new Set([...hit].map(r => r.id));
                    tables.vendor_tax_ids = tables.vendor_tax_ids.filter(t => !ids.has(t.vendor_id));
                }
                if (table === 'clients') {
                    const ids = new Set([...hit].map(r => r.id));
                    tables.client_tax_ids = tables.client_tax_ids.filter(t => !ids.has(t.client_id));
                    tables.invoices.forEach(i => { if (ids.has(i.client_id)) i.client_id = null; });
                }
                return { data: null, error: null };
            }
            if (q.op === 'upsert') {
                const keys = String(q.opts.onConflict || 'id').split(',');
                for (const r of q.rows) {
                    const existing = rows.find(x => keys.every(k => String(x[k]) === String(r[k])));
                    if (existing) { if (!q.opts.ignoreDuplicates) Object.assign(existing, r); }
                    else rows.push({ id: r.id ?? uuid(), ...r });
                }
                return { data: null, error: null };
            }
            throw new Error(`unsupported op ${q.op}`);
        }
        return api;
    }
    return { tables, from: builder, failInsertOn: t => { failInsertOn = t; } };
}

let db;
let server;
let base;
test.before(async () => {
    db = makeDb();
    const app = express();
    app.use((req, _res, next) => { req.sb = db; req.user = { id: 'u1' }; next(); });
    app.use('/crm-import', router);
    server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}/crm-import`;
});
test.after(() => server.close());

const FIX = path.join(__dirname, 'fixtures', 'crm-import');
const headersOf = n => fs.readFileSync(path.join(FIX, `zoho-${n}-headers.txt`), 'utf8').trim().split(',');
function csv(type, rows) {
    const headers = headersOf(type);
    const esc = v => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
    return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h] ?? '')).join(','))].join('\n');
}
async function post(endpoint, fields, file) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    if (file) form.append('file', new Blob([file.text], { type: 'text/csv' }), file.name || 'export.csv');
    const res = await fetch(`${base}${endpoint}`, { method: 'POST', body: form });
    return { status: res.status, body: await res.json() };
}
const autoMapping = analysis => Object.fromEntries(Object.entries(analysis.mapping).map(([h, m]) => [h, m.target]));
async function analyzeAndMap(type, text) {
    const a = await post('/analyze', { type }, { text });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    return { analysis: a.body, mapping: autoMapping(a.body) };
}

const contact = (over = {}) => ({ 'Display Name': 'Chelsea Harrison', EmailID: 'chelsea@example.test', Phone: '555-0100', 'Contact ID': '9001', 'Billing City': 'Las Vegas', 'Billing State': 'NV', Status: 'Active', TaxID: '12-3456789', ...over });
const inv = (over = {}) => ({
    'Invoice Number': 'INV-1', 'Invoice ID': 'z1', 'Invoice Date': '2026-03-01', 'Due Date': '2026-03-15', 'Invoice Status': 'Paid',
    'Customer ID': '9001', 'Customer Name': 'Chelsea Harrison', 'Currency Code': 'USD', 'Item Name': 'Session', Quantity: '1',
    'Item Price': '500.00', Total: '500.00', Balance: '0.00', ...over,
});

test('analyze proposes a mapping, detects Zoho, and warns on the wrong file type', async () => {
    const text = csv('contacts', [contact()]);
    const { analysis } = await analyzeAndMap('contacts', text);
    assert.equal(analysis.detectedSource, 'zoho');
    assert.equal(analysis.rowCount, 1);
    assert.deepEqual(analysis.unresolved, []);
    assert.equal(analysis.aiAvailable, false);
    assert.equal(analysis.typeWarning, null);

    const wrong = await post('/analyze', { type: 'contacts' }, { text: csv('invoices', [inv()]) });
    assert.match(wrong.body.typeWarning, /invoices file/);

    const headerOnly = await post('/analyze', { type: 'contacts' }, { text: headersOf('contacts').join(',') });
    assert.equal(headerOnly.status, 400);
});

test('preview writes nothing', async () => {
    const text = csv('contacts', [contact(), contact({ 'Display Name': 'Pat Lee', EmailID: 'pat@x.test', 'Contact ID': '9002' })]);
    const { analysis, mapping } = await analyzeAndMap('contacts', text);
    const p = await post('/preview', { type: 'contacts', sourceSystem: analysis.detectedSource, mapping }, { text });
    assert.equal(p.status, 200);
    assert.equal(p.body.summary.newCount, 2);
    assert.equal(p.body.summary.withTaxId, 2);
    assert.equal(db.tables.clients.length, 0);
    assert.equal(db.tables.import_batches.length, 0);
});

test('contacts commit: creates clients, holding data and an encrypted tax ID; re-import skips everything', async () => {
    const text = csv('contacts', [contact(), contact({ 'Display Name': 'Pat Lee', EmailID: 'pat@x.test', 'Contact ID': '9002', TaxID: '' })]);
    const { mapping } = await analyzeAndMap('contacts', text);
    const c = await post('/commit', { type: 'contacts', sourceSystem: 'zoho', mapping }, { text, name: 'contacts.csv' });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(c.body.created, 2);

    const chelsea = db.tables.clients.find(x => x.name === 'Chelsea Harrison');
    assert.equal(chelsea.user_id, 'u1');
    assert.equal(chelsea.legacy_id, '9001');
    assert.equal(chelsea.import_source, 'zoho');
    assert.equal(chelsea.import_batch_id, c.body.batchId);
    assert.equal(chelsea.address, 'Las Vegas, NV');

    const holding = db.tables.import_holding.find(h => h.entity_id === String(chelsea.id));
    assert.equal(holding.data.Status, 'Active');
    assert.ok(!JSON.stringify(db.tables.import_holding).includes('12-3456789'));

    assert.equal(db.tables.client_tax_ids.length, 1);
    const taxRow = db.tables.client_tax_ids[0];
    assert.equal(taxRow.last4, '6789');
    assert.notEqual(taxRow.tax_id_encrypted, '12-3456789');
    assert.equal(await decrypt(taxRow.tax_id_encrypted), '12-3456789');

    const again = await post('/commit', { type: 'contacts', sourceSystem: 'zoho', mapping }, { text, name: 'contacts.csv' });
    assert.equal(again.body.created, 0);
    assert.equal(again.body.skipped, 2);
    assert.equal(db.tables.clients.length, 2);
});

test('invoices commit: blocked without clients unless allowed; creates items, holding and the open flag', async () => {
    db.tables.clients.length = 0;
    db.tables.import_batches.length = 0;
    const text = csv('invoices', [
        inv(),
        inv({ 'Invoice Number': 'INV-2', 'Invoice ID': 'z2', 'Invoice Status': 'Overdue', Balance: '500.00', 'Sales person': 'Dana' }),
        inv({ 'Invoice Number': 'INV-3', 'Invoice ID': 'z3', 'Invoice Status': 'Partially Paid', Balance: '200.00' }),
        inv({ 'Invoice Number': 'INV-3', 'Invoice ID': 'z3', 'Invoice Status': 'Partially Paid', Balance: '200.00', 'Item Name': 'Prints', 'Item Price': '0.00' }),
    ]);
    const { mapping } = await analyzeAndMap('invoices', text);

    const preview = await post('/preview', { type: 'invoices', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(preview.body.summary.newCount, 3);
    assert.equal(preview.body.summary.openCount, 2);
    assert.equal(preview.body.summary.openBalanceCents, 70000);
    assert.equal(preview.body.summary.partialCount, 1);
    assert.equal(preview.body.unmatchedCount, 1);

    const blocked = await post('/commit', { type: 'invoices', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(blocked.body.created, 0);
    assert.equal(blocked.body.errorCount, 3);
    assert.equal(db.tables.invoices.length, 0);

    const ok = await post('/commit', { type: 'invoices', sourceSystem: 'zoho', mapping, createMissingClients: 'true' }, { text, name: 'invoices.csv' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.created, 3);
    assert.equal(ok.body.clientsCreated, 1);
    assert.equal(ok.body.openCount, 2);
    assert.equal(ok.body.openBalanceCents, 70000);
    assert.equal(db.tables.clients.length, 1);

    const byNumber = n => db.tables.invoices.find(i => i.invoice_number === n);
    assert.equal(byNumber('INV-1').legacy_open, false);
    assert.equal(byNumber('INV-2').legacy_open, true);
    assert.equal(byNumber('INV-2').legacy_balance_cents, 50000);
    assert.equal(byNumber('INV-2').photographer_signed, true);
    assert.equal(byNumber('INV-2').client_id, db.tables.clients[0].id);
    assert.equal(byNumber('INV-3').legacy_balance_cents, 20000);

    const items = id => db.tables.invoice_items.filter(i => i.invoice_id === id);
    assert.ok(items(byNumber('INV-3').id).some(i => i.description === 'Payments received before import'));
    assert.ok(items(byNumber('INV-1').id).every(i => i.user_id === 'u1'));
    assert.equal(db.tables.import_holding.find(h => h.entity_id === String(byNumber('INV-2').id)).data['Sales person'], 'Dana');

    const summary = await (await fetch(`${base}/legacy-summary`)).json();
    assert.deepEqual(summary, { count: 2, balanceCents: 70000 });

    // The user clears the flag when they've closed it out in the old system.
    const cleared = await post(`/invoices/${byNumber('INV-2').id}/close-legacy`, {});
    assert.equal(cleared.status, 200);
    assert.equal(byNumber('INV-2').legacy_open, false);
    assert.equal((await post(`/invoices/${byNumber('INV-2').id}/close-legacy`, {})).status, 404);
});

test('re-importing the same invoices skips them; renumber keeps both', async () => {
    const text = csv('invoices', [inv({ 'Invoice Number': 'INV-1', 'Invoice ID': 'zNEW' })]);
    const { mapping } = await analyzeAndMap('invoices', text);
    const before = db.tables.invoices.length;
    const dupe = await post('/commit', { type: 'invoices', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(dupe.body.created, 0);
    assert.equal(dupe.body.skipped, 1);

    const renum = await post('/commit', { type: 'invoices', sourceSystem: 'zoho', mapping, decisions: { 'INV-1': 'renumber' } }, { text });
    assert.equal(renum.body.created, 1);
    assert.equal(db.tables.invoices.length, before + 1);
    assert.ok(db.tables.invoices.some(i => i.invoice_number === 'INV-1-imported'));
});

test('undo removes the batch; contacts undo is refused while invoices still use those clients', async () => {
    // Start fresh: contacts, then invoices that use them.
    db.tables.clients.length = 0; db.tables.invoices.length = 0; db.tables.invoice_items.length = 0;
    db.tables.import_holding.length = 0; db.tables.import_batches.length = 0; db.tables.client_tax_ids.length = 0;

    const cText = csv('contacts', [contact()]);
    const cm = (await analyzeAndMap('contacts', cText)).mapping;
    const contacts = await post('/commit', { type: 'contacts', sourceSystem: 'zoho', mapping: cm }, { text: cText });
    const iText = csv('invoices', [inv()]);
    const im = (await analyzeAndMap('invoices', iText)).mapping;
    const invoices = await post('/commit', { type: 'invoices', sourceSystem: 'zoho', mapping: im }, { text: iText });
    assert.equal(invoices.body.created, 1);
    assert.equal(invoices.body.clientsCreated, 0, 'linked to the imported client by old-system ID');

    const blocked = await fetch(`${base}/batches/${contacts.body.batchId}`, { method: 'DELETE' });
    assert.equal(blocked.status, 409);
    assert.equal(db.tables.clients.length, 1);

    const undoInvoices = await fetch(`${base}/batches/${invoices.body.batchId}`, { method: 'DELETE' });
    assert.equal(undoInvoices.status, 200);
    assert.equal(db.tables.invoices.length, 0);
    assert.equal(db.tables.invoice_items.length, 0);

    const undoContacts = await fetch(`${base}/batches/${contacts.body.batchId}`, { method: 'DELETE' });
    assert.equal(undoContacts.status, 200);
    assert.equal(db.tables.clients.length, 0);
    assert.equal(db.tables.client_tax_ids.length, 0);
    assert.equal(db.tables.import_holding.length, 0);

    const twice = await fetch(`${base}/batches/${contacts.body.batchId}`, { method: 'DELETE' });
    assert.equal(twice.status, 409);
});

test('a failure partway through rolls back everything that file created', async () => {
    db.tables.clients.length = 0; db.tables.invoices.length = 0; db.tables.invoice_items.length = 0;
    db.tables.import_holding.length = 0; db.tables.import_batches.length = 0;

    const text = csv('invoices', [inv()]);
    const { mapping } = await analyzeAndMap('invoices', text);
    db.failInsertOn('invoices');
    const res = await post('/commit', { type: 'invoices', sourceSystem: 'zoho', mapping, createMissingClients: 'true' }, { text });
    db.failInsertOn(null);
    assert.equal(res.status, 500);
    assert.match(res.body.error, /rolled back/);
    assert.equal(db.tables.clients.length, 0, 'auto-created client removed');
    assert.equal(db.tables.import_batches.length, 0);
});

test('merging a duplicate contact only fills blanks and keeps the existing record', async () => {
    db.tables.clients.length = 0; db.tables.import_holding.length = 0; db.tables.import_batches.length = 0;
    db.tables.clients.push({ id: 1, user_id: 'u1', name: 'Chelsea H', email: 'chelsea@example.test', phone: null, address: null, notes: 'my notes', legacy_id: null, import_source: null });

    const text = csv('contacts', [contact({ Notes: 'their notes', Phone: '555-0100', TaxID: '' })]);
    const { mapping } = await analyzeAndMap('contacts', text);
    const preview = await post('/preview', { type: 'contacts', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(preview.body.duplicates[0].kind, 'email');
    assert.equal(preview.body.duplicates[0].defaultDecision, 'merge');

    const c = await post('/commit', { type: 'contacts', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(c.body.merged, 1);
    assert.equal(db.tables.clients.length, 1);
    const row = db.tables.clients[0];
    assert.equal(row.name, 'Chelsea H');
    assert.equal(row.notes, 'my notes');
    assert.equal(row.phone, '555-0100');
    assert.equal(row.legacy_id, '9001');
});

test('invalid requests are rejected without touching data', async () => {
    const text = csv('contacts', [contact()]);
    const { mapping } = await analyzeAndMap('contacts', text);
    const bad = await post('/commit', { type: 'contacts', sourceSystem: 'zoho', mapping: { ...mapping, 'Display Name': 'banana' } }, { text });
    assert.equal(bad.status, 400);
    const dupTarget = await post('/commit', { type: 'contacts', sourceSystem: 'zoho', mapping: { ...mapping, 'Contact Name': 'name' } }, { text });
    assert.equal(dupTarget.status, 400);
    const noFile = await post('/commit', { type: 'contacts', mapping });
    assert.equal(noFile.status, 400);
    const unsupported = await post('/analyze', { type: 'banana' }, { text });
    assert.equal(unsupported.status, 400);
});

// ---------------------------------------------------------------------------------------------
// Release 2 — vendors + expenses
// ---------------------------------------------------------------------------------------------

function resetAll() {
    for (const t of Object.keys(db.tables)) db.tables[t].length = 0;
}
const vendor = (over = {}) => ({
    'Contact ID': 'v100', 'Display Name': 'Mesa Print Shop', 'Company Name': 'Mesa Print Shop', 'Contact Name': 'Pat Owner',
    EmailID: 'orders@mesa.test', Website: 'https://mesa.test', 'Track 1099 Payments': 'true', TINType: 'EIN', TIN: '12-3456789', Status: 'Active', ...over,
});
const expense = (over = {}) => ({
    'Expense Date': '2026-02-10', 'Expense Description': 'Lens cleaning kit', 'Expense Account': 'Office Supplies', 'Paid Through': 'Chase Checking',
    Vendor: 'B&H Photo', 'Currency Code': 'USD', 'Expense Amount': '40.00', 'Tax Amount': '3.20', Total: '43.20', 'Expense Reference ID': 'e1', ...over,
});

test('vendors commit: unique names, encrypted TIN with type, holding data, masked directory, undo', async () => {
    resetAll();
    const text = csv('vendors', [vendor(), vendor({ 'Display Name': 'Other Co', 'Company Name': 'Other Co', 'Contact ID': 'v101', EmailID: 'hello@other.test', TIN: '', 'Track 1099 Payments': 'false' })]);
    const { analysis, mapping } = await analyzeAndMap('vendors', text);
    assert.equal(analysis.unresolved.length, 0);

    const preview = await post('/preview', { type: 'vendors', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(preview.body.type, 'vendors');
    assert.equal(preview.body.summary.newCount, 2);
    assert.equal(preview.body.summary.withTaxId, 1);
    assert.equal(db.tables.vendors.length, 0);

    const c = await post('/commit', { type: 'vendors', sourceSystem: 'zoho', mapping }, { text, name: 'vendors.csv' });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(c.body.created, 2);

    const mesa = db.tables.vendors.find(v => v.name === 'Mesa Print Shop');
    assert.deepEqual([mesa.user_id, mesa.website, mesa.track_1099, mesa.legacy_id, mesa.import_source], ['u1', 'https://mesa.test', true, 'v100', 'zoho']);
    assert.equal(db.tables.vendors.find(v => v.name === 'Other Co').track_1099, false);

    const tax = db.tables.vendor_tax_ids[0];
    assert.deepEqual([tax.vendor_id, tax.last4, tax.tin_type], [mesa.id, '6789', 'EIN']);
    assert.equal(await decrypt(tax.tax_id_encrypted), '12-3456789');
    assert.ok(!JSON.stringify(db.tables.import_holding).includes('12-3456789'));
    assert.equal(db.tables.import_holding.find(h => h.entity_type === 'vendor' && h.entity_id === String(mesa.id)).data['Contact Name'], 'Pat Owner');

    const dir = await (await fetch(`${base}/vendors`)).json();
    assert.equal(dir.data.length, 2);
    const row = dir.data.find(v => v.name === 'Mesa Print Shop');
    assert.equal(row.tax_id_masked, '••••6789');
    assert.ok(!JSON.stringify(dir).includes('12-3456789') && !JSON.stringify(dir).includes(tax.tax_id_encrypted));

    const holding = await (await fetch(`${base}/holding/vendor/${mesa.id}`)).json();
    assert.equal(holding.taxId, '••••6789');

    const again = await post('/commit', { type: 'vendors', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(again.body.created, 0);
    assert.equal(again.body.skipped, 2);

    const undo = await fetch(`${base}/batches/${c.body.batchId}`, { method: 'DELETE' });
    assert.equal(undo.status, 200);
    assert.equal(db.tables.vendors.length, 0);
    assert.equal(db.tables.vendor_tax_ids.length, 0);
    assert.equal(db.tables.import_holding.length, 0);
});

test('vendor name match merges into the existing vendor (fills blanks) and keep_both is not possible', async () => {
    resetAll();
    db.tables.vendors.push({ id: 7, user_id: 'u1', name: 'mesa print shop', email: null, phone: null, address: null, notes: null, website: null, legacy_id: null, import_source: null });
    const text = csv('vendors', [vendor({ TIN: '' })]);
    const { mapping } = await analyzeAndMap('vendors', text);
    const preview = await post('/preview', { type: 'vendors', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(preview.body.duplicates[0].kind, 'name');
    assert.equal(preview.body.duplicates[0].defaultDecision, 'merge');

    const both = await post('/commit', { type: 'vendors', sourceSystem: 'zoho', mapping, decisions: { 1: 'keep_both' } }, { text });
    assert.equal(both.status, 400, 'keep_both is not a valid vendor decision');

    const merged = await post('/commit', { type: 'vendors', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(merged.body.merged, 1);
    assert.equal(db.tables.vendors.length, 1);
    assert.deepEqual([db.tables.vendors[0].name, db.tables.vendors[0].email, db.tables.vendors[0].website], ['mesa print shop', 'orders@mesa.test', 'https://mesa.test']);
});

test('expenses preview writes nothing and reports totals, categories, mileage and duplicates', async () => {
    resetAll();
    const text = csv('expenses', [
        expense(),
        expense({ 'Expense Account': 'Fuel/Mileage Expenses', Vendor: 'Shell', Total: '60.00', 'Expense Reference ID': 'e2' }),
        expense({ 'Expense Description': 'Client shoot', Distance: '20', 'Mileage Unit': 'mile', Total: '14.00', 'Expense Reference ID': 'e3' }),
        expense({ 'Expense Date': 'bad', 'Expense Reference ID': 'e4' }),
    ]);
    const { analysis, mapping } = await analyzeAndMap('expenses', text);
    assert.equal(analysis.unresolved.length, 0);
    const p = await post('/preview', { type: 'expenses', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.equal(p.body.summary.newCount, 2);
    assert.equal(p.body.summary.mileageCount, 1);
    assert.equal(p.body.summary.errors, 1);
    assert.equal(p.body.summary.totalCents, 4320 + 6000);
    assert.equal(p.body.summary.dateFrom, '2026-02-10');
    assert.equal(p.body.summary.deductibleCount, 2);
    assert.ok(p.body.categories.some(c => c.original === 'Fuel/Mileage Expenses' && c.category === 'Gas & Fuel' && c.mapped));
    assert.equal(db.tables.expenses.length + db.tables.mileage_logs.length + db.tables.import_batches.length, 0);
});

test('expenses commit: rows, mileage log, user rules, provenance, re-import skip, undo', async () => {
    resetAll();
    db.tables.classification_rules.push({ user_id: 'u1', match_column: 'vendor', match_type: 'contains', match_value: 'shell', assign_category: 'Gas & Fuel', assign_tax_bucket: 'Car and truck', assign_tax_deductible: true, assign_business_use_pct: 75 });
    const text = csv('expenses', [
        expense(),
        expense({ 'Expense Account': 'Bank Charges', Vendor: 'Shell', Total: '60.00', 'Expense Reference ID': 'e2' }),
        expense({ 'Expense Description': 'Client shoot', Distance: '20', 'Mileage Unit': 'mile', Vehicle: '', 'Vehicle Name': 'Van', Total: '14.00', 'Expense Reference ID': 'e3' }),
    ]);
    const { mapping } = await analyzeAndMap('expenses', text);
    const c = await post('/commit', { type: 'expenses', sourceSystem: 'zoho', mapping }, { text, name: 'expenses.csv' });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.deepEqual([c.body.created, c.body.mileageCreated, c.body.skipped], [2, 1, 0]);

    const bh = db.tables.expenses.find(e => e.vendor === 'B&H Photo');
    assert.deepEqual([bh.user_id, bh.amount_cents, bh.category, bh.tax_bucket, bh.tax_deductible, bh.source, bh.currency, bh.legacy_id, bh.import_source, bh.import_batch_id],
        ['u1', 4320, 'Office Supplies', 'Office expense', true, 'Chase Checking', 'USD', 'e1', 'zoho', c.body.batchId]);
    assert.ok(!('rm_id' in bh) && !('plaid_transaction_id' in bh));

    const shell = db.tables.expenses.find(e => e.vendor === 'Shell');
    assert.deepEqual([shell.category, shell.tax_bucket, shell.business_use_pct], ['Gas & Fuel', 'Car and truck', 75], 'the user\'s rule beats the importer default');

    const trip = db.tables.mileage_logs[0];
    assert.deepEqual([trip.user_id, trip.miles, trip.purpose, trip.source, trip.import_batch_id], ['u1', 20, 'Client shoot', 'zoho_import', c.body.batchId]);
    assert.match(trip.notes, /Vehicle: Van/);

    const again = await post('/commit', { type: 'expenses', sourceSystem: 'zoho', mapping }, { text });
    assert.deepEqual([again.body.created, again.body.mileageCreated, again.body.skipped], [0, 0, 2]);
    assert.equal(db.tables.expenses.length, 2);
    assert.equal(db.tables.mileage_logs.length, 1);

    const undo = await fetch(`${base}/batches/${c.body.batchId}`, { method: 'DELETE' });
    assert.equal(undo.status, 200);
    assert.equal(db.tables.expenses.length + db.tables.mileage_logs.length + db.tables.import_holding.length, 0);
});

test('a matching bank transaction is merged (fills blanks only), and markDeductible=false is honored', async () => {
    resetAll();
    db.tables.expenses.push({ id: 1, user_id: 'u1', expense_date: '2026-02-11', vendor: 'BH PHOTO NYC', amount_cents: 4320, source: 'Chase', category: 'Uncategorized', notes: '', tax_bucket: '', tax_deductible: false, business_use_pct: 100, legacy_id: null, import_source: null });
    const text = csv('expenses', [expense()]);
    const { mapping } = await analyzeAndMap('expenses', text);

    const preview = await post('/preview', { type: 'expenses', sourceSystem: 'zoho', mapping, markDeductible: 'false' }, { text });
    assert.equal(preview.body.summary.duplicates, 1);
    assert.equal(preview.body.duplicates[0].kind, 'similar');
    assert.equal(preview.body.duplicates[0].defaultDecision, 'merge');
    assert.equal(preview.body.summary.deductibleCount, 0);

    const c = await post('/commit', { type: 'expenses', sourceSystem: 'zoho', mapping }, { text });
    assert.equal(c.body.merged, 1);
    assert.equal(db.tables.expenses.length, 1);
    const row = db.tables.expenses[0];
    assert.deepEqual([row.vendor, row.source, row.expense_date, row.amount_cents], ['BH PHOTO NYC', 'Chase', '2026-02-11', 4320], 'bank row stays authoritative');
    assert.deepEqual([row.category, row.notes, row.tax_bucket], ['Office Supplies', 'Lens cleaning kit', 'Office expense']);

    const skipped = await post('/commit', { type: 'expenses', sourceSystem: 'zoho', mapping, decisions: { 1: 'skip' } }, { text });
    assert.equal(skipped.body.created + skipped.body.merged, 0);
});

test('an expense import that fails partway removes everything it created', async () => {
    resetAll();
    const text = csv('expenses', [expense(), expense({ 'Expense Description': 'Trip', Distance: '5', 'Mileage Unit': 'mile', 'Expense Reference ID': 'e9' })]);
    const { mapping } = await analyzeAndMap('expenses', text);
    db.failInsertOn('mileage_logs');
    const res = await post('/commit', { type: 'expenses', sourceSystem: 'zoho', mapping }, { text });
    db.failInsertOn(null);
    assert.equal(res.status, 500);
    assert.match(res.body.error, /rolled back/);
    assert.equal(db.tables.expenses.length, 0, 'expenses inserted before the failure are removed');
    assert.equal(db.tables.import_batches.length, 0);
    assert.equal(db.tables.import_holding.length, 0);
});

test('Release 2 rejects bad mappings the same way', async () => {
    const text = csv('expenses', [expense()]);
    const { mapping } = await analyzeAndMap('expenses', text);
    const noAmount = Object.fromEntries(Object.entries(mapping).map(([h, t]) => [h, t === 'total' || t === 'amount' ? '__holding__' : t]));
    assert.equal((await post('/commit', { type: 'expenses', sourceSystem: 'zoho', mapping: noAmount }, { text })).status, 400);
    assert.equal((await post('/commit', { type: 'expenses', sourceSystem: 'zoho', mapping: { ...mapping, Vendor: 'banana' } }, { text })).status, 400);
});
