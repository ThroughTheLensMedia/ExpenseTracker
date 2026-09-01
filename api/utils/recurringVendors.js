'use strict';

// Shared cadence math for recurring-vendor spend, used by both
// api/routes/metrics.js (Subscriptions Radar / Operational Intelligence)
// and api/routes/cron.js (weekly digest upcoming-bills forecast) so the
// two agree on how often a vendor actually charges instead of each
// guessing independently (the same "two routes disagree" bug class as the
// v7.14.0 NON_SPEND_CATS fix).

const CYCLE_DAYS = { monthly: 30.4368, quarterly: 91.31, annual: 365.25 };

// Determines how many days apart a vendor's charges really are.
// Explicit billing_cycle (set by the user on the transaction) wins — but
// only when it's plausible given the vendor's real charge history. If the
// actual average gap between charges is much shorter than the explicit
// cycle implies (e.g. 3 "annual"-tagged charges landing 6-8 weeks apart),
// that's a sign this vendor bucket actually holds more than one distinct
// billed item under the same name (e.g. two separate domain renewals both
// posting as "Hover") — trusting the tag there would divide the combined
// total by too large a cycle and understate real monthly cost. In that
// case we fall back to the real average gap instead.
// With fewer than 2 dates and no explicit cycle, cadence is unknown —
// callers fall back to their pre-existing behavior in that case, so a
// vendor nobody has touched yet doesn't change at all.
function deriveCadenceDays(dates, explicitBillingCycle) {
    const explicitDays = (explicitBillingCycle && CYCLE_DAYS[explicitBillingCycle]) || null;
    const sorted = (dates || []).filter(Boolean).slice().sort();

    if (sorted.length >= 2) {
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
            gaps.push((new Date(sorted[i]) - new Date(sorted[i - 1])) / (1000 * 60 * 60 * 24));
        }
        const detectedCadenceDays = gaps.reduce((s, g) => s + g, 0) / gaps.length;

        if (explicitDays) {
            // Trust the tag only when real charges are at least roughly as
            // far apart as it claims — otherwise the tag describes one
            // item's cycle, not this vendor bucket's actual charge frequency.
            if (detectedCadenceDays >= explicitDays * 0.5) {
                return { cadenceDays: explicitDays, cadenceConfirmed: true, source: 'explicit' };
            }
            return { cadenceDays: detectedCadenceDays, cadenceConfirmed: true, source: 'detected-override' };
        }
        return { cadenceDays: detectedCadenceDays, cadenceConfirmed: true, source: 'detected' };
    }

    if (explicitDays) {
        return { cadenceDays: explicitDays, cadenceConfirmed: true, source: 'explicit' };
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
