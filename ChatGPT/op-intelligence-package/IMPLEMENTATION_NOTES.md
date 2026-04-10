# Operational Intelligence — Implementation Notes

## Build Order

### Step 1 — Remove existing top cards
Delete the current top-row large vendor cards entirely.

Do not attempt to repurpose them.
They represent the wrong information hierarchy.

---

### Step 2 — Wire summary derivations
From the recurring vendor dataset, derive:
- active subscription count
- total monthly spend
- annualized spend
- review count
- review spend total
- duplicate count
- unused count

---

### Step 3 — Build summary panel
Render the four summary metrics as the first major block under the section header.

---

### Step 4 — Build action strip
Add review, duplicate, and unused chips directly below the summary panel.

---

### Step 5 — Build top offenders snapshot
Render the three highest monthly cost vendors in a compact list.

---

### Step 6 — Keep and clean the table
Retain the table structure, but ensure:
- default sort = monthly desc
- category column exists if data is present
- flag display is compact

---

## Performance Guidance

- derive summary and offenders in memoized selectors
- do not refetch separate endpoints unless architecture requires it
- use one recurring-subscription dataset where possible
- avoid expensive recomputation during filter changes

---

## UX Guidance

This section must answer:
- total exposure
- review risk
- highest-cost targets
- filtered next actions

Anything that does not support those jobs should not ship.

---

## Copy Guidance

Use concise labels:
- Active Subscriptions
- Approx Monthly Expense
- Approx Annual Expense
- Flagged for Review
- Review Candidates
- Duplicates
- Unused
- Top Spend

Avoid verbose UI copy.

---

## Future Hook Points

Leave clean extension points for:
- sparkline trend of recurring spend
- business vs personal recurring split
- subscription health scoring
- vendor detail drawer
- AI recommendation reasons
