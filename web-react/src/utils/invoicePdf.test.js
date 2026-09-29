import test from 'node:test';
import assert from 'node:assert/strict';
/* global Buffer */
import { inflateSync } from 'node:zlib';
import { buildInvoicePdf, distinctTerms, invoiceFilename } from './invoicePdf.js';

function textOperators(pdf) {
    return [...pdf.output().matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => {
        try { return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); }
        catch { return match[1]; }
    }).join('\n');
}

const sample = {
    clientName: 'Chelsea Harrison', number: '2026-0929', date: '2026-09-28',
    items: [{ description: 'Elvis Vow Renewal Portraits', quantity: 1, unit_price: 175 }],
    subtotal: 175, total: 175, notes: 'Deposit due before the session.',
    attachment: { name: 'Production Package', url: 'https://example.com/package' },
};
test('client filename preserves requested punctuation and removes unsafe characters', () => {
    assert.equal(invoiceFilename(sample.clientName, sample.number), 'Chelsea Harrison (#2026-0929).pdf');
    assert.equal(invoiceFilename('Client/Name', '42'), 'Client_Name (#42).pdf');
});
test('terms suppression requires complete equality after whitespace normalization', () => {
    assert.equal(distinctTerms('Deposit due.\nThank you.', 'Deposit due. Thank you.'), false);
    assert.equal(distinctTerms('Deposit due.', 'Deposit due. Balance due later.'), true);
});
test('standard invoice fits Letter with live attachment link and neutral branding', async () => {
    const pdf = await buildInvoicePdf(sample);
    assert.equal(pdf.getNumberOfPages(), 1);
    assert.equal(pdf.internal.pageSize.getWidth(), 612);
    assert.equal(pdf.internal.pageSize.getHeight(), 792);
    const output = pdf.output();
    assert.match(output, /https:\/\/example.com\/package/);
    assert.doesNotMatch(output, /throughthelens/);
});
test('long invoices paginate without losing their last item', async () => {
    const pdf = await buildInvoicePdf({ ...sample, items: Array.from({ length: 80 }, (_, index) => ({ description: `Service ${index + 1}`, quantity: 1, unit_price: 10 })) });
    assert.ok(pdf.getNumberOfPages() > 1);
    const text = textOperators(pdf);
    assert.match(text, /Service 80/);
    assert.match(text, /Deposit due before the session/);
});
test('terms checkbox excludes only Profile Terms from PDF', async () => {
    const pdf = await buildInvoicePdf({ ...sample, attachment: null }, { standard_terms: 'Distinct profile terms' }, false);
    assert.equal(pdf.lastAutoTable.body[0].raw[0], sample.notes);
    const included = await buildInvoicePdf(sample, { standard_terms: 'Distinct profile terms' }, true);
    assert.equal(included.lastAutoTable.body[0].raw[0], 'Distinct profile terms');
});

test('provided tax and discount amounts are retained without recalculation', async () => {
    const pdf = await buildInvoicePdf({ ...sample, tax_percent: 8, taxVal: 14, discountPercent: 10, discount: 17.5, total: 171.5 });
    const text = textOperators(pdf);
    for (const amount of ['$14.00', '-$17.50', '$171.50']) assert.ok(text.includes(amount));
});
test('date-only issue date remains unchanged and no-quantity lines remain descriptive', async () => {
    const pdf = await buildInvoicePdf({ ...sample, items: [...sample.items, { description: 'Included consultation', quantity: 0, unit_price: 99 }] });
    const text = textOperators(pdf);
    assert.ok(text.includes('9/28/2026'));
    assert.ok(text.includes('Included consultation'));
    assert.ok(!text.includes('$99.00'));
});
test('long notes and terms paginate and retain their ending', async () => {
    const pdf = await buildInvoicePdf({ ...sample, notes: ('Long session details. '.repeat(500)) + 'FINAL NOTE' }, { standard_terms: 'FINAL TERMS' });
    assert.ok(pdf.getNumberOfPages() > 1);
    const text = textOperators(pdf);
    assert.ok(text.includes('FINAL NOTE'));
    assert.ok(text.includes('FINAL TERMS'));
});
