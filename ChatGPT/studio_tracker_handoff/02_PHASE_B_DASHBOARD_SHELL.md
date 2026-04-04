# Phase B — Dashboard Shell, Route Strategy, and Global Filters

## Goal

Create the new dashboard shell and filter architecture without removing the current dashboard.

## Deliverables

1. Preserve current route as `/dashboard-legacy`
2. Create new route as `/dashboard`
3. Build global dashboard layout and sections
4. Implement global filter state
5. Define shared data hooks/contracts for new widgets

## Required page layout

### Section A — Global Header
- page title
- date range filter
- business/personal toggle
- cash/accrual toggle if supported
- export action placeholder

### Section B — Executive Snapshot
Six KPI cards in one row on desktop.

### Section C — Performance Core
- left: monthly performance chart
- right: profitability breakdown

### Section D — Business Mix
- left: revenue by source
- right: expense by category

### Section E — Recurring Intelligence
- recurring vendor activity
- recurring monthly bills

### Section F — Action Layer
- invoice health
- upcoming obligations

### Section G — Forecast
- controls
- forecast outputs

### Section H — Drill-down tabs or lower tables
- transactions
- vendors
- categories
- clients
- invoices
- projects/shoots
- tax view

## Global filters

Required global filters:
- date range
- entity filter: all | business | personal
- basis: cash | accrual when supported
- financial class
- service type
- client
- vendor

## AG implementation instructions

1. Build the new shell before porting every widget
2. Keep filter state centralized
3. Ensure filter changes can propagate to all new modules consistently
4. Avoid hard-coding per-widget date logic
5. Keep layout responsive but optimize for desktop first

## Design direction

- keep premium dark theme
- reduce heavy blur/glow
- improve panel separation
- increase contrast for tables and data-heavy areas
- use fewer accent colors
- increase hierarchy with spacing and typography rather than decoration

## Phase exit criteria

- `/dashboard` exists and loads safely
- `/dashboard-legacy` remains available
- shared filter model works across placeholder widgets
- page structure matches the target information architecture
