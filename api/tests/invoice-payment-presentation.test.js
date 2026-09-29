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
const queryFor = table => {
    const query = {
        select: () => query, eq: () => query,
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
mockModule('../utils/mailer', { sendInvoiceApprovalEmail: async () => ({ success: true }) });
mockModule('../utils/cryptoUtil', { decryptOrPlain: async value => value });
let checkoutArgs;
const stripeId = require.resolve('stripe');
require.cache[stripeId] = {
    id: stripeId, filename: stripeId, loaded: true,
    exports: class StripeMock {
        checkout = { sessions: { create: async args => {
            checkoutArgs = args;
            return { url: 'https://checkout.stripe.test/session' };
        } } };
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
