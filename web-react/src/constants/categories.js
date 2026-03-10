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
            'Internal Transfer',
            'Credit Card Payment',
            'Deposit',
        ],
    },
];

// Flat list of all known category values (for lookups / datalist)
export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.items);
