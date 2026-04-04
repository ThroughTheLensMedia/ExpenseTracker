# Phase G — QA, Reconciliation, and Cutover

## Goal

Safely move from the legacy dashboard to the new dashboard without breaking trust in the numbers.

## Deliverables

1. Reconciliation report
2. Widget-level QA pass
3. Performance check
4. Cutover recommendation

## Required QA checks

### Financial reconciliation
- compare old vs new MTD totals
- compare old vs new YTD totals
- compare category totals
- compare recurring vendor totals
- compare recurring bills predictions

### Filter consistency
- date range filters update all widgets
- business-only filter updates all widgets correctly
- personal-only filter works correctly
- financial class filters do not produce contradictory values

### Drill-down behavior
- KPI card click opens correct detail
- category click shows matching transactions
- vendor click shows matching recurring history
- month click shows matching period detail

### Performance
- dashboard load is production-acceptable
- no redundant heavy queries on initial render
- large tables paginate or virtualize if needed

## Cutover strategy

1. Keep `/dashboard-legacy`
2. Release `/dashboard` behind a feature flag if possible
3. Validate totals with real user data
4. Cut over only when reconciliation is complete
5. Leave legacy route available temporarily for confidence and rollback

## Phase exit criteria

- totals reconcile
- recurring sections behave correctly
- no major regressions
- new dashboard is ready for production default route
