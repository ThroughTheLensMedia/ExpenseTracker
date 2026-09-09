import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BUSINESS_ONLY_PATHS,
    EXPERIENCE_MODES,
    getExperienceMode,
    isBusinessExperience,
} from './experienceModes.js';

test('existing and malformed settings safely resolve to Business mode', () => {
    assert.equal(getExperienceMode(null), EXPERIENCE_MODES.BUSINESS);
    assert.equal(getExperienceMode({}), EXPERIENCE_MODES.BUSINESS);
    assert.equal(getExperienceMode({ experience_mode: 'unknown' }), EXPERIENCE_MODES.BUSINESS);
    assert.equal(isBusinessExperience({}), true);
});

test('Personal mode is enabled only by the explicit persisted value', () => {
    const settings = { experience_mode: EXPERIENCE_MODES.PERSONAL };
    assert.equal(getExperienceMode(settings), EXPERIENCE_MODES.PERSONAL);
    assert.equal(isBusinessExperience(settings), false);
});

test('the business-only route inventory covers every business module', () => {
    assert.deepEqual(BUSINESS_ONLY_PATHS, [
        '/tax',
        '/mileage',
        '/equipment',
        '/crm',
        '/clients',
    ]);
});
