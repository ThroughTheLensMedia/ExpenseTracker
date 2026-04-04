# Phase E — Action Layer (Receivables and Upcoming Obligations)

## Goal

Turn the dashboard into an operating tool, not just a retrospective reporting page.

## Deliverables

1. Invoice Health module
2. Upcoming Obligations module
3. Linked drill-down actions

## 1. Invoice Health

Required metrics:
- unpaid invoice total
- overdue invoice total
- invoices due this month
- average days to collect

Recommended detail table columns:
- client
- invoice amount
- due date
- aging bucket
- status

Purpose:
- make cash collection visible
- show where revenue is booked but not yet collected

## 2. Upcoming Obligations

Required items:
- recurring bills due next 14 days
- estimated taxes due
- card payments or large obligations
- annual renewals / software renewals
- insurance renewals

Recommended structure:
- action list sorted by due date
- severity or urgency indicator
- click-through to underlying vendor, bill, or obligation detail

## AG implementation instructions

1. Keep the UI compact and actionable
2. Focus on dates, amounts, and what requires attention soonest
3. Tie recurring bills into obligations where relevant
4. Ensure business-only view is supported

## Phase exit criteria

- outstanding receivables are visible
- near-term cash obligations are visible
- the dashboard now supports next actions, not just analysis
