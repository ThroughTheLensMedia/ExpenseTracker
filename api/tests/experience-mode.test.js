'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EXPERIENCE_MODES, isValidExperienceMode } = require('../constants');

test('experience modes expose the two supported account experiences', () => {
    assert.deepEqual(EXPERIENCE_MODES, {
        BUSINESS: 'business',
        PERSONAL: 'personal',
    });
});

test('experience mode validation rejects missing and unsupported values', () => {
    assert.equal(isValidExperienceMode('business'), true);
    assert.equal(isValidExperienceMode('personal'), true);
    assert.equal(isValidExperienceMode('photographer'), false);
    assert.equal(isValidExperienceMode(undefined), false);
});
