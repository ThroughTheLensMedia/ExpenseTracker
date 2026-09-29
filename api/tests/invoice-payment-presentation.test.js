const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const invoice = {
    id: 1, user_id: 'owner', payment_token: 'test-token', invoice_number: '2026-0929',
    status: 'sent', tax_percent: 0, discount_cents: 0,
    clients: { name: 'Chelsea Harrison', email: 'chelsea@example.test' },
    invoice_items: [{ description: 'Portraits', quantity: 1, unit_price_cents: 17500 }],
};
const settings = { business_name: 'Example Studio', email: 'owner@example.test', stripe_publishable_key: 'rk_test_fake' };
const updates = [];
const queryFor = table => {
    const query = {
        select: () => query, eq: () => query,
        update: payload => { updates.push(payload); return query; },
        single: async () => ({ data: table === 'invoices' ? invoice : settings, error: null }),
        maybeSingle: async () => ({ data: settings, error: null }),
    };
    return query;
};
const mockModule = (relativePath, exports) => {
    const id = require.resolve(relativePath);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};
mockModule('../db', { supabase: { from: queryFor } });
const approvalEmails = [];
mockModule('../utils/mailer', { sendInvoiceApprovalEmail: async payload => { approvalEmails.push(payload); return { success: true }; } });
mockModule('../utils/cryptoUtil', { decryptOrPlain: async value => value });
let checkoutArgs;
let stripeSession = { payment_status: 'paid', customer_details: { name: 'Chelsea Harrison' } };
const stripeId = require.resolve('stripe');
require.cache[stripeId] = {
    id: stripeId, filename: stripeId, loaded: true,
    exports: class StripeMock {
        checkout = { sessions: { create: async args => {
            checkoutArgs = args;
            return { url: 'https://checkout.stripe.test/session' };
        }, retrieve: async () => stripeSession } };
    },
};
const router = require('../routes/pay');
const route = (pathName, method) => router.stack.find(layer => layer.route?.path === pathName && layer.route.methods[method]).route.stack[0].handle;
const res = () => {
    let payload;
    return { json: value => { payload = value; }, status: code => { throw new Error(`Unexpected ${code}`); }, get payload() { return payload; } };
};
test('client can load a sent invoice and access configured card payment', async () => {
    const response = res();
    await route('/:token', 'get')({ params: { token: 'test-token' } }, response);
    assert.equal(response.payload.invoice.client.email, 'chelsea@example.test');
    assert.equal(response.payload.studio.has_stripe, true);
});
test('checkout retains recipient and invoice total', async () => {
    const response = res();
    await route('/:token/checkout', 'post')({ params: { token: 'test-token' } }, response);
    assert.equal(response.payload.url, 'https://checkout.stripe.test/session');
    assert.equal(checkoutArgs.customer_email, 'chelsea@example.test');
    assert.equal(checkoutArgs.line_items[0].price_data.unit_amount, 17500);
    assert.match(checkoutArgs.success_url, /\/pay\/test-token/);
});

// --- Client approval, manual methods, and payment verification (existing behavior, pinned) ---

const baseInvoice = { ...invoice, invoice_items: invoice.invoice_items.map(it => ({ ...it })) };
const baseSettings = { ...settings };
const reset = () => {
    Object.assign(invoice, baseInvoice, { customer_signed_at: null, customer_signature: null, invoice_items: baseInvoice.invoice_items.map(it => ({ ...it })) });
    for (const key of Object.keys(settings)) delete settings[key];
    Object.assign(settings, baseSettings);
    updates.length = 0;
    approvalEmails.length = 0;
    checkoutArgs = undefined;
    stripeSession = { payment_status: 'paid', customer_details: { name: 'Chelsea Harrison' } };
};
const resWithStatus = () => {
    const out = { status: 200 };
    const r = { status: code => { out.status = code; return r; }, json: value => { out.payload = value; return r; } };
    return { out, r };
};

test('manual payment methods appear only when configured', async () => {
    reset();
    Object.assign(settings, { venmo_handle: '@studio', zelle_handle: 'pay@studio.test', cashapp_tag: '$studio' });
    let response = res();
    await route('/:token', 'get')({ params: { token: 'test-token' } }, response);
    assert.equal(response.payload.studio.venmo_handle, '@studio');
    assert.equal(response.payload.studio.zelle_handle, 'pay@studio.test');
    assert.equal(response.payload.studio.cashapp_tag, '$studio');
    assert.equal(response.payload.studio.has_stripe, true);

    reset();
    delete settings.stripe_publishable_key;
    response = res();
    await route('/:token', 'get')({ params: { token: 'test-token' } }, response);
    assert.equal(response.payload.studio.venmo_handle, null);
    assert.equal(response.payload.studio.zelle_handle, null);
    assert.equal(response.payload.studio.cashapp_tag, null);
    assert.equal(response.payload.studio.has_stripe, false);
});

test('client signature is recorded, leaves the invoice unpaid, and notifies the photographer', async () => {
    reset();
    const { out, r } = resWithStatus();
    await route('/:token', 'post')({ params: { token: 'test-token' }, body: { signature: 'Chelsea Harrison' } }, r);
    assert.equal(out.payload.ok, true);
    assert.equal(updates[0].customer_signature, 'Chelsea Harrison');
    assert.ok(updates[0].customer_signed_at);
    assert.equal('status' in updates[0], false);
    assert.equal(approvalEmails[0].to, 'owner@example.test');
});

test('client signature rejects a missing name and a second approval', async () => {
    reset();
    let call = resWithStatus();
    await route('/:token', 'post')({ params: { token: 'test-token' }, body: { signature: ' ' } }, call.r);
    assert.equal(call.out.status, 400);

    invoice.customer_signed_at = '2026-09-29T12:00:00.000Z';
    call = resWithStatus();
    await route('/:token', 'post')({ params: { token: 'test-token' }, body: { signature: 'Chelsea Harrison' } }, call.r);
    assert.equal(call.out.status, 409);
    assert.equal(updates.length, 0);
});

test('checkout charges the exact total with tax and discount applied', async () => {
    reset();
    invoice.invoice_items = [{ description: 'Portraits', quantity: 2, unit_price_cents: 10000 }];
    invoice.tax_percent = 10;
    invoice.discount_cents = 500; // 5% stored as basis points
    const response = res();
    await route('/:token/checkout', 'post')({ params: { token: 'test-token' } }, response);
    // 20000 subtotal + 2000 tax - 1000 discount
    assert.equal(checkoutArgs.line_items.length, 1);
    assert.equal(checkoutArgs.line_items[0].price_data.unit_amount, 21000);
});

test('verified Stripe payment marks the invoice paid', async () => {
    reset();
    const { out, r } = resWithStatus();
    await route('/:token/verify-session', 'post')({ params: { token: 'test-token' }, body: { session_id: 'cs_test' } }, r);
    assert.equal(out.payload.ok, true);
    assert.equal(updates[0].status, 'paid');
    assert.equal(updates[0].customer_signature, 'Chelsea Harrison');
    assert.ok(updates[0].customer_signed_at);
});

test('an unpaid Stripe session does not mark the invoice paid', async () => {
    reset();
    stripeSession = { payment_status: 'unpaid' };
    const { out, r } = resWithStatus();
    await route('/:token/verify-session', 'post')({ params: { token: 'test-token' }, body: { session_id: 'cs_test' } }, r);
    assert.equal(out.status, 400);
    assert.equal(updates.length, 0);
});

// The client-approval gate on the pay page is a UI state machine (no component test harness in this repo),
// so this pins its structure: card checkout is only offered after the signed state, and signing hits the API first.
test('pay page offers card checkout only after the client approves', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '../../web-react/src/pages/PayInvoice.jsx'), 'utf8');
    const signedStart = src.indexOf("if (state === 'signed')");
    const approvalStart = src.indexOf('Approve This Invoice');
    assert.ok(signedStart > 0 && approvalStart > signedStart, 'signed view precedes the approval form');
    const buttonUses = [...src.matchAll(/onClick=\{handleCardCheckout\}/g)].map(m => m.index);
    assert.equal(buttonUses.length, 1);
    assert.ok(buttonUses[0] > signedStart && buttonUses[0] < approvalStart, 'card button lives only in the signed view');
    assert.ok(src.indexOf("fetch(`/api/pay/${token}`") < src.indexOf("setState('signed')", src.indexOf('const handleSign')), 'signature is submitted before the signed view shows');
});
