# Backend UX Scope — How Much Backend Work Is Actually Needed?

## Direct answer

A moderate amount of backend UX work is required.

This is not a full backend rebuild, but it is more than a front-end reskin.

## Why

Your current problem is not just layout. It is the combination of:
- missing metric hierarchy
- inconsistent financial classification risk
- weak backend summaries for decision-grade views
- limited drill-down support
- recurring spend insights that need more explicit structure

## What must happen on the backend

### 1. Metrics layer centralization
The dashboard should stop computing major financial summaries ad hoc in UI components.

Needed:
- Supabase SQL views or materialized views
- stable summary contracts for charts and KPI cards

### 2. Transaction classification support
If business, personal, tax, owner draw, COGS, and OPEX are not cleanly represented, the dashboard will lie.

Needed:
- clearer classification fields
- business/personal toggles supported by actual data flags

### 3. Recurring inference support
Recurring Vendor Activity and Recurring Monthly Bills only become truly useful if recurrence is modeled or inferred consistently.

Needed:
- normalized vendor names
- recurring confidence score or recurring rule support
- predicted next bill logic
- cancel-candidate tagging support

### 4. Drill-down query paths
Every chart or card needs a way to open supporting records.

Needed:
- stable filtered query paths for transactions, invoices, vendors, and category views

## What does not need a major backend rewrite

- The basic app hosting model
- The Vercel/Supabase architecture
- Standard CRUD flows already in place if they are functional
- Rocket Money import concept itself, assuming it already works

## Estimated split of work

Roughly:
- 40% backend / data-contract work
- 60% front-end / interaction / dashboard composition work

That 40% backend work is critical. If AG skips it, the UI will look better but still underperform as a decision tool.

## Recommended rule

If a number appears in more than one place, it should come from the same backend summary logic.

## Bottom line

This project needs targeted backend UX work, not a backend rebuild from scratch.
The right move is:
- clean up classification
- build metrics views
- support recurring inference and drill-down
- then rebuild the UI on top of stable data contracts
