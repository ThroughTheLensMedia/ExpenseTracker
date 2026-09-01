'use strict';

const { normalizeVendor } = require('./vendorRules');

// Generic leading words too common to be a useful identity signal on their own.
const GENERIC_TOKENS = new Set(['the', 'and', 'inc', 'llc', 'co', 'store', 'shop', 'market', 'usa']);

// The first normalized word of a vendor string — its "core" identity once
// store numbers, transaction IDs, and punctuation-tail noise are stripped.
function coreToken(vendor) {
    const norm = normalizeVendor(vendor);
    return norm.split(' ').filter(Boolean)[0] || '';
}

/**
 * Finds an established vendor (2+ existing charges) whose core word matches
 * a new vendor string's core word, when the two full vendor strings aren't
 * already identical. Used to catch bank-descriptor variants (e.g. "HOVER
 * 4212 DR MARTIN LUTHER KI...") before they fragment into a separate,
 * invisible-to-recurring-tracking vendor bucket.
 *
 * @param {string} newVendorRaw
 * @param {{vendor: string, count: number}[]} establishedVendors
 * @returns {{vendor: string, count: number} | null}
 */
function findVendorVariantMatch(newVendorRaw, establishedVendors) {
    const newRaw = String(newVendorRaw || '').trim();
    if (!newRaw) return null;

    const newCore = coreToken(newRaw);
    if (!newCore || newCore.length < 3 || GENERIC_TOKENS.has(newCore)) return null;

    const newLower = newRaw.toLowerCase();
    for (const entry of establishedVendors) {
        const existingRaw = String(entry.vendor || '').trim();
        if (!existingRaw) continue;
        if (existingRaw.toLowerCase() === newLower) return null; // exact match already — no flag needed

        const existingCore = coreToken(existingRaw);
        if (existingCore && existingCore === newCore) {
            return entry;
        }
    }
    return null;
}

module.exports = { findVendorVariantMatch };
