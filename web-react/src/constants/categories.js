// ─── Single source of truth for all categories ──────────────────────────────
// Used by: TransactionDrawer, Rules, Transactions filter bar
// Add new categories here — they will appear everywhere automatically.

export const CATEGORY_GROUPS = [
    {
        group: 'Expenses',
        label: '── Expenses ──────────────────',
        items: [
            'Advertising',
            'Auto & Transport',
            'Bills & Utilities',
            'Camera & Equipment',
            'Clothing',
            'Dining & Drinks',
            'Education',
            'Entertainment',
            'Gas & Fuel',
            'Groceries',
            'Health & Medical',
            'Home & Garden',
            'Insurance (Business)',
            'Insurance (Personal)',
            'Office Supplies',
            'Parking & Tolls',
            'Personal Care',
            'Pets',
            'Photography',
            'Professional Services',
            'Rent / Lease',
            'Repairs & Maintenance',
            'Shopping',
            'Software & Tech',
            'Subscriptions',
            'Supplies',
            'Taxes & Licenses',
            'Travel & Vacation',
            'Personal Expense',
        ],
    },
    {
        group: 'Income',
        label: '── Income ────────────────────',
        items: [
            'Photo Income',
            'Freelance Income',
            'Contract Income',
            'Military Retirement',
            'VA Benefits',
            'Rental Income',
            'Side Income',
        ],
    },
    {
        group: 'Misc Income',
        label: '── Misc Income (non-taxable) ─',
        items: [
            'IRS Tax Refund',
            'State Tax Refund',
            'Refund',
            'Reimbursement',
            'Cashback / Rewards',
            'Interest Income',
            'Dividend Income',
            'Internal Transfer',
            'Credit Card Payment',
            'Deposit',
        ],
    },
];

// Flat list of all known category values (for lookups / datalist)
export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.items);

// ─── Category → IRS Schedule C Tax Bucket mapping ────────────────────────────
// When a user picks a category, the drawer auto-suggests the corresponding
// tax bucket. Income and ambiguous categories (Entertainment, Groceries,
// Shopping, Clothing, Health) have no mapping — user decides.
//
// Each entry: { bucket: string, pct?: number }
//   bucket — Schedule C line label
//   pct    — auto-sets business_use_pct (only Meals (50%) gets 50; all others default 100)
//
// Tax rules:
//   - Entertainment: NOT deductible post-TCJA 2018 — no auto-mapping
//   - Health & Medical: deduction lives on Sch 1 line 17, not Sch C — no mapping
//   - Home & Garden: home office uses Form 8829 — no Sch C bucket
//   - Groceries / Clothing / Shopping: personal by default — user decides
export const CATEGORY_TAX_BUCKET_MAP = {
    'Advertising':           { bucket: 'Advertising' },
    'Auto & Transport':      { bucket: 'Car and truck' },
    'Bills & Utilities':     { bucket: 'Utilities' },
    'Camera & Equipment':    { bucket: 'Supplies' },          // Section 179 / de minimis expensing
    'Dining & Drinks':       { bucket: 'Meals (50%)', pct: 50 },
    'Education':             { bucket: 'Other' },             // professional development → Other
    'Gas & Fuel':            { bucket: 'Car and truck' },
    'Insurance (Business)':  { bucket: 'Insurance' },
    'Insurance (Personal)':  { bucket: 'Personal Expense' },  // not deductible on Sch C
    'Office Supplies':       { bucket: 'Office expense' },
    'Parking & Tolls':       { bucket: 'Car and truck' },
    'Personal Care':         { bucket: 'Personal Expense' },
    'Personal Expense':      { bucket: 'Personal Expense' },
    'Pets':                  { bucket: 'Personal Expense' },
    'Photography':           { bucket: 'Supplies' },
    'Professional Services': { bucket: 'Legal and professional' },
    'Rent / Lease':          { bucket: 'Rent/lease' },
    'Repairs & Maintenance': { bucket: 'Repairs and maintenance' },
    'Software & Tech':       { bucket: 'Office expense' },
    'Subscriptions':         { bucket: 'Office expense' },
    'Supplies':              { bucket: 'Supplies' },
    'Taxes & Licenses':      { bucket: 'Taxes and licenses' },
    'Travel & Vacation':     { bucket: 'Travel' },
    // No mapping: Clothing, Entertainment, Groceries, Health & Medical,
    //             Home & Garden, Shopping — ambiguous or non-Sch-C
};
