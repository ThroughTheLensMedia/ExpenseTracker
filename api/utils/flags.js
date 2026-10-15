'use strict';

/**
 * Global app feature / bot capability flags.
 *
 * Fail behavior when the table is missing or unreadable:
 *   - feature.*  → ON  (fail open — keep product working)
 *   - bot write caps (bot_security_reviews, bot_saas_management) → OFF (fail closed)
 *   - bot_readonly_ops → ON (fail open)
 *   - bot_require_human_confirm → ON (fail closed / safer)
 */

const CACHE_TTL_MS = 30_000;

/** Built-in defaults mirror the 023_app_flags.sql seed. */
const DEFAULTS = Object.freeze({
  bank_sync: true,
  invoicing: true,
  mileage: true,
  gear_depreciation: true,
  tax_review: true,
  ai_assistant: true,
  bot_security_reviews: true,
  bot_saas_management: true,
  bot_readonly_ops: true,
  bot_require_human_confirm: false,
});

const FEATURE_KEYS = Object.freeze([
  'bank_sync',
  'invoicing',
  'mileage',
  'gear_depreciation',
  'tax_review',
  'ai_assistant',
]);

const BOT_KEYS = Object.freeze([
  'bot_security_reviews',
  'bot_saas_management',
  'bot_readonly_ops',
  'bot_require_human_confirm',
]);

/** On read failure these force to the safer value instead of DEFAULTS. */
const FAIL_CLOSED_OVERRIDES = Object.freeze({
  bot_security_reviews: false,
  bot_saas_management: false,
  bot_require_human_confirm: true,
});

let _cache = null; // { flags: Record<string,boolean>, loadedAt: number, migrationPending: boolean }

function getServiceClient() {
  try {
    return require('../db').supabase;
  } catch {
    return null;
  }
}

function failSafeFlags() {
  const out = { ...DEFAULTS };
  for (const [k, v] of Object.entries(FAIL_CLOSED_OVERRIDES)) {
    out[k] = v;
  }
  return out;
}

function isCacheFresh() {
  return _cache && (Date.now() - _cache.loadedAt) < CACHE_TTL_MS;
}

/**
 * Load all flags (cached ~30s). Never throws.
 * @returns {Promise<{flags: Record<string,boolean>, migrationPending: boolean}>}
 */
async function getFlags() {
  if (isCacheFresh()) {
    return { flags: { ..._cache.flags }, migrationPending: _cache.migrationPending };
  }

  const sb = getServiceClient();
  if (!sb) {
    const flags = failSafeFlags();
    _cache = { flags, loadedAt: Date.now(), migrationPending: true };
    return { flags: { ...flags }, migrationPending: true };
  }

  try {
    const { data, error } = await sb.from('app_flags').select('key, enabled');
    if (error) {
      // Missing relation / permission → treat as migration pending
      const msg = (error.message || '').toLowerCase();
      const missing =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        msg.includes('does not exist') ||
        msg.includes('could not find the table') ||
        msg.includes('schema cache');
      const flags = failSafeFlags();
      // Features stay ON via failSafe (DEFAULTS + bot overrides). Features are already ON in DEFAULTS.
      // Re-assert feature fail-open:
      for (const k of FEATURE_KEYS) flags[k] = DEFAULTS[k];
      _cache = { flags, loadedAt: Date.now(), migrationPending: missing };
      return { flags: { ...flags }, migrationPending: missing };
    }

    const flags = { ...DEFAULTS };
    if (Array.isArray(data)) {
      for (const row of data) {
        if (row && typeof row.key === 'string' && typeof row.enabled === 'boolean') {
          flags[row.key] = row.enabled;
        }
      }
    }
    const migrationPending = !Array.isArray(data) || data.length === 0;
    // Empty table still means migration may be incomplete — use defaults but mark pending
    _cache = { flags, loadedAt: Date.now(), migrationPending: migrationPending && (!data || data.length === 0) };
    // If we got rows, not pending
    if (Array.isArray(data) && data.length > 0) {
      _cache.migrationPending = false;
    }
    return { flags: { ..._cache.flags }, migrationPending: _cache.migrationPending };
  } catch (err) {
    console.warn('[flags] read failed:', err.message);
    const flags = failSafeFlags();
    _cache = { flags, loadedAt: Date.now(), migrationPending: true };
    return { flags: { ...flags }, migrationPending: true };
  }
}

/**
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function isFlagEnabled(key) {
  if (!key || typeof key !== 'string') return false;
  const { flags } = await getFlags();
  if (Object.prototype.hasOwnProperty.call(flags, key)) {
    return !!flags[key];
  }
  // Unknown key: features-style fail open only for known feature prefix? Safer false.
  if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
    return !!DEFAULTS[key];
  }
  return false;
}

function bustFlagCache() {
  _cache = null;
}

/** Test helper — inject cache state. */
function _setCacheForTests(state) {
  _cache = state;
}

module.exports = {
  DEFAULTS,
  FEATURE_KEYS,
  BOT_KEYS,
  FAIL_CLOSED_OVERRIDES,
  CACHE_TTL_MS,
  getFlags,
  isFlagEnabled,
  bustFlagCache,
  failSafeFlags,
  _setCacheForTests,
};
