import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BUSINESS_ONLY_PATHS,
    EXPERIENCE_MODES,
    getAssistantExperienceCopy,
    getExperienceMode,
    isBusinessExperience,
} from './experienceModes.js';

test('existing and malformed settings safely resolve to Business mode', () => {
    assert.equal(getExperienceMode(null), EXPERIENCE_MODES.BUSINESS);
    assert.equal(getExperienceMode({}), EXPERIENCE_MODES.BUSINESS);
    assert.equal(getExperienceMode({ experience_mode: 'unknown' }), EXPERIENCE_MODES.BUSINESS);
    assert.equal(isBusinessExperience({}), true);
});

test('Assistant examples match the active experience', () => {
    const personal = getAssistantExperienceCopy({ experience_mode: 'personal' });
    const business = getAssistantExperienceCopy({ experience_mode: 'business' });

    assert.match(personal.dataScope, /transactions and spending history/);
    assert.equal(personal.examples.some(example => /invoice|lead/i.test(example)), false);
    assert.match(business.dataScope, /invoices, and CRM/);
    assert.equal(business.examples.some(example => /invoice/i.test(example)), true);
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
