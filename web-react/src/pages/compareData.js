// Shared data for the public /compare pages.
// Used by src/pages/Compare.jsx (the React page) and scripts/prerender-compare.js
// (writes static HTML for crawlers at build time). Plain module: no JSX, no browser APIs.
//
// Public comparison pages. Approved to publish 2026-10-04.
// Prices below match the live homepage pricing table (Home.jsx PLANS), confirmed
// in the production bundle at https://lumiereledger.com on 2026-10-04.
// $4.99/mo is the Sync plan (live bank sync), not the only paid plan.

export const PRICE = 'Free to start. Bank sync $4.99/mo. Core $9/mo, Studio $19/mo.';

export const PROFILES = 'Photographer, Freelancer, Small Business, or Personal / Side Hustle';

export const OTHERS = [
  { slug: 'quickbooks-solopreneur', name: 'QuickBooks Solopreneur' },
  { slug: 'freshbooks', name: 'FreshBooks' },
  { slug: 'wave', name: 'Wave' },
  { slug: 'bonsai', name: 'Bonsai' },
  { slug: 'honeybook', name: 'HoneyBook' },
];

export const PAGES = {
  'quickbooks-solopreneur': {
    title: 'Lumière Ledger vs QuickBooks Solopreneur for freelancers',
    description: 'Compare Lumière Ledger and QuickBooks Solopreneur for solo freelancers. Profile-based tools, optional bank sync, free to start with bank sync at $4.99/mo — without full accounting software.',
    h1: 'Lumière Ledger vs QuickBooks Solopreneur',
    competitor: 'QuickBooks Solopreneur',
    angle: 'QuickBooks Solopreneur is still QuickBooks-shaped: one toolbox for everyone. Lumière Ledger changes the screen by the kind of work you do, so a freelancer is not wading through accountant features to find an invoice or a mileage log.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'QuickBooks wins if you need deep accounting, payroll, or a bookkeeper who already lives in QuickBooks. Lumière Ledger wins if you want a thin books layer you actually open.',
    columns: ['Lumière Ledger', 'QuickBooks Solopreneur'],
    rows: [
      ['Shows only tools for your work', 'Yes (profiles)', 'No, same toolkit'],
      ['Invoices and expenses', 'Yes', 'Yes'],
      ['Bank sync', 'Optional', 'Core'],
      ['Mileage and gear', 'Built in', 'Varies / add-ons'],
      ['Price', PRICE, 'Higher QuickBooks price'],
      ['CPA replacement', 'No', 'No'],
    ],
  },
  freshbooks: {
    title: 'Lumière Ledger vs FreshBooks for freelancers',
    description: 'See how Lumière Ledger compares to FreshBooks for invoicing, expenses, and tax-ready records — with profiles that hide tools you don’t need.',
    h1: 'Lumière Ledger vs FreshBooks',
    competitor: 'FreshBooks',
    angle: 'FreshBooks is strong on invoicing and client billing. Lumière Ledger is a fuller day-to-day ledger — mileage, gear depreciation, and tax review — that stays lighter than accounting software.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'FreshBooks wins for heavy billing and time tracking. Lumière Ledger wins when the pain is scattered books more than polished invoices.',
    columns: ['Lumière Ledger', 'FreshBooks'],
    rows: [
      ['Profile UI', 'Yes', 'No'],
      ['Invoicing', 'Yes', 'Strong'],
      ['Ledger', 'Yes', 'Yes'],
      ['Mileage and gear', 'Yes', 'Limited'],
      ['Tax review', 'Yes', 'Partial'],
      ['Price', PRICE, 'Higher paid plans'],
    ],
  },
  wave: {
    title: 'Lumière Ledger vs Wave for freelancers',
    description: 'Compare Lumière Ledger and Wave for free or cheap freelancer bookkeeping. Profiles, mileage, and gear tracking without a bloated accounting suite.',
    h1: 'Lumière Ledger vs Wave',
    competitor: 'Wave',
    angle: 'Wave is free accounting with a classic books screen. Lumière Ledger is freemium and profile-shaped: fewer menus, and a clearer sense of what fits your work.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'Wave wins for free full double-entry accounting. Lumière Ledger wins if free accounting still feels like too much software.',
    columns: ['Lumière Ledger', 'Wave'],
    rows: [
      ['Start cost', PRICE, 'Free core'],
      ['Profiles', 'Yes', 'No'],
      ['Invoicing', 'Yes', 'Yes'],
      ['Accounting depth', 'Light', 'Deeper'],
      ['Mileage and gear', 'Built in', 'Not the focus'],
      ['Best for', 'One-person freelancers who want less UI', 'People who want free traditional books'],
    ],
  },
  bonsai: {
    title: 'Lumière Ledger vs Bonsai for freelancers',
    description: 'Lumière Ledger vs Bonsai: books and tax-ready records vs contracts, proposals, and client ops. Pick based on whether your gap is money tracking or client paperwork.',
    h1: 'Lumière Ledger vs Bonsai',
    competitor: 'Bonsai',
    angle: 'These are different jobs. Bonsai is freelance operations: contracts, proposals, and client workflow. Lumière Ledger is the money side: a transaction ledger, mileage, gear depreciation, and tax review. If your gap is paperwork with clients, Bonsai is the closer fit. If your gap is the books, this is.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'Bonsai wins for contracts, proposals, and CRM. Lumière Ledger wins if you already have clients and need cleaner books for taxes. Lumière Ledger does not do contracts or proposals.',
    columns: ['Lumière Ledger', 'Bonsai'],
    rows: [
      ['Contracts and proposals', 'No', 'Yes'],
      ['Invoicing', 'Yes', 'Yes'],
      ['Tax-ready ledger', 'Yes', 'Secondary'],
      ['Mileage and gear', 'Yes', 'No'],
      ['Profiles', 'Yes', 'No'],
      ['Price', PRICE, 'Bonsai subscription'],
    ],
  },
  honeybook: {
    title: 'Lumière Ledger vs HoneyBook for freelancers',
    description: 'Lumière Ledger vs HoneyBook: books, mileage, and tax-ready records vs proposals, contracts, and client management. Pick based on whether your gap is the books or client paperwork.',
    h1: 'Lumière Ledger vs HoneyBook',
    competitor: 'HoneyBook',
    angle: 'These are different jobs. HoneyBook is client operations: proposals, contracts, invoices, scheduling, and a client list. Lumière Ledger is the money side: a transaction ledger, mileage, gear depreciation, and tax review. If your gap is booking and paperwork with clients, HoneyBook is the closer fit. If your gap is the books, this is.',
    tradeoffTitle: 'Where each one wins',
    tradeoff: 'HoneyBook wins for proposals, contracts, scheduling, and client management. Lumière Ledger wins if you already have clients and need cleaner books for taxes. Lumière Ledger does not do contracts, proposals, or scheduling.',
    columns: ['Lumière Ledger', 'HoneyBook'],
    rows: [
      ['Contracts and proposals', 'No', 'Yes'],
      ['Invoicing', 'Yes', 'Yes'],
      ['Scheduling and client management', 'No', 'Yes'],
      ['Tax-ready ledger', 'Yes', 'Not the focus'],
      ['Mileage and gear', 'Yes', 'No'],
      ['Profiles', 'Yes', 'No'],
      ['Price', PRICE, 'HoneyBook subscription'],
    ],
  },
};

export const FEATURES = [
  'Business profiles',
  'Invoicing',
  'Transaction ledger',
  'Bank import',
  'Mileage',
  'Gear depreciation',
  'Tax review',
];

export const SITE_URL = 'https://www.lumiereledger.com';

export const HUB = {
  title: 'Compare Lumière Ledger for freelancers',
  description: 'Side-by-side looks at Lumière Ledger versus QuickBooks Solopreneur, FreshBooks, Wave, Bonsai, and HoneyBook for freelancers and creatives.',
};
