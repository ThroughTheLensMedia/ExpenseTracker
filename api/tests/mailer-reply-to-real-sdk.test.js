// Regression: Reply-To was set as `reply_to`, which the real Resend SDK silently drops,
// so client replies to invoice emails went to support@throughthelens.media instead of the photographer.
// This test uses the REAL installed `resend` package and intercepts only the HTTP call.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.RESEND_API_KEY = 're_test_key';

test('real Resend SDK puts the photographer in the Reply-To header of an invoice email', async () => {
    const originalFetch = global.fetch;
    let sentBody;
    global.fetch = async (url, init) => {
        sentBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ id: 'email_test' }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
        const { sendInvoiceEmail } = require('../utils/mailer');
        const result = await sendInvoiceEmail({
            to: 'client@example.test',
            subject: 'Invoice',
            body: '<p>hi</p>',
            fromName: 'Example Studio',
            replyTo: 'owner@example.test',
            cc: 'owner@example.test'
        });
        assert.equal(result.success, true);
        assert.equal(sentBody.reply_to, 'owner@example.test');
        assert.deepEqual(sentBody.cc, ['owner@example.test']);
        assert.deepEqual(sentBody.to, ['client@example.test']);
    } finally {
        global.fetch = originalFetch;
    }
});
