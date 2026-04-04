# Studio Tracker Dashboard Rebuild — AG Handoff Package

This package breaks the dashboard rebuild into phased markdown files so AG can work in bounded chunks and preserve output tokens.

## Package purpose

Use this package to rebuild Studio Tracker into a financial operating dashboard for photographers while preserving the recurring-expense intelligence the user values from Rocket Money.

## Non-negotiables

- Keep **Recurring Vendor Activity**
- Keep **Recurring Monthly Bills**
- Preserve Rocket Money-style recurring expense decision support
- Prioritize actual financial performance before forecast
- Separate business and personal signals where possible
- Replace the doughnut expense chart with a ranked chart that scales
- Do not break current production behavior while rebuilding

## Recommended execution order

1. Read `00_MASTER_SPEC.md`
2. Execute `01_PHASE_A_SCHEMA_AND_METRICS.md`
3. Execute `02_PHASE_B_DASHBOARD_SHELL.md`
4. Execute `03_PHASE_C_PERFORMANCE_AND_CATEGORY_MODULES.md`
5. Execute `04_PHASE_D_RECURRING_INTELLIGENCE.md`
6. Execute `05_PHASE_E_ACTION_LAYER.md`
7. Execute `06_PHASE_F_FORECAST_AND_SCENARIOS.md`
8. Execute `07_PHASE_G_QA_AND_CUTOVER.md`
9. Validate against `08_ACCEPTANCE_CHECKLIST.md`

## Delivery discipline for AG

- Complete one phase at a time
- Do not refactor the entire app in one pass
- Reconcile totals before replacing legacy widgets
- Keep a legacy route available during migration
- Preserve current code structure unless there is a strong reason to change it
- Keep new data logic centralized instead of spreading calculations across UI components

## Expected routes

- Existing route preserved as `/dashboard-legacy`
- New route built as `/dashboard`

## Expected stack

- Frontend: React on Vercel
- Backend/data: Supabase
- Source imports: Rocket Money + manual entries

## Notes on backend UX work

A meaningful amount of backend UX work is required, but not a ground-up backend rewrite.

What is needed:
- metric definitions centralized in Supabase views or materialized views
- transaction classification cleanup
- recurring vendor / recurring bill inference support
- predictable API/data contract for dashboard widgets
- drill-down endpoints or query paths for drawers/detail tables

What is not required for this phase:
- full accounting ledger rewrite
- full bookkeeping engine
- full permissions system overhaul

See `09_BACKEND_UX_SCOPE.md` for exact backend-vs-frontend scope.
