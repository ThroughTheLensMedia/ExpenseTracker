// Shared data for the public /for/<profile> pages.
// Used by src/pages/ForProfile.jsx (the React page) and scripts/prerender-compare.js
// (writes static HTML for crawlers at build time). Plain module: no JSX, no browser APIs.
//
// Copy rules (2026-10-13): no AI claims, no tax-automation claims, no customer
// stories or testimonials, never "free trial". Only features that exist in the app:
//   invoicing + online card payment  -> pages/Invoice.jsx, pages/PayInvoice.jsx (Stripe Checkout)
//   CRM lead pipeline + clients      -> pages/CRM.jsx, pages/Clients.jsx
//   CSV import + live bank sync      -> pages/Import.jsx, components/PlaidLink.jsx
//   mileage log with IRS rate        -> pages/Mileage.jsx
//   gear depreciation (Sch. C L13)   -> pages/Assets.jsx (/equipment)
//   Schedule C category review       -> pages/Tax.jsx
//   receipt storage                  -> pages/Transactions.jsx
//   dashboard presets per profile    -> components/control-center/DashboardTab.jsx ROLE_PRESETS
// All three business profiles get the same pages; the profile changes the
// dashboard defaults (Freelancer starts with forecast and vendor-pattern cards off).
// Prices match Home.jsx PLANS, confirmed on the live site 2026-10-13.

export const FOR_SLUGS = ['photographers', 'freelancers', 'small-business'];

export const FOR_LABELS = {
  photographers: 'Photographers',
  freelancers: 'Freelancers',
  'small-business': 'Small business',
};

export const PLAN_LINE = 'Start free, no credit card. Sync is $4.99/mo for live bank sync, Core is $9/mo, and Studio is $19/mo.';

export const FOR_PAGES = {
  photographers: {
    title: 'Lumière Ledger for photographers: invoices, mileage, and gear',
    description: 'Bookkeeping for photographers and videographers: invoices clients can pay online, a lead pipeline, mileage log, and camera gear depreciation. Start free, no credit card.',
    h1: 'Lumière Ledger for photographers',
    intro: 'Lumière Ledger started as the books for a working photography business in Las Vegas. Pick the Photographer profile (it covers videographers too) and the app opens on the things a shoot-based business actually tracks: who booked, who paid, how far you drove, and what your gear is worth on paper.',
    sections: [
      { h: 'Invoices clients can pay online', p: 'Build an invoice, sign off on it, and send a link. Your client can pay by card through Stripe Checkout. Free and Sync include 5 invoices a month, Core 20, and Studio is unlimited.' },
      { h: 'A pipeline for inquiries', p: 'Track leads from first inquiry to booked in the CRM pipeline, keep a client list, and start an invoice straight from a client. Free and Sync hold 10 leads; Core and Studio are unlimited.' },
      { h: 'Gear depreciation', p: 'Log cameras, lenses, and lighting with cost and useful life, and see this year’s straight-line deduction per item. The export lines up with Schedule C, Part II, Line 13. Free and Sync track 5 items; Core and Studio are unlimited.' },
      { h: 'Mileage for shoots and scouting', p: 'Log business trips at the IRS standard mileage rate; one tap pulls in the current rate. Included on every plan.' },
      { h: 'Expenses and receipts', p: 'Import a bank CSV for free, or connect accounts for live bank sync on Sync and above. Attach receipts to transactions and review which expenses map to which Schedule C category before you hand things to your accountant.' },
    ],
  },
  freelancers: {
    title: 'Lumière Ledger for freelancers: invoicing, expenses, and mileage',
    description: 'Simple books for consultants, designers, and writers: invoices with online card payment, a client pipeline, expense tracking with optional bank sync, and a mileage log. Start free.',
    h1: 'Lumière Ledger for freelancers',
    intro: 'The Freelancer profile is for consultants, designers, writers, and anyone billing clients on their own. It starts with a lighter dashboard than the other profiles (the cash-flow forecast and vendor-pattern cards are off until you turn them on), so the first screen is income, expenses, and what’s unpaid.',
    sections: [
      { h: 'Invoicing', p: 'Create invoices, send a payment link, and let clients pay by card through Stripe Checkout. 5 invoices a month on Free and Sync, 20 on Core, unlimited on Studio.' },
      { h: 'Clients and leads', p: 'Keep a client list and a simple lead pipeline so you know what’s pending and what’s booked. 10 leads on Free and Sync; unlimited on Core and Studio.' },
      { h: 'Expenses without a bookkeeping degree', p: 'Import a bank CSV on any plan, or connect accounts for live bank sync starting at $4.99/mo. Attach receipts and see which Schedule C category each expense falls under.' },
      { h: 'Mileage', p: 'If you drive to clients, log trips at the current IRS standard rate. Included on every plan.' },
      { h: 'Equipment', p: 'Laptop, monitor, or other equipment you depreciate can go in the gear tracker, with a yearly straight-line deduction per item. 5 items on Free and Sync; unlimited on Core and Studio.' },
    ],
  },
  'small-business': {
    title: 'Lumière Ledger for small business: books without full accounting software',
    description: 'For small retail, service, and agency businesses: a transaction ledger, invoicing with online card payment, client pipeline, mileage, and equipment depreciation. Start free, no credit card.',
    h1: 'Lumière Ledger for small business',
    intro: 'The Small Business profile is for retail shops, service businesses, and small agencies that want cleaner books without moving into full accounting software. It turns on the whole dashboard: cash-flow forecast, top expense drivers, recurring subscriptions, and a quarterly tax set-aside estimate based on year-to-date profit.',
    sections: [
      { h: 'One ledger for the business', p: 'Every transaction in one place, from a bank CSV import or live bank sync (Sync and above). Attach receipts and review Schedule C categories before tax time. Lumière Ledger does not replace your accountant.' },
      { h: 'Invoicing and online payment', p: 'Send invoices with a payment link; customers pay by card through Stripe Checkout. 5 a month on Free and Sync, 20 on Core, unlimited on Studio.' },
      { h: 'Clients, leads, and vendors', p: 'A lead pipeline, a client list, and a vendor list. 10 leads on Free and Sync; unlimited on Core and Studio.' },
      { h: 'Equipment and mileage', p: 'Track equipment depreciation per item with a yearly straight-line deduction, and log business mileage at the IRS standard rate.' },
    ],
  },
};
