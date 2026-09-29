const test = require('node:test');
const assert = require('node:assert/strict');

// Exercise the send route with isolated database and mail fakes; no customer is contacted.
const emailQueuePath = require.resolve('../utils/emailQueue');
let queued;
require.cache[emailQueuePath] = {
    id: emailQueuePath, filename: emailQueuePath, loaded: true,
    exports: { queueInvoiceEmail: async payload => { queued = payload; return { success: true }; } },
};
const router = require('../routes/invoices');
const sendRoute = router.stack.find(layer => layer.route?.path === '/:id' && layer.route?.methods.patch).route.stack[0].handle;

const invoice = {
    id: 1, user_id: 'owner', payment_token: 'test-token', invoice_number: '2026-0929',
    status: 'sent', issue_date: '2026-09-28', notes: 'Invoice-specific details.',
    clients: { name: 'Chelsea Harrison', email: 'chelsea@example.test' },
    invoice_items: [{ description: 'Portraits', quantity: 1, unit_price_cents: 17500 }],
};
const settings = { business_name: 'Example Studio', email: 'owner@example.test', invoice_notes: 'Profile-wide note.' };
function mockTable(name) {
    const query = {
        update: () => query, select: () => query, eq: () => query,
        single: async () => ({ data: invoice, error: null }),
        maybeSingle: async () => ({ data: name === 'settings' ? settings : invoice, error: null }),
    };
    return query;
}
test('send route retains recipient, payment link, PDF, and both notes', async () => {
    const req = { body: { status: 'sent', pdf_base64: 'TESTPDF' }, params: { id: '1' }, user: { id: 'owner' }, sb: { from: mockTable } };
    let response;
    const res = { json: value => { response = value; }, status: code => { throw new Error(`Unexpected status ${code}`); } };
    await sendRoute(req, res);
    assert.equal(response.id, 1);
    assert.equal(queued.to, 'chelsea@example.test');
    assert.equal(queued.attachments[0].filename, 'Chelsea Harrison (#2026-0929).pdf');
    assert.equal(queued.attachments[0].content, 'TESTPDF');
    assert.match(queued.body, /Profile-wide note/);
    assert.match(queued.body, /Invoice-specific details/);
    assert.match(queued.body, /https:\/\/www\.lumiereledger\.com\/pay\/test-token/);
});
