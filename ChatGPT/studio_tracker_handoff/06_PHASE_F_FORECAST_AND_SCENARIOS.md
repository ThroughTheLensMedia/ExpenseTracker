# Phase F — Forecast and Scenario Modeling

## Goal

Move forecast below actuals and make it assumption-driven and auditable.

## Deliverables

1. Forecast controls panel
2. Forecast output cards/charts
3. Scenario presets
4. Explicit assumptions display

## Forecast principle

Forecast is secondary to actual performance.

Do not place forecast above actuals.

## Required controls
- current business cash
- pipeline conversion percentage
- average project value
- fixed monthly overhead
- projected owner draw
- tax reserve percentage

## Required scenario presets
- Conservative
- Base
- Growth

## Required outputs
- cash runway months
- projected revenue next 3 months
- projected net margin next 3 months
- best/base/worst summary if feasible

## Transparency requirements

Assumptions must be visible.
Avoid vague “AI forecast” framing without showing what drives the projection.

## AG implementation instructions

1. Reuse metrics layer inputs where possible
2. Keep forecast logic isolated from core actuals logic
3. Make assumptions editable
4. Make labels explicit and understandable

## Phase exit criteria

- actuals still dominate the dashboard
- scenario controls are editable
- outputs update predictably
- forecast is clearly assumption-based
