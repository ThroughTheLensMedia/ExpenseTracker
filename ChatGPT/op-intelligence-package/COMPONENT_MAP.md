# Operational Intelligence — Component Map

## Goal
Provide AG with a direct component breakdown so implementation does not require interpretation.

---

## Section Container

### `OperationalIntelligenceSection.tsx`
Owns:
- summary data fetch
- filter state
- table row data
- derived top offenders
- loading, empty, error states

### Suggested Render Order

```tsx
<OperationalIntelligenceSection>
  <SectionHeader />
  <ControlSummaryPanel />
  <SubscriptionActionStrip />
  <TopOffendersSnapshot />
  <RecurringVendorsTable />
</OperationalIntelligenceSection>
```

---

## Components

### `SectionHeader.tsx`
Displays:
- title: `Operational Intelligence`
- subtitle: `Recurring Vendors & Subscription Leakage`

No additional logic.

---

### `ControlSummaryPanel.tsx`
Props:

```ts
{
  summary: SubscriptionSummary
  monthDelta?: number
}
```

Renders:
- active subscriptions
- approx monthly expense
- approx annual expense
- flagged review count and monthly amount

Notes:
- monthly expense is visually primary
- flagged review metric uses warning treatment

---

### `SubscriptionActionStrip.tsx`
Props:

```ts
{
  reviewCount: number
  duplicateCount: number
  unusedCount: number
  activeFilter: 'all' | 'review' | 'duplicate' | 'unused'
  onChange: (filter: 'all' | 'review' | 'duplicate' | 'unused') => void
}
```

Renders compact filter buttons.

Behavior:
- single active filter for phase 1
- clicking active filter again may reset to `all`

---

### `TopOffendersSnapshot.tsx`
Props:

```ts
{
  offenders: Array<{ id: string; vendor: string; monthly_cost: number }>
  onSelectVendor?: (id: string) => void
}
```

Rules:
- max 3 items
- sorted desc by monthly cost
- compact presentation only

---

### `RecurringVendorsTable.tsx`
Props:

```ts
{
  rows: SubscriptionRow[]
  onFlagClick?: (flag: SubscriptionRow['flag']) => void
}
```

Columns:
- vendor
- estimated monthly
- projected annual
- category
- flag

Rules:
- default sort by monthly_cost desc
- support filtered row set from parent

---

## Suggested Local State

Inside `OperationalIntelligenceSection.tsx`:

```ts
const [activeFilter, setActiveFilter] = useState<'all' | 'review' | 'duplicate' | 'unused'>('all')
```

Derived rows:

```ts
const filteredRows = useMemo(() => {
  switch (activeFilter) {
    case 'review':
      return rows.filter(r => r.flag === 'review')
    case 'duplicate':
      return rows.filter(r => r.flag === 'duplicate' || !!r.duplicate_group)
    case 'unused':
      return rows.filter(r => r.flag === 'unused')
    default:
      return rows
  }
}, [rows, activeFilter])
```

---

## Suggested Styling Pattern

- Use one outer section card/container
- Summary panel should feel like a dashboard strip, not nested cards inside cards
- Keep offender list visually lighter than table
- Avoid oversized badges
- Avoid three separate hero cards

---

## Responsive Mapping

### Desktop
- Summary panel: 4 columns
- Action strip: single row
- Top offenders: full-width compact row or slim block

### Tablet
- Summary panel: 2x2 grid
- Action strip: wraps

### Mobile
- Summary panel: stacked metric blocks
- Action strip: horizontal scroll pills
- Table: condensed or scroll container
