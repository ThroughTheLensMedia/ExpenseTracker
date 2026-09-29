import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { combineInvoiceNotes as frontend } from './invoiceNotes.js';
const require = createRequire(import.meta.url);
const { combineInvoiceNotes: backend } = require('../../../api/utils/invoiceNotes.js');

for (const [profile, invoice, expected] of [
    ['', '', ''],
    ['Global note', '', 'Global note'],
    ['', 'Invoice note', 'Invoice note'],
    ['Global note', 'Invoice note', 'Global note\n\nInvoice note'],
    ['Global note', 'Global note\n\nInvoice note', 'Global note\n\nInvoice note'],
    ['Global   note', 'Global note\nInvoice note', 'Global note\nInvoice note'],
    ['Global note\nInvoice note', 'Invoice note', 'Global note\nInvoice note'],
    ['Pay', 'Payment instructions', 'Pay\n\nPayment instructions'],
]) {
    test(`invoice notes agree for profile=${JSON.stringify(profile)} invoice=${JSON.stringify(invoice)}`, () => {
        assert.equal(frontend(profile, invoice), expected);
        assert.equal(backend(profile, invoice), expected);
    });
}
