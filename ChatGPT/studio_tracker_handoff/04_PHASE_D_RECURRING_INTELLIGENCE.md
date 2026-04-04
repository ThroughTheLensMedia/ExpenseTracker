# Phase D — Recurring Intelligence (Preserve Rocket Money Utility)

## Goal

Keep and improve the recurring-spend intelligence the user explicitly wants.

This phase is not optional.

## Product requirement

The user values these sections because they drive recurring expense decisions:
- what subscriptions exist
- what recurring vendors are active
- what should be reviewed or cancelled
- what may be personal leakage in business tracking

## Deliverables

1. Rebuilt `Recurring Vendor Activity` section
2. Rebuilt `Recurring Monthly Bills` section
3. Vendor detail drawer
4. Cancel-candidate tagging flow
5. Business/personal filtering support

## 1. Recurring Vendor Activity

Keep this module on the dashboard.

### Purpose
- identify recurring spend concentration
- surface subscription/cancellation opportunities
- show stable vs increasing recurring vendors
- show possible duplicate or personal leakage patterns

### Recommended structure
Top area:
- compact summary cards for top 3 recurring vendors

Main area:
- sortable recurring vendor table

### Required columns
- vendor
- category
- transaction count in selected period
- last charge amount
- monthly average
- allocation percentage of recurring spend
- 3-month trend direction
- review status
- action

### Required statuses
- Stable
- Increasing
- New
- Duplicate Risk
- Personal Leak
- Review

### Required actions
- Review
- Mark Keep
- Mark Cancel Candidate
- Exclude from business reporting
- Open vendor detail

### Vendor detail drawer
Must show:
- last 12 charges
- average monthly spend
- category history
- linked transactions
- business/personal classification
- suggested action state

## 2. Recurring Monthly Bills

Keep this module on the dashboard.

### Purpose
- identify fixed monthly obligations
- show due timing and current cost
- support overhead control and subscription cancellation decisions

### Required columns
- vendor
- category
- last billed date
- estimated next amount
- estimated next bill date
- business/personal flag
- trend vs prior period
- action

### Required filters
- All
- Business only
- Personal only
- Cancel candidates
- Upcoming within 7 days
- Upcoming within 30 days

### Required actions
- Review
- View transactions
- Mark cancel candidate
- Confirm cancelled
- Reclassify category

### Summary banner
At top of section, show:
- total recurring monthly spend
- business recurring spend
- personal recurring spend
- highest recurring vendor
- number of cancel candidates

## Rocket Money handling requirements

The import pipeline should preserve or infer:
- normalized vendor names
- recurring payment cadence
- rolling average amount
- business/personal classification suggestion
- cancel-candidate tagging

Where recurrence confidence is low, show `Review` instead of suppressing the record.

## AG implementation instructions

1. Do not remove these sections during redesign
2. Improve structure and actionability rather than making them purely decorative
3. Preserve current Rocket Money value proposition
4. Make recurring tables sortable and filterable
5. Make vendor detail accessible without full-page navigation

## Phase exit criteria

- recurring sections remain visible and useful
- subscription review is easier than in the current dashboard
- cancel candidates can be flagged
- business/personal recurring leakage can be identified
