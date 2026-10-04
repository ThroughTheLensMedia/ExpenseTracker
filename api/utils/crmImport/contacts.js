'use strict';

const { readRow, clip, normName, normEmail, looksLikeEmail } = require('./common');

function composeAddress(f) {
    const cityLine = [f.address_city, [f.address_state, f.address_zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return [f.address_line1, f.address_line2, cityLine, f.address_country].filter(Boolean).join('\n');
}

// Turns CSV rows into client candidates for the existing `clients` table.
// Returns { candidates, errors }. candidate.rowNum is the 1-based data row (header excluded).
function buildClients(rows, mapping) {
    const candidates = [];
    const errors = [];

    rows.forEach((row, i) => {
        const rowNum = i + 1;
        const { fields: f, holding } = readRow(row, mapping);
        if (!Object.keys(f).length && !Object.keys(holding).length) return; // fully blank row

        const warnings = [];
        const combined = [f.first_name, f.last_name].filter(Boolean).join(' ');
        const name = clip(f.name || f.company || combined, 200);
        if (!name) { errors.push({ row: rowNum, error: 'No client name (Display Name, Company, or First/Last name is blank).' }); return; }

        // Name-fallback sources are real data; keep them reachable instead of dropping them.
        const labelOf = target => Object.keys(mapping).find(h => mapping[h] === target);
        if (f.company && f.company !== name) holding[labelOf('company') || 'Company'] = clip(f.company, 2000);
        if (combined && combined !== name) {
            if (f.first_name) holding[labelOf('first_name') || 'First name'] = clip(f.first_name, 2000);
            if (f.last_name) holding[labelOf('last_name') || 'Last name'] = clip(f.last_name, 2000);
        }

        let email = f.email ? f.email.trim() : null;
        if (email && !looksLikeEmail(email)) {
            warnings.push(`Email "${email}" doesn't look valid — kept in the holding area instead.`);
            holding[labelOf('email') || 'Email'] = clip(email, 2000);
            email = null;
        }

        let phone = f.phone || f.phone_alt || null;
        if (f.phone && f.phone_alt && f.phone !== f.phone_alt) holding[labelOf('phone_alt') || 'Mobile phone'] = clip(f.phone_alt, 2000);

        candidates.push({
            rowNum,
            record: {
                name,
                email: email ? clip(email, 254) : null,
                phone: phone ? clip(phone, 60) : null,
                address: composeAddress(f) ? clip(composeAddress(f), 500) : null,
                notes: f.notes ? clip(f.notes, 5000) : null,
            },
            legacyId: f.legacy_id ? clip(f.legacy_id, 100) : null,
            taxId: f.tax_id ? clip(f.tax_id, 64) : null,
            holding,
            warnings,
        });
    });

    return { candidates, errors };
}

// Flags candidates that already exist (in the account or earlier in the same file).
// dup.kind: 'already_imported' (same ID from the same system) | 'email' | 'name' | 'in_file'.
// Default decision: skip re-imports and in-file repeats; merge on email match; keep both on a name-only
// match (two different people can share a name — wrongly merging history is worse than a duplicate
// that the Clients page can merge later).
function findClientDuplicates(candidates, existing, sourceSystem) {
    const byLegacy = new Map();
    const byEmail = new Map();
    const byName = new Map();
    for (const c of existing) {
        if (c.legacy_id && c.import_source === sourceSystem) byLegacy.set(c.legacy_id, c);
        if (c.email) byEmail.set(normEmail(c.email), c);
        const n = normName(c.name);
        if (n && !byName.has(n)) byName.set(n, c);
    }

    const seenInFile = { legacy: new Map(), email: new Map(), name: new Map() };
    for (const cand of candidates) {
        cand.dup = null;
        const n = normName(cand.record.name);
        const e = cand.record.email ? normEmail(cand.record.email) : null;
        const hit = (kind, row, defaultDecision) => { cand.dup = { kind, existingId: row.id ?? null, existingName: row.name, existingEmail: row.email || null, defaultDecision }; };

        if (cand.legacyId && byLegacy.has(cand.legacyId)) hit('already_imported', byLegacy.get(cand.legacyId), 'skip');
        else if (e && byEmail.has(e)) hit('email', byEmail.get(e), 'merge');
        else if (n && byName.has(n)) hit('name', byName.get(n), 'keep_both');
        else if (cand.legacyId && seenInFile.legacy.has(cand.legacyId)) hit('in_file', seenInFile.legacy.get(cand.legacyId), 'skip');
        else if (e && seenInFile.email.has(e)) hit('in_file', seenInFile.email.get(e), 'skip');
        else if (n && seenInFile.name.has(n)) hit('in_file', seenInFile.name.get(n), 'skip');

        if (!cand.dup) {
            if (cand.legacyId) seenInFile.legacy.set(cand.legacyId, cand.record);
            if (e) seenInFile.email.set(e, cand.record);
            if (n) seenInFile.name.set(n, cand.record);
        }
    }
    return candidates;
}

// Fill-blanks merge: CSV values only ever populate empty fields, never overwrite what the user already has.
function mergeFill(existing, record) {
    const updates = {};
    for (const key of ['email', 'phone', 'address', 'notes']) {
        if (!existing[key] && record[key]) updates[key] = record[key];
    }
    return updates;
}

// "•••• 1234" for display — never the full value.
const maskTaxId = last4 => (last4 ? `••••${last4}` : '••••');

module.exports = { buildClients, findClientDuplicates, mergeFill, composeAddress, maskTaxId };
