# Studio Tracker Dashboard Rebuild — Master Spec

## Objective

Rebuild Studio Tracker so it works like a financial operating dashboard for a photographer/videographer owner-operator rather than a visually polished but analytically shallow dashboard.

The dashboard must answer:

- Is the business profitable this month?
- How does this month compare to prior months and prior year?
- What revenue sources are carrying the business?
- What expense categories are driving cost?
- Which recurring vendors and subscriptions should be reviewed or cancelled?
- What upcoming obligations require action?
- What does the near-term forecast look like under explicit assumptions?

## Core principles

1. Actuals before forecast
2. Business clarity over decoration
3. Preserve recurring expense intelligence
4. Support drill-down
5. Separate business and personal where possible
6. Keep the UI premium, but make the data hierarchy stronger than the visual effects

## Required dashboard layers

### Layer 1 — Executive Snapshot
Top KPI strip:
- Gross Revenue MTD
- Net Profit MTD
- Operating Expense MTD
- Cash on Hand
- Open Receivables / Outstanding Pipeline
- Tax Reserve Status

### Layer 2 — Core Performance
- Monthly Revenue vs Expense vs Net Profit combo chart
- Profitability Breakdown waterfall / contribution bridge

### Layer 3 — Business Mix
- Revenue by Source
- Expense by Category

### Layer 4 — Operational Intelligence
- Recurring Vendor Activity
- Recurring Monthly Bills

### Layer 5 — Cash, Receivables, Obligations
- Invoice Health
- Upcoming Obligations

### Layer 6 — Forecast and Scenario Modeling
- Forecast controls
- forecast outputs
- assumptions visible

## Major chart replacements

Replace:
- doughnut expense allocation

With:
- ranked horizontal bar chart

Replace:
- abstract net income line as primary performance view

With:
- monthly revenue vs expense vs net combo chart

Replace:
- oversized recurring vendor tiles as the only view

With:
- summary cards plus sortable recurring vendor table plus detail drawer

## Photographer-specific requirements

The dashboard should be capable of supporting:
- revenue by service type
- client view
- project/shoot links when available
- business vs personal separation
- recurring expense and subscription review
- tax reserve visibility
- seasonality-aware monthly/yearly performance comparison

## Global filters

Required global filters:
- date range
- business only / personal only / all
- cash vs accrual if available
- financial class
- service type
- client
- vendor

## Build policy

- Preserve current production route as legacy
- Build the new dashboard incrementally
- Reconcile all totals before cutover
- Centralize metrics in backend views, not in frontend widgets
