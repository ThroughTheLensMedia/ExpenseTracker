# Phase A — Schema Audit, Data Contracts, and Metrics Layer

## Goal

Create the backend foundation required for a financially reliable dashboard without breaking the current app.

## Why this phase exists

The current dashboard likely mixes visualization logic and business logic too loosely. The new dashboard will fail if AG changes the UI before the data contract is made explicit.

## Deliverables

1. Schema audit of current Supabase tables and views
2. Inventory of current dashboard queries
3. Gap analysis against required metrics
4. New or updated classification fields on transactions
5. Aggregate metrics views in Supabase
6. Reconciliation report against current totals

## Required table/entity coverage

Core entities expected:
- transactions
- categories
- vendors
- clients
- projects or shoots if present
- invoices
- recurring rules or recurring inference support
- account balances
- forecast scenarios
- tax reserve snapshots

## Required transaction fields

Each transaction should support or be inferable into:
- `transaction_date`
- `amount`
- `transaction_type` = income | expense | transfer
- `business_flag` = business | personal | split
- `financial_class` = revenue | cogs | opex | owner_draw | tax | reimbursable
- `category_id`
- `vendor_id`
- `client_id` nullable
- `project_id` nullable
- `service_type` nullable
- `recurring_flag`
- `reviewed_flag`
- `cancel_candidate_flag`
- `excluded_from_business_analytics`
- `receipt_url` nullable
- `rocket_money_source_id` nullable

## Required vendor fields

- `vendor_normalized_name`
- `recurring_confidence_score`
- `business_default_flag`
- `cancellation_status`
- `active_flag`

## Metrics views to build

### `monthly_financial_summary`
By month:
- revenue_total
- cogs_total
- opex_total
- owner_draw_total
- tax_total
- net_profit
- gross_margin
- net_margin
- business_expense_total
- personal_expense_total

### `category_spend_summary`
By category and date range:
- amount
- percent_total
- prior_period_amount
- delta_amount
- delta_percent

### `revenue_source_summary`
By service type or source:
- revenue_total
- percent_total
- prior_period_total
- delta_percent

### `recurring_vendor_summary`
- vendor
- category
- tx_count
- rolling_monthly_avg
- last_charge_amount
- allocation_percent
- trend_direction
- cancel_candidate_flag

### `recurring_bills_summary`
- vendor
- category
- last_billed_date
- next_expected_date
- expected_amount
- trend_direction
- business_flag

### `invoice_aging_summary`
- unpaid_total
- overdue_total
- due_this_month_total
- avg_days_to_collect
- aging_buckets

### `cash_runway_summary`
- current_cash
- avg_monthly_business_burn
- runway_months

### `tax_reserve_summary`
- current_reserved
- target_reserved
- reserve_gap

## AG implementation instructions

1. Audit the current schema first
2. Do not rename major production tables unless necessary
3. Prefer additive changes over destructive changes
4. Use SQL views or materialized views for metrics
5. Keep business logic centralized in database views or backend helpers
6. Produce a simple reconciliation note showing where old totals and new totals match or differ

## Phase exit criteria

- Views exist for all required summaries
- Current dashboard totals can be reconciled to new summary logic
- Transaction classification model is explicit enough to support the new UI
- No production route is broken
