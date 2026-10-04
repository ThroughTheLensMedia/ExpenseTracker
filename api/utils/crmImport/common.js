'use strict';

const { HOLDING } = require('./headerMapper');

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const monthNumber = name => MONTHS[String(name).toLowerCase().slice(0, 4)] || MONTHS[String(name).toLowerCase().slice(0, 3)] || null;

const clip = (s, max) => String(s ?? '').trim().slice(0, max);

// "$1,234.56", "(12.00)", "-3" → integer cents. Returns null for blank / unparseable.
function parseMoney(raw) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim();
    if (!s) return null;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    s = s.replace(/[$€£\s]/g, '').replace(/,/g, '');
    if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
    if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.?$/.test(s)) return null;
    const cents = Math.round(parseFloat(s) * 100);
    if (!Number.isFinite(cents)) return null;
    return negative ? -cents : cents;
}

// "7.5", "7.5%" → 7.5. Returns null for blank / unparseable.
function parseNumber(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).replace(/[%,\s]/g, '');
    if (!s || !/^-?\d*\.?\d+$/.test(s)) return null;
    return parseFloat(s);
}

const parseBool = raw => /^(true|yes|y|1)$/i.test(String(raw ?? '').trim());

function validYmd(y, m, d) {
    if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Accepts YYYY-MM-DD[ time], M/D/YYYY (US), M-D-YYYY, "Sep 30, 2026", "30 Sep 2026". Returns YYYY-MM-DD or null.
function parseDate(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (m) return validYmd(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
    if (m) return validYmd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
    m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m && monthNumber(m[1])) return validYmd(+m[3], monthNumber(m[1]), +m[2]);
    m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
    if (m && monthNumber(m[2])) return validYmd(+m[3], monthNumber(m[2]), +m[1]);
    return null;
}

const normName = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normEmail = s => String(s ?? '').trim().toLowerCase();
const looksLikeEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '').trim());

// Unsafe schemes are rejected in invoice notes by the invoices route; keep imports to the same rule.
const hasUnsafeScheme = s => /javascript:|data:/i.test(String(s ?? ''));

// Builds { target → value } for one row using the first non-empty column mapped to each target,
// plus the holding values (label = original header). Targets are single-valued after finalizeMapping.
function readRow(row, mapping) {
    const fields = {};
    const holding = {};
    for (const [header, target] of Object.entries(mapping)) {
        const value = String(row[header] ?? '').trim();
        if (!value) continue;
        if (target === HOLDING) holding[header] = clip(value, 2000);
        else if (target !== '__ignore__' && fields[target] === undefined) fields[target] = value;
    }
    return { fields, holding };
}

module.exports = {
    clip, parseMoney, parseNumber, parseBool, parseDate,
    normName, normEmail, looksLikeEmail, hasUnsafeScheme, readRow,
};
