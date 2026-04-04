# Phase C — Performance Core and Category Intelligence

## Goal

Build the core modules that show monthly and yearly business performance clearly.

## Deliverables

1. Executive KPI strip
2. Monthly Revenue vs Expense vs Net Profit chart
3. Profitability Breakdown chart
4. Revenue by Source module
5. Expense by Category module
6. Drill-down entry points for these modules

## 1. Executive KPI strip

Required cards:
- Gross Revenue MTD
- Net Profit MTD
- Operating Expense MTD
- Cash on Hand
- Open Receivables / Outstanding Pipeline
- Tax Reserve Status

Card requirements:
- main value
- delta vs prior month
- delta vs same period last year when available
- click action opens detail drawer or detail state

## 2. Monthly Performance Chart

Chart type:
- combo chart

Series:
- bars = revenue
- bars = expenses
- line = net profit

Modes:
- 6 months
- 12 months
- YTD
- yearly

This becomes the primary answer to: “How is the business performing?”

## 3. Profitability Breakdown

Preferred chart:
- waterfall chart or contribution bridge

Structure:
- gross revenue
- COGS / job delivery costs
- operating expenses
- owner draw
- tax reserve allocation
- retained profit

This explains what is driving margin rather than only showing a trend line.

## 4. Revenue by Source

Use a ranked horizontal bar chart.

Suggested buckets:
- weddings
- portraits
- events
- commercial
- brand storytelling
- video retainers
- licensing
- second shooting
- other

Each row should show:
- revenue amount
- percent of total revenue
- prior-period comparison

## 5. Expense by Category

Replace the doughnut chart.

Use a ranked horizontal bar chart.

Suggested categories:
- travel
- gear & equipment
- software/subscriptions
- marketing
- insurance
- contractors/assistants
- vehicle/fuel/mileage
- office/internet
- education
- meals
- owner/personal transfers
- tax payments
- other

Each row should show:
- amount
- percent of spend
- delta vs prior month

If the list gets too long, group low-concentration categories into `Other`.

## AG implementation instructions

1. Build KPI strip first
2. Build monthly performance chart second
3. Replace the doughnut chart before styling secondary details
4. Do not overuse legends; direct labels are preferred where practical
5. Ensure these modules all respond to global filters
6. Add click-to-drill behavior stub even if detail drawers are finalized later

## Phase exit criteria

- A user can understand monthly and yearly performance at first glance
- The doughnut chart is gone
- Actual revenue, expense, and profit trend are visible in one primary chart
- Expense category analysis scales beyond a few categories
