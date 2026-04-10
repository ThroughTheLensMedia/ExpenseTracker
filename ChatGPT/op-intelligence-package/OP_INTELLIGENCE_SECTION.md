# Operational Intelligence — Section Build Spec

## Objective

Rebuild the current **Operational Intelligence** section into a compact, decision-first control surface for recurring vendor and subscription review.

This section must:
- remove the current top-row vendor cards
- replace them with a single summary panel that communicates exposure at a glance
- preserve the table as the core analysis surface
- prioritize actionability over decorative UI
- support future Rocket Money import logic and manual classification

---

## Product Goal

The user should be able to answer these questions within 3 seconds:
- How many recurring subscriptions do I currently have?
- What do they cost me monthly?
- What is the annual drag?
- How much of that spend is potentially waste or needs review?
- Which items should I inspect first?

---

## Final Section Structure

```text
Operational Intelligence
├── Summary Control Panel
├── Action Filter Strip
├── Top Offenders Snapshot
└── Recurring Vendors Table
```

---

## 1. Summary Control Panel

### Purpose
Replace the current three large vendor cards with a single compact panel that surfaces the key exposure metrics.

### Required Metrics

1. **Active Subscriptions**
   - integer count of active recurring items
   - optional subtext: delta vs previous month

2. **Approx Monthly Expense**
   - total recurring monthly spend
   - this is the primary KPI in the panel

3. **Approx Annual Expense**
   - monthly recurring total × 12
   - label this as committed annual exposure

4. **Flagged for Review**
   - count of subscriptions flagged for review
   - optional paired value: total monthly spend associated with flagged subscriptions

### Recommended Display

```text
[ 14 Active ]   [ $742/mo ]   [ $8,904/yr ]   [ 6 Review | $186/mo ]
```

### UX Rules
- one panel only
- no stacked vendor cards
- no duplicated subscription labels
- monthly spend should carry the strongest visual emphasis
- flagged review should use warning accent styling
- the panel should fit in a single row on desktop and stack cleanly on tablet/mobile

---

## 2. Action Filter Strip

### Purpose
Provide one-click filters that narrow the table to items requiring attention.

### Actions

1. **Review Candidates**
   - subscriptions flagged as review

2. **Duplicates**
   - subscriptions assigned to a duplicate group or possible overlap cluster

3. **Unused**
   - subscriptions with low or no recent usage signal
   - if no usage tracking exists yet, allow placeholder logic with manual flag support

### Recommended Display

```text
[ Review Candidates: 6 ] [ Duplicates: 1 ] [ Unused: 2 ]
```

### UX Rules
- each chip/button filters the table below
- selected filter should visibly persist until cleared
- user should be able to stack filters later, but phase 1 can use single-filter mode
- this strip sits directly below the summary panel

---

## 3. Top Offenders Snapshot

### Purpose
Quickly identify the highest recurring monthly costs without wasting space on card UI.

### Logic
- sort subscriptions by estimated monthly cost descending
- show top 3 only
- clicking an item filters or scroll-focuses table row

### Recommended Display

```text
Top Spend
Elite Options — $219/mo
Venmo — $198/mo
T-Mobile — $173/mo
```

### UX Rules
- use compact inline or slim vertical list
- do not render as cards
- this is a support element, not the hero element

---

## 4. Recurring Vendors Table

### Purpose
This remains the primary analysis area.

### Required Columns
- Vendor
- Est. Monthly
- Projected Annual
- Category
- Flag

### Optional Columns
- Last Used
- Notes
- Source

### Default Sort
- Est. Monthly descending

### Flag Values
- `none`
- `review`
- `duplicate`
- `unused`

### Rules
- annual projection = monthly × 12
- category should support business vs personal grouping later
- flag should be compact and color-coded
- clicking a flag can apply a matching filter

---

## 5. Visual Design Direction

### What to Remove
- the current three large vendor cards at the top
- redundant micro-labels like `subscription` or `recurring vendor` when the entire section already implies that state
- multi-badge clutter that competes with the table

### What to Keep
- dark premium styling
- strong contrast for financial numbers
- clean table rhythm
- emphasis on scan speed and operational clarity

### Design Principle
This section should feel like a **financial operations console**, not a consumer subscription gallery.

---

## 6. Layout Guidance

### Desktop
- summary panel spans full width
- action strip below summary panel
- top offenders snapshot can sit inline below strip or aligned right depending on available width
- table occupies the remainder of the section

### Tablet
- summary panel may collapse into 2x2 metric grid
- action strip remains horizontal if possible; wrap if needed
- table remains scrollable

### Mobile
- summary metrics stack into cards or compact metric blocks
- action strip becomes horizontally scrollable pills
- table may require condensed columns

---

## 7. Data Contract

```ts
export type SubscriptionRow = {
  id: string
  vendor: string
  monthly_cost: number
  annual_cost: number
  category?: string | null
  flag: 'none' | 'review' | 'duplicate' | 'unused'
  duplicate_group?: string | null
  last_used_at?: string | null
  notes?: string | null
}

export type SubscriptionSummary = {
  active_count: number
  monthly_total: number
  annual_total: number
  review_count: number
  review_monthly_total: number
  duplicate_count: number
  unused_count: number
}
```

---

## 8. Derived Logic

### Summary Values
- `active_count` = count of recurring rows
- `monthly_total` = sum of monthly_cost
- `annual_total` = monthly_total × 12
- `review_count` = count where flag = review
- `review_monthly_total` = sum monthly_cost where flag = review
- `duplicate_count` = count where flag = duplicate or duplicate_group is not null
- `unused_count` = count where flag = unused

### Top Offenders
- order by monthly_cost desc
- limit 3

---

## 9. Empty, Loading, and Error States

### Loading
- skeleton metrics for summary panel
- 3 skeleton action chips
- 3 skeleton offender lines
- table skeleton rows

### Empty
Display:
- `No recurring vendors detected yet.`
- secondary text: `Import Rocket Money data or add recurring expenses manually.`

### Error
Display:
- `Unable to load operational intelligence.`
- include retry action

---

## 10. Acceptance Criteria

The section is complete when:
- the current top vendor cards are fully removed
- the new summary panel displays subscription count, monthly expense, annual expense, and review exposure
- the action strip filters the table
- the top offenders list shows the 3 highest-cost items
- the table remains the main analysis surface
- the section consumes less vertical space than the current version
- the section reads clearly in under 3 seconds on desktop

---

## 11. Out of Scope for This Build

Do not build in this pass:
- cancellation workflows
- AI recommendation copy
- detailed vendor drill-down drawer
- historical trend charts
- usage telemetry ingestion

Those can be added later after this layout is stable.
