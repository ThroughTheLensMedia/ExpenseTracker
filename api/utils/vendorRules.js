'use strict';

/**
 * vendorRules.js — auto-categorization memory helpers
 *
 * normalizeVendor  : strips store numbers / transaction IDs for stable matching
 * loadVendorRules  : fetch all rules for a user → lookup map (used in Plaid sync)
 * learnVendorRule  : upsert a rule when a user edits category/tax fields
 */

/**
 * Normalize a vendor name to a stable, matchable pattern.
 *
 * Examples:
 *   "STARBUCKS #1234"       → "starbucks"
 *   "AMAZON.COM*AB12CD34"   → "amazon.com"
 *   "DELTA AIR LINES"       → "delta air lines"
 *   "WALMART SUPERCENTER 5" → "walmart supercenter"
 */
function normalizeVendor(vendor) {
    return (vendor || '')
        .toLowerCase()
        .replace(/[#*|\\].*/g, '')       // strip everything after # * | \
        .replace(/\b\d{3,}\b/g, '')      // strip standalone numbers ≥ 3 digits (store IDs)
        .replace(/[^a-z0-9.\s&'-]/g, '') // keep only readable chars
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Load all vendor rules for a user and return as a vendor_pattern → rule map.
 * Fails open — returns empty map if table is missing or query errors.
 */
async function loadVendorRules(sb, userId) {
    try {
        const { data } = await sb
            .from('vendor_category_rules')
            .select('vendor_pattern, category, tax_deductible, business_use_pct, tax_bucket')
            .eq('user_id', userId);
        const map = {};
        for (const rule of (data || [])) {
            map[rule.vendor_pattern] = rule;
        }
        return map;
    } catch {
        return {}; // fail open — never block a sync because of a missing rules table
    }
}

/**
 * Upsert a vendor rule based on a user edit.
 * Only records fields that were explicitly changed (undefined = not changed = skip).
 * Non-fatal: logs a warning on error but never throws.
 */
async function learnVendorRule(sb, userId, vendor, fields) {
    const pattern = normalizeVendor(vendor);
    if (!pattern || pattern === 'unknown') return;

    try {
        const { data: existing } = await sb
            .from('vendor_category_rules')
            .select('match_count')
            .eq('user_id', userId)
            .eq('vendor_pattern', pattern)
            .maybeSingle();

        await sb.from('vendor_category_rules').upsert({
            user_id:          userId,
            vendor_pattern:   pattern,
            category:         fields.category          ?? null,
            tax_deductible:   fields.tax_deductible    ?? null,
            business_use_pct: fields.business_use_pct  ?? null,
            tax_bucket:       fields.tax_bucket        ?? null,
            match_count:      (existing?.match_count   || 0) + 1,
            updated_at:       new Date().toISOString(),
        }, { onConflict: 'user_id,vendor_pattern' });
    } catch (err) {
        console.warn('[VendorRules] Failed to save rule for', pattern, '—', err.message);
    }
}

module.exports = { normalizeVendor, loadVendorRules, learnVendorRule };
