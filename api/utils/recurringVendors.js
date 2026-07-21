'use strict';

// Shared cadence math for recurring-vendor spend, used by both
// api/routes/metrics.js (Subscriptions Radar / Operational Intelligence)
// and api/routes/cron.js (weekly digest upcoming-bills forecast) so the
// two agree on how often a vendor actually charges instead of each
// guessing independently (the same "two routes disagree" bug class as the
// v7.14.0 NON_SPEND_CATS fix).

const CYCLE_DAYS = { monthly: 30.4368, quarterly: 91.31, annual: 365.25 };

// Determines how many days apart a vendor's charges really are.
// Explicit billing_cycle (set by the user on the transaction) always wins.
// Otherwise, with 2+ real charge dates, cadence is derived from the actual
// average gap between them. With fewer than 2 dates and no explicit cycle,
// cadence is unknown — callers fall back to their pre-existing behavior in
// that case, so a vendor nobody has touched yet doesn't change at all.
function deriveCadenceDays(dates, explicitBillingCycle) {
    if (explicitBillingCycle && CYCLE_DAYS[explicitBillingCycle]) {
        return { cadenceDays: CYCLE_DAYS[explicitBillingCycle], cadenceConfirmed: true, source: 'explicit' };
    }
    const sorted = (dates || []).filter(Boolean).slice().sort();
    if (sorted.length >= 2) {
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
            gaps.push((new Date(sorted[i]) - new Date(sorted[i - 1])) / (1000 * 60 * 60 * 24));
        }
        const cadenceDays = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        return { cadenceDays, cadenceConfirmed: true, source: 'detected' };
    }
    return { cadenceDays: null, cadenceConfirmed: false, source: 'unknown' };
}

// Converts a vendor's average cost-per-occurrence into a monthly-equivalent
// figure using its cadence. Returns the raw per-occurrence average
// unchanged when cadence is unknown — identical to the dashboard's
// pre-existing total/count math, so nothing shifts for untouched vendors.
function monthlyEquivalentCents(avgCostPerOccurrenceCents, cadenceDays) {
    if (!cadenceDays) return avgCostPerOccurrenceCents;
    return avgCostPerOccurrenceCents * (CYCLE_DAYS.monthly / cadenceDays);
}

module.exports = { CYCLE_DAYS, deriveCadenceDays, monthlyEquivalentCents };
