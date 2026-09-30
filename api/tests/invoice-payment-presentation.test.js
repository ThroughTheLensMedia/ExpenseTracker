const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const invoice = {
    id: 1, user_id: 'owner', payment_token: 'test-token', invoice_number: '2026-0929',
    status: 'sent', tax_percent: 0, discount_cents: 0, customer_signed_at: '2026-09-29T12:00:00.000Z', customer_signature: 'Chelsea Harrison',
    clients: { name: 'Chelsea Harrison', email: 'chelsea@example.test' },
    invoice_items: [{ description: 'Portraits', quantity: 1, unit_price_cents: 17500 }],
};
const settings = { business_name: 'Example Studio', email: 'owner@example.test', stripe_publishable_key: 'rk_test_fake' };
const updates = [];
let updateRows = [{ id: 1 }]; // what an update ... .select('id') resolves to (empty = a concurrent request won the race)
const queryFor = table => {
    const query = {
        select: () => query, eq: () => query, neq: () => query,
        update: payload => { updates.push(payload); return query; },
        then: resolve => resolve({ data: updateRows, error: null }),
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
const paidSession = () => ({ id: 'cs_test', payment_status: 'paid', client_reference_id: '1', metadata: { invoice_id: '1' }, currency: 'usd', amount_total: 17500, customer_details: { name: 'Chelsea Harrison' } });
let stripeSession = paidSession();
let stripeRetrieveError = null; // set to make sessions.retrieve reject like Stripe does for an unknown id
const stripeId = require.resolve('stripe');
require.cache[stripeId] = {
    id: stripeId, filename: stripeId, loaded: true,
    exports: class StripeMock {
        checkout = { sessions: { create: async args => {
            checkoutArgs = args;
            return { url: 'https://checkout.stripe.test/session' };
        }, retrieve: async () => { if (stripeRetrieveError) throw stripeRetrieveError; return stripeSession; } } };
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
    Object.assign(invoice, baseInvoice, { customer_signed_at: baseInvoice.customer_signed_at, customer_signature: 'Chelsea Harrison', invoice_items: baseInvoice.invoice_items.map(it => ({ ...it })) });
    for (const key of Object.keys(settings)) delete settings[key];
    Object.assign(settings, baseSettings);
    updates.length = 0;
    approvalEmails.length = 0;
    checkoutArgs = undefined;
    stripeSession = paidSession();
    stripeRetrieveError = null;
    updateRows = [{ id: 1 }];
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
    invoice.customer_signed_at = null;
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
    invoice.customer_signed_at = null;
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
    invoice.customer_signed_at = null; // legacy in-flight session created before approval was enforced server-side
    const { out, r } = resWithStatus();
    await route('/:token/verify-session', 'post')({ params: { token: 'test-token' }, body: { session_id: 'cs_test' } }, r);
    assert.equal(out.payload.ok, true);
    assert.equal(updates[0].status, 'paid');
    assert.equal(updates[0].customer_signature, 'Chelsea Harrison');
    assert.ok(updates[0].customer_signed_at);
});

test('an unpaid Stripe session does not mark the invoice paid', async () => {
    reset();
    stripeSession = { ...paidSession(), payment_status: 'unpaid' };
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


// --- v7.29.7: approval enforced in the backend; verification bound to the invoice ---

const verify = async (sessionId = 'cs_test') => {
    const { out, r } = resWithStatus();
    await route('/:token/verify-session', 'post')({ params: { token: 'test-token' }, body: { session_id: sessionId } }, r);
    return out;
};
const silence = fn => async () => { const orig = console.error; console.error = () => {}; try { await fn(); } finally { console.error = orig; } };

test('checkout is refused until the client has approved the invoice', async () => {
    reset();
    invoice.customer_signed_at = null;
    const { out, r } = resWithStatus();
    await route('/:token/checkout', 'post')({ params: { token: 'test-token' } }, r);
    assert.equal(out.status, 403);
    assert.equal(out.payload.code, 'approval_required');
    assert.equal(checkoutArgs, undefined, 'no Stripe session may be created');
});

test('approved-then-paid invoice is marked paid and keeps the original signature and approval time', async () => {
    reset(); // approved 2026-09-29T12:00 by Chelsea; this is the normal linear flow
    const out = await verify();
    assert.equal(out.payload.ok, true);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].status, 'paid');
    assert.equal('customer_signed_at' in updates[0], false, 'approval time must not be overwritten');
    assert.equal('customer_signature' in updates[0], false, 'signature must not be overwritten');
    assert.equal(out.payload.signed_at, '2026-09-29T12:00:00.000Z');
    assert.equal(approvalEmails.length, 1);
    assert.match(approvalEmails[0].customerSignature, /Paid via Stripe/);
    assert.equal(approvalEmails[0].totalCents, 17500);
});

test('a paid session from a different invoice cannot mark this invoice paid', silence(async () => {
    reset();
    stripeSession = { ...paidSession(), client_reference_id: '999', metadata: { invoice_id: '999' } };
    const out = await verify('cs_other_invoice');
    assert.equal(out.status, 400);
    assert.equal(out.payload.code, 'session_mismatch');
    assert.equal(updates.length, 0);
    assert.equal(approvalEmails.length, 0);
}));

test('a session with no invoice reference (any other payment on the account) is rejected', silence(async () => {
    reset();
    stripeSession = { id: 'cs_x', payment_status: 'paid', currency: 'usd', amount_total: 17500, customer_details: {} };
    const out = await verify();
    assert.equal(out.status, 400);
    assert.equal(updates.length, 0);
}));

test('a paid session for the wrong amount or currency is rejected', silence(async () => {
    reset();
    stripeSession = { ...paidSession(), amount_total: 100 };
    let out = await verify();
    assert.equal(out.status, 400);
    assert.equal(out.payload.code, 'session_mismatch');
    stripeSession = { ...paidSession(), currency: 'eur' };
    out = await verify();
    assert.equal(out.status, 400);
    assert.equal(updates.length, 0);
}));

test('verification expects the exact balance with tax and discount applied ($175 example and a taxed/discounted case)', silence(async () => {
    reset();
    invoice.invoice_items = [{ description: 'Portraits', quantity: 2, unit_price_cents: 10000 }];
    invoice.tax_percent = 10;
    invoice.discount_cents = 500; // 20000 + 2000 tax - 1000 discount = 21000
    stripeSession = { ...paidSession(), amount_total: 21000 };
    let out = await verify();
    assert.equal(out.payload.ok, true);
    assert.equal(updates[0].status, 'paid');
    updates.length = 0;
    stripeSession = { ...paidSession(), amount_total: 17500 }; // pre-discount/tax amount no longer matches
    out = await verify();
    assert.equal(out.status, 400);
    assert.equal(updates.length, 0);
}));

test('an already-paid invoice returns success without another write or notification (idempotent)', async () => {
    reset();
    invoice.status = 'paid';
    const out = await verify();
    assert.equal(out.payload.ok, true);
    assert.equal(out.payload.already_paid, true);
    assert.equal(updates.length, 0);
    assert.equal(approvalEmails.length, 0);
});

test('a concurrent verification that loses the race does not send a second notification', async () => {
    reset();
    updateRows = []; // the guarded update matched no row: someone else already marked it paid
    const out = await verify();
    assert.equal(out.payload.ok, true);
    assert.equal(out.payload.already_paid, true);
    assert.equal(approvalEmails.length, 0);
});

test('a voided invoice can never be marked paid', async () => {
    reset();
    invoice.status = 'void';
    const out = await verify();
    assert.equal(out.status, 410);
    assert.equal(updates.length, 0);
});

test('a Stripe session that cannot be retrieved is a clean 400, not a leaked Stripe error', silence(async () => {
    reset();
    stripeRetrieveError = new Error('No such checkout.session: cs_secret_detail');
    const out = await verify('cs_bogus');
    assert.equal(out.status, 400);
    assert.equal(out.payload.code, 'session_not_found');
    assert.doesNotMatch(JSON.stringify(out.payload), /cs_secret_detail/);
    assert.equal(updates.length, 0);
}));

test('a missing session id is rejected before anything is read or written', async () => {
    reset();
    const { out, r } = resWithStatus();
    await route('/:token/verify-session', 'post')({ params: { token: 'test-token' }, body: {} }, r);
    assert.equal(out.status, 400);
    assert.equal(updates.length, 0);
});

test('a failed notification email does not turn a recorded payment into an error', silence(async () => {
    reset();
    const mailer = require('../utils/mailer');
    const original = mailer.sendInvoiceApprovalEmail;
    mailer.sendInvoiceApprovalEmail = async () => { throw new Error('resend down'); };
    try {
        const out = await verify();
        assert.equal(out.payload.ok, true);
        assert.equal(updates[0].status, 'paid');
    } finally { mailer.sendInvoiceApprovalEmail = original; }
}));

// The pay page must show the verification error (and block a second card attempt) instead of silently offering Pay again.
test('pay page surfaces a failed verification and disables the card button', () => {
    const src = require('node:fs').readFileSync(path.join(__dirname, '../../web-react/src/pages/PayInvoice.jsx'), 'utf8');
    assert.match(src, /setVerifyError\(verifyJson\.error/);
    assert.match(src, /disabled=\{checkoutLoading \|\| Boolean\(verifyError\)\}/);
    assert.match(src, /role="alert"/);
});
