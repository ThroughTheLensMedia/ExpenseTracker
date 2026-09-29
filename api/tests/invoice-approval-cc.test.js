const test = require('node:test');
const assert = require('node:assert/strict');

// Drives the real invoice routes with isolated database and mail fakes; no customer is contacted.
const emailQueuePath = require.resolve('../utils/emailQueue');
let queued;
require.cache[emailQueuePath] = {
    id: emailQueuePath, filename: emailQueuePath, loaded: true,
    exports: { queueInvoiceEmail: async payload => { queued = payload; return { success: true }; } },
};
const router = require('../routes/invoices');
const findRoute = (path, method) => router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
const patchRoute = findRoute('/:id', 'patch');
const postRoute = findRoute('/', 'post');

let row;
let settings;
let writes;
function freshState(overrides = {}) {
    queued = undefined;
    writes = [];
    settings = { business_name: 'Example Studio', email: 'owner@example.test', invoice_notes: '' };
    row = {
        id: 1, user_id: 'owner', payment_token: 'test-token', invoice_number: '2026-0929',
        status: 'draft', photographer_signed: false, issue_date: '2026-09-28', notes: '',
        clients: { name: 'Chelsea Harrison', email: 'chelsea@example.test' },
        invoice_items: [{ description: 'Portraits', quantity: 1, unit_price_cents: 17500 }],
        ...overrides,
    };
}
function sb() {
    return {
        from: table => {
            const query = {
                select: () => query, eq: () => query, delete: () => query,
                update: payload => { writes.push({ table, op: 'update', payload }); return query; },
                insert: payload => { writes.push({ table, op: 'insert', payload }); return query; },
                single: async () => ({ data: row, error: null }),
                maybeSingle: async () => ({ data: table === 'settings' ? settings : row, error: null }),
            };
            return query;
        },
    };
}
function call(handler, body, params = { id: '1' }) {
    const out = { status: 200 };
    const res = {
        status: code => { out.status = code; return res; },
        json: value => { out.body = value; return res; },
    };
    return handler({ body, params, user: { id: 'owner' }, sb: sb() }, res).then(() => out);
}
const invoiceWrites = () => writes.filter(w => w.table === 'invoices' && w.op === 'update');

// --- Photographer approval gate ---

test('Save Draft succeeds without approval and stores it as unapproved', async () => {
    freshState();
    const out = await call(postRoute, {
        client_id: 1, invoice_number: '2026-0930', issue_date: '2026-09-29',
        items: [{ description: 'Portraits', quantity: 1, unit_price_cents: 17500 }],
    }, {});
    assert.equal(out.status, 200);
    const insert = writes.find(w => w.table === 'invoices' && w.op === 'insert');
    assert.equal(insert.payload.photographer_signed, false);
    assert.equal(queued, undefined);
});

test('approval is stored when a new invoice is created approved', async () => {
    freshState();
    await call(postRoute, {
        client_id: 1, invoice_number: '2026-0930', issue_date: '2026-09-29', photographer_signed: true,
        items: [{ description: 'Portraits', quantity: 1, unit_price_cents: 17500 }],
    }, {});
    assert.equal(writes.find(w => w.table === 'invoices' && w.op === 'insert').payload.photographer_signed, true);
});

test('send is rejected without approval and nothing is written or queued', async () => {
    freshState({ status: 'draft', photographer_signed: false });
    const out = await call(patchRoute, { status: 'sent', pdf_base64: 'TESTPDF' });
    assert.equal(out.status, 400);
    assert.equal(out.body.error, 'Approve this invoice before sending it to the client.');
    assert.equal(queued, undefined);
    assert.equal(invoiceWrites().length, 0);
});

test('send is rejected when the request explicitly withdraws stored approval', async () => {
    freshState({ status: 'draft', photographer_signed: true });
    const out = await call(patchRoute, { status: 'sent', photographer_signed: false });
    assert.equal(out.status, 400);
    assert.equal(queued, undefined);
});

test('send succeeds when the invoice is approved', async () => {
    freshState({ status: 'draft', photographer_signed: true });
    const out = await call(patchRoute, { status: 'sent' });
    assert.equal(out.status, 200);
    assert.equal(queued.to, 'chelsea@example.test');
});

test('send succeeds when approval arrives in the same request', async () => {
    freshState({ status: 'draft', photographer_signed: false });
    const out = await call(patchRoute, { status: 'sent', photographer_signed: true });
    assert.equal(out.status, 200);
    assert.ok(queued);
});

test('resend succeeds for an already-sent invoice', async () => {
    freshState({ status: 'sent', photographer_signed: false });
    const out = await call(patchRoute, { status: 'sent', pdf_base64: 'TESTPDF' });
    assert.equal(out.status, 200);
    assert.ok(queued);
});

test('editing keeps approval, status and payment fields untouched', async () => {
    freshState({ status: 'sent', photographer_signed: true });
    // The editor omits status on edits, so JSON drops it; approval travels with the form.
    await call(patchRoute, { notes: 'Updated note', photographer_signed: true });
    const [update] = invoiceWrites();
    assert.equal(update.payload.photographer_signed, true);
    for (const key of ['status', 'customer_signed_at', 'customer_signature', 'payment_token']) {
        assert.equal(key in update.payload, false, `${key} must not be written by an edit`);
    }
    assert.equal(queued, undefined);
});

// --- Photographer CC ---

test('client stays the recipient, Profile Email is CC, Reply-To and extras are unchanged', async () => {
    freshState({ status: 'draft', photographer_signed: true });
    await call(patchRoute, { status: 'sent', pdf_base64: 'TESTPDF' });
    assert.equal(queued.to, 'chelsea@example.test');
    assert.equal(queued.cc, 'owner@example.test');
    assert.equal(queued.replyTo, 'owner@example.test');
    assert.equal(queued.attachments[0].filename, 'Chelsea Harrison (#2026-0929).pdf');
    assert.match(queued.body, /https:\/\/www\.lumiereledger\.com\/pay\/test-token/);
});

test('resend also copies the photographer', async () => {
    freshState({ status: 'sent' });
    await call(patchRoute, { status: 'sent' });
    assert.equal(queued.cc, 'owner@example.test');
});

for (const [label, email] of [['missing', undefined], ['empty', '  '], ['invalid', 'not-an-email'], ['a list', 'a@example.test, b@example.test']]) {
    test(`CC is omitted when Profile Email is ${label}`, async () => {
        freshState({ status: 'draft', photographer_signed: true });
        settings.email = email;
        await call(patchRoute, { status: 'sent' });
        assert.equal(queued.cc, undefined);
        assert.equal(queued.to, 'chelsea@example.test');
    });
}

test('CC is omitted when Profile Email matches the client, ignoring case and spacing', async () => {
    freshState({ status: 'draft', photographer_signed: true });
    settings.email = '  Chelsea@Example.TEST ';
    await call(patchRoute, { status: 'sent' });
    assert.equal(queued.cc, undefined);
    assert.equal(queued.to, 'chelsea@example.test');
});

// --- Mailer hand-off to Resend ---

test('mailer sends CC to Resend alongside the unchanged client recipient and Reply-To', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    let resendPayload;
    // Intercept the import itself so the test does not depend on the locally installed resend version.
    const Module = require('node:module');
    const originalLoad = Module._load;
    Module._load = function (request, ...rest) {
        if (request === 'resend') {
            return { Resend: class { emails = { send: async payload => { resendPayload = payload; return { id: 'x' }; } }; } };
        }
        return originalLoad.call(this, request, ...rest);
    };
    let sendInvoiceEmail;
    try {
        ({ sendInvoiceEmail } = require('../utils/mailer'));
    } finally {
        Module._load = originalLoad;
    }

    await sendInvoiceEmail({ to: 'chelsea@example.test', subject: 'S', body: '<p>B</p>', fromName: 'Example Studio', replyTo: 'owner@example.test', cc: 'owner@example.test' });
    assert.deepEqual(resendPayload.to, ['chelsea@example.test']);
    assert.deepEqual(resendPayload.cc, ['owner@example.test']);
    assert.equal(resendPayload.reply_to, 'owner@example.test');

    await sendInvoiceEmail({ to: 'chelsea@example.test', subject: 'S', body: '<p>B</p>', replyTo: 'owner@example.test' });
    assert.equal('cc' in resendPayload, false);
});
