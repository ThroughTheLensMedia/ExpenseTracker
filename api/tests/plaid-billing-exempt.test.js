'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    ADMIN_UUID,
    MICHELLE_UUID,
    JASON_UUID,
    PLAID_BILLING_EXEMPT,
} = require('../constants');

const EXPECTED_EXEMPT_IDS = [ADMIN_UUID, MICHELLE_UUID, JASON_UUID].sort();

test('Plaid billing exemption contains exactly the three approved accounts', () => {
    assert.deepEqual([...PLAID_BILLING_EXEMPT].sort(), EXPECTED_EXEMPT_IDS);
    assert.equal(PLAID_BILLING_EXEMPT.has('00000000-0000-0000-0000-000000000000'), false);
});

test('frontend Plaid estimate mirror matches the backend exemption list', async () => {
    const { PLAID_EXEMPT_IDS } = await import('../../web-react/src/constants/billing.js');
    assert.deepEqual([...PLAID_EXEMPT_IDS].sort(), EXPECTED_EXEMPT_IDS);
});
