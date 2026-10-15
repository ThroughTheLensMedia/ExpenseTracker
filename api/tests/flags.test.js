'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Isolate module cache so we can stub ../db between cases
function loadFlagsFresh() {
  delete require.cache[require.resolve('../utils/flags')];
  delete require.cache[require.resolve('../db')];
  return require('../utils/flags');
}

test('DEFAULTS mirror the migration seed (features ON, human-confirm OFF)', () => {
  const { DEFAULTS } = loadFlagsFresh();
  assert.equal(DEFAULTS.bank_sync, true);
  assert.equal(DEFAULTS.invoicing, true);
  assert.equal(DEFAULTS.mileage, true);
  assert.equal(DEFAULTS.gear_depreciation, true);
  assert.equal(DEFAULTS.tax_review, true);
  assert.equal(DEFAULTS.ai_assistant, true);
  assert.equal(DEFAULTS.bot_security_reviews, true);
  assert.equal(DEFAULTS.bot_saas_management, true);
  assert.equal(DEFAULTS.bot_readonly_ops, true);
  assert.equal(DEFAULTS.bot_require_human_confirm, false);
});

test('failSafeFlags: features ON, bot write caps OFF, human-confirm ON', () => {
  const { failSafeFlags } = loadFlagsFresh();
  const f = failSafeFlags();
  assert.equal(f.bank_sync, true);
  assert.equal(f.invoicing, true);
  assert.equal(f.ai_assistant, true);
  assert.equal(f.bot_security_reviews, false);
  assert.equal(f.bot_saas_management, false);
  assert.equal(f.bot_readonly_ops, true);
  assert.equal(f.bot_require_human_confirm, true);
});

test('isFlagEnabled returns defaults when supabase client is missing', async () => {
  // Stub db to export null supabase before loading flags
  const dbPath = require.resolve('../db');
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { supabase: null },
  };
  delete require.cache[require.resolve('../utils/flags')];
  const { isFlagEnabled, bustFlagCache, getFlags } = require('../utils/flags');
  bustFlagCache();

  assert.equal(await isFlagEnabled('bank_sync'), true);
  assert.equal(await isFlagEnabled('bot_security_reviews'), false);
  assert.equal(await isFlagEnabled('bot_require_human_confirm'), true);
  const { migrationPending } = await getFlags();
  assert.equal(migrationPending, true);

  delete require.cache[dbPath];
  delete require.cache[require.resolve('../utils/flags')];
});

test('isFlagEnabled fails open/closed when table read errors', async () => {
  const dbPath = require.resolve('../db');
  const fakeSb = {
    from() {
      return {
        select() {
          return Promise.resolve({
            data: null,
            error: { code: '42P01', message: 'relation "app_flags" does not exist' },
          });
        },
      };
    },
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { supabase: fakeSb },
  };
  delete require.cache[require.resolve('../utils/flags')];
  const { isFlagEnabled, bustFlagCache, getFlags } = require('../utils/flags');
  bustFlagCache();

  assert.equal(await isFlagEnabled('mileage'), true);
  assert.equal(await isFlagEnabled('bot_saas_management'), false);
  assert.equal(await isFlagEnabled('bot_require_human_confirm'), true);
  const { migrationPending } = await getFlags();
  assert.equal(migrationPending, true);

  delete require.cache[dbPath];
  delete require.cache[require.resolve('../utils/flags')];
});

test('isFlagEnabled uses DB values when table is readable', async () => {
  const dbPath = require.resolve('../db');
  const fakeSb = {
    from() {
      return {
        select() {
          return Promise.resolve({
            data: [
              { key: 'bank_sync', enabled: false },
              { key: 'bot_require_human_confirm', enabled: true },
              { key: 'ai_assistant', enabled: true },
            ],
            error: null,
          });
        },
      };
    },
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { supabase: fakeSb },
  };
  delete require.cache[require.resolve('../utils/flags')];
  const { isFlagEnabled, bustFlagCache, getFlags } = require('../utils/flags');
  bustFlagCache();

  assert.equal(await isFlagEnabled('bank_sync'), false);
  assert.equal(await isFlagEnabled('bot_require_human_confirm'), true);
  assert.equal(await isFlagEnabled('ai_assistant'), true);
  // Unspecified keys keep defaults
  assert.equal(await isFlagEnabled('invoicing'), true);
  const { migrationPending } = await getFlags();
  assert.equal(migrationPending, false);

  delete require.cache[dbPath];
  delete require.cache[require.resolve('../utils/flags')];
});

test('unknown flag key returns false', async () => {
  const dbPath = require.resolve('../db');
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { supabase: null },
  };
  delete require.cache[require.resolve('../utils/flags')];
  const { isFlagEnabled, bustFlagCache } = require('../utils/flags');
  bustFlagCache();
  assert.equal(await isFlagEnabled('not_a_real_flag'), false);
  assert.equal(await isFlagEnabled(''), false);
  delete require.cache[dbPath];
  delete require.cache[require.resolve('../utils/flags')];
});

test('cache bust forces a reload', async () => {
  const dbPath = require.resolve('../db');
  let calls = 0;
  const fakeSb = {
    from() {
      return {
        select() {
          calls += 1;
          return Promise.resolve({
            data: [{ key: 'bank_sync', enabled: calls === 1 }],
            error: null,
          });
        },
      };
    },
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { supabase: fakeSb },
  };
  delete require.cache[require.resolve('../utils/flags')];
  const { isFlagEnabled, bustFlagCache } = require('../utils/flags');
  bustFlagCache();
  assert.equal(await isFlagEnabled('bank_sync'), true);
  assert.equal(await isFlagEnabled('bank_sync'), true); // cached
  assert.equal(calls, 1);
  bustFlagCache();
  assert.equal(await isFlagEnabled('bank_sync'), false);
  assert.equal(calls, 2);
  delete require.cache[dbPath];
  delete require.cache[require.resolve('../utils/flags')];
});
