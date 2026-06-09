import React from 'react';

const RELEASES = [
    { version: '7.9.9', date: 'JUN 9, 2026', color: '#4ade80', items: [
        '<strong>Receipt Email — HTML Receipts for Attachment-Free Emails:</strong> When you forward an order confirmation email with no image or PDF attached (common with Shopify, Etsy, and other retailers), the system now generates and saves a clean HTML receipt card as the document. The transaction drawer will show the attached receipt instead of prompting you to upload manually.',
    ]},
    { version: '7.9.8', date: 'JUN 9, 2026', color: '#4ade80', items: [
        '<strong>Receipt Email — Gemini Retry:</strong> If the AI model is temporarily unavailable (503 high demand), the system now retries up to 3 times with backoff before giving up. Fixes cases where a valid receipt email failed due to a momentary Gemini outage.',
        '<strong>Receipt Email — Better Failure Message:</strong> When the AI is unavailable after all retries, you now get a clear email explaining the issue — "AI service was temporarily unavailable due to high demand" — with a prompt to forward again later instead of a generic failure message.',
    ]},
    { version: '7.9.7', date: 'JUN 9, 2026', color: '#a78bfa', items: [
        '<strong>Invite Plan Fix:</strong> When an admin assigns a plan (Lifetime, Core, Sync, etc.) to an invite code, the recipient now gets exactly that plan activated on signup — previously everyone defaulted to 90-Day Beta Access.',
        '<strong>Invite Notes:</strong> Admin can now attach an internal note to each invite code (who they are, why they got access) — never sent to the recipient, visible in the Access Inventory table.',
        '<strong>Engagement Pulse — Tier Badges:</strong> Each user row in Engagement Pulse now shows their plan tier (FREE / CORE / STUDIO / LIFETIME / SYNC) as a colored badge next to their name.',
        '<strong>Invite Email — Plan Shown:</strong> The invite email now includes the recipient\'s assigned access level so they know what plan they\'re activating.',
    ]},
    { version: '7.9.6', date: 'JUN 9, 2026', color: '#4ade80', items: [
        '<strong>Sync Plan Account Limit:</strong> The Sync plan ($4.99/mo) now allows up to 5 connected bank or credit card accounts. If you hit the limit, a clear upgrade prompt appears with Core and Studio options. Core and Studio plans have unlimited connections.',
        '<strong>Gear Depreciation Icon:</strong> The Gear Depreciation feature card on the landing page now uses a wrench icon instead of a camera — better reflects the tool\'s purpose for all equipment types.',
        '<strong>Pricing Table Updated:</strong> The Live Bank Sync row now shows "Up to 5 accounts" for the Sync plan, so the limit is visible before you subscribe.',
    ]},
    { version: '7.9.5', date: 'JUN 9, 2026', color: '#38bdf8', items: [
        '<strong>Open Signup:</strong> New users can now create a free account directly from the login page — no invite code required. Two paths: "Create a Free Account" for open signup, or "Have an invite code? Sign Up" for users with a code.',
        '<strong>Invite Code Auto-Activation:</strong> If you sign up with an invite code, your plan is automatically applied after you confirm your email and log in — no manual redemption step.',
        '<strong>Code Validation:</strong> Invite codes are verified server-side before your account is created, so invalid or expired codes are caught immediately.',
        '<strong>SaaS Admin — Member Details:</strong> Active Ledger Members now shows each user\'s effective tier (FREE/CORE/STUDIO), estimated monthly revenue (plan + Plaid fees), number of Plaid accounts, and join date.',
    ]},
    { version: '7.9.4', date: 'JUN 8, 2026', color: '#4ade80', items: [
        '<strong>Dashboard Gear Panel — Fixed:</strong> The ⚙️ Show/Hide settings panel now floats correctly above the KPI tiles instead of rendering behind them.',
    ]},
    { version: '7.9.3', date: 'JUN 8, 2026', color: '#f97316', items: [
        '<strong>Dashboard Widget Panel — Fixed:</strong> The ⚙️ gear panel on the dashboard now shows all 6 widget toggles without being cut off.',
        '<strong>Control Center — Reorganized:</strong> Pill buttons are now in alphabetical order. Feedback has moved into Help Center (bottom section). The three admin tabs (SaaS, Logs, Security) are consolidated into a single Admin tab with internal sub-navigation.',
        '<strong>Admin Indicator:</strong> The Admin pill has an orange dot to clearly mark it as admin-only.',
        '<strong>License Key Activation:</strong> Account Plans page now includes a "Redeem Key" field — no admin access needed.',
        '<strong>Vendor Autocomplete:</strong> The Vendor Keyword field in Automation now suggests vendors from your transaction ledger as you type.',
    ]},
    { version: '7.9.2', date: 'JUN 8, 2026', color: '#4ade80', items: [
        '<strong>Account Plans — Fixed Navigation:</strong> The Account Plans link in the menu now opens a clean billing view showing only your subscription, plan tier, and upgrade options — no business form mixed in.',
    ]},
    { version: '7.9.1', date: 'JUN 8, 2026', color: '#38bdf8', items: [
        '<strong>Dashboard Customization:</strong> Your dashboard is now personalized to you. New users are asked to pick their business type during onboarding (Photographer/Videographer, Freelancer, Small Business, or Personal/Side Hustle) — your choice sets the default sections that appear.',
        '<strong>Widget Toggles:</strong> A new ⚙️ gear icon in the dashboard header lets you show or hide any section: Invoice & Receivables, Year-End Forecast, Monthly Performance, Financial Insights, Top Expense Drivers, and Operational Intelligence. Changes save instantly.',
        '<strong>Control Center → Dashboard Tab:</strong> A new Dashboard tab in the Ledger Control Center lets you change your business type and adjust widget visibility from one place.',
        '<strong>Smart Empty States:</strong> Sections with no data now show a helpful prompt instead of empty tiles — guiding you to send your first invoice, import transactions, or add data to see insights.',
    ]},
    { version: '7.8.99', date: 'JUN 8, 2026', color: '#f97316', items: [
        '<strong>Flag for Review:</strong> Any transaction can now be manually flagged for follow-up. Open the drawer and check "🚩 Review" — the transaction lights up orange and appears under the existing "Needs Review" filter on the Transaction Ledger. Useful for flagging Plaid transactions that haven\'t posted to your card yet, or anything else you want to circle back on.',
    ]},
    { version: '7.8.98', date: 'JUN 8, 2026', color: '#a78bfa', items: [
        '<strong>Security Checklist Upgraded:</strong> Every checklist item now has sub-bullets. Terminal commands appear as copyable code blocks — click Copy and paste straight into your terminal. Dashboard links (Vercel, Supabase, UptimeRobot, Stripe, etc.) open directly in a new tab. Covers all 5 review tiers.',
    ]},
    { version: '7.8.97', date: 'JUN 8, 2026', color: '#4ade80', items: [
        '<strong>Security Tab — Fixed:</strong> The Security Review tab was returning a 404 error due to a routing conflict in the backend. Fixed — the tab now loads correctly and shows all 5 review tiers.',
    ]},
    { version: '7.8.96', date: 'JUN 8, 2026', color: '#4ade80', items: [
        '<strong>Receipt Email — Better Parsing:</strong> The AI now recognizes more label formats when extracting totals from forwarded emails — including "Total Paid", "Amount Due", "Grand Total", "Order Total", and "You Paid". Fixes cases where a valid total was present but returned as not found.',
        '<strong>Receipt Email — Error Visibility:</strong> When the AI fails to parse a forwarded email, the exact failure reason now appears in System Logs instead of a silent null. Easier to diagnose forwarding issues.',
        '<strong>Security Tab — Fixed:</strong> The Security Review tab was showing blank after navigating to it directly. Fixed — the tab now loads correctly from a direct link or page reload.',
        '<strong>Onboarding — Receipt Forwarding Step:</strong> A new "Set Up Receipt Forwarding" step now appears in the setup checklist. Links to the Integrations tab where your unique forwarding address is shown.',
    ]},
    { version: '7.8.95', date: 'JUN 8, 2026', color: '#a78bfa', items: [
        '<strong>Security Review Tab:</strong> A new "Security" tab in the Ledger Control Center (admin-only) tracks your security review cadence. See which reviews are overdue, expand checklists for each tier, mark reviews complete with optional notes, and browse completion history.',
        '<strong>Per-User Receipt Addresses:</strong> Each user now has their own unique email forwarding address for receipt capture. Your personal address is shown in the Integrations tab — copy it and save it as a contact.',
        '<strong>Receipt Cleanup:</strong> When you manually upload a receipt to a transaction, any matching pending receipt from the email pipeline is now automatically cleared from the Pending Receipts banner.',
        '<strong>Reliability:</strong> Replaced background email queue (Bull) with a direct retry system — up to 3 attempts per send. Simpler, more reliable, no infrastructure required.',
    ]},
    { version: '7.8.89', date: 'JUN 8, 2026', color: '#4ade80', items: [
        '<strong>Receipt Upload Fixed:</strong> Large JPEG receipts (phone photos, browser screenshots) now compress automatically in your browser before uploading. Fixes the issue where attaching a receipt appeared to work but disappeared on refresh. Images over 1MB are resized to 1920px and re-encoded — quality stays sharp, file size drops under 1MB.',
    ]},
    { version: '7.8.88', date: 'JUN 8, 2026', color: '#38bdf8', items: [
        '<strong>Receipt Email Sessions:</strong> System Logs now opens on a grouped "Receipt Email Sessions" view. Every forwarded email gets one card showing subject, vendor, amount, date, category, AI confidence, match result, and outcome — matched, pending, failed, or error. Click to expand and see the full breakdown and raw log events. No more hunting through individual rows.',
    ]},
    { version: '7.8.87', date: 'JUN 8, 2026', color: '#38bdf8', items: [
        '<strong>System Logs Viewer:</strong> A new "System Logs" tab in the Ledger Control Center lets you see all backend events in real time — receipt email processing, Plaid sync, errors, and more. Filter by source, level (error/warn/info), and time window. Click any row to expand its full detail data. Auto-refreshes every 30 seconds.',
    ]},
    { version: '7.8.86', date: 'JUN 8, 2026', color: '#4ade80', items: [
        '<strong>Receipt Email — Result Email Fixed (Again):</strong> The "Receipt Matched" and "Receipt Saved" follow-up emails were still not delivering. Root cause: the email send was fire-and-forget — the server finished its work and shut down before the email could go out. Fixed. All result emails are now fully awaited before the handler exits.',
    ]},
    { version: '7.8.85', date: 'JUN 8, 2026', color: '#818cf8', items: [
        '<strong>Pending Receipts:</strong> Forwarded receipt emails that couldn\'t be auto-matched now appear in a new section at the top of the Transaction Ledger. Each one shows the vendor, amount, and email subject — with buttons to view the receipt file, manually link it to any transaction, or dismiss it.',
        '<strong>Smart Link Picker:</strong> Clicking "Link to Transaction" expands an inline search panel showing nearby unlinked transactions. Exact amount matches are highlighted in green for quick identification.',
    ]},
    { version: '7.8.84', date: 'JUN 7, 2026', color: '#4ade80', items: [
        '<strong>Receipt Email — Result Email Fixed:</strong> You were getting the instant "Receipt Received" confirmation but never the follow-up result. Vercel was freezing the server process after sending that first reply, before the AI could finish. Fixed — both emails now always deliver.',
    ]},
    { version: '7.8.83', date: 'JUN 7, 2026', color: '#4ade80', items: [
        '<strong>Receipt Email — Better Matching:</strong> Forwarded receipts now match bank transactions up to 7 days apart instead of 3. Fixes cases where an invoice date (e.g. June 1) doesn\'t line up with when the charge actually posts to your card (e.g. June 7).',
    ]},
    { version: '7.8.82', date: 'JUN 7, 2026', color: '#4ade80', items: [
        '<strong>Receipt Email — Instant Reply:</strong> You now get a "Receipt Received" email within seconds of forwarding. A second email follows with the full result once the AI matches it to a transaction.',
        '<strong>Receipt Email — Timeout Fixed:</strong> The server function timeout was silently killing email processing before it could finish. Extended to 60 seconds — the full Gemini + match + reply flow now completes reliably.',
    ]},
    { version: '7.8.81', date: 'JUN 6, 2026', color: '#4ade80', items: [
        '<strong>Receipt Email — Root Cause Fixed:</strong> Every forwarded receipt was silently failing due to a stale database connection in the email handler. Fixed. The handler now opens a fresh connection on every email, the same way every other route works.',
    ]},
    { version: '7.8.80', date: 'JUN 6, 2026', color: '#4ade80', items: [
        '<strong>Email Receipts — Gemini Retry:</strong> Transient Gemini outages (503 overload) now retry automatically up to 3 times before giving up. Previously a single overload silently dropped the parse.',
        '<strong>Email Receipts — Delivery Logging:</strong> Confirmation emails now log delivery status so failures are visible in logs instead of disappearing silently.',
        '<strong>Transactions Filter:</strong> Date pickers and quick-range buttons are now grouped in a single clean row.',
    ]},
    { version: '7.8.79', date: 'JUN 6, 2026', color: '#4ade80', items: [
        '<strong>Smarter Receipt Emails:</strong> Forwarding a receipt for a transaction that already has one now sends a clear "Receipt already on file" reply — no duplicate pending receipt created.',
        '<strong>Transactions Page — 90-Day Default:</strong> The ledger now loads the last 90 days on open instead of all 3,600+ rows. Loads significantly faster. Added quick-range buttons: 30d / 90d / YTD / All.',
    ]},
    { version: '7.8.78', date: 'JUN 7, 2026', color: '#4ade80', items: [
        '<strong>Email System Fixed:</strong> A dependency packaging bug was preventing all emails from sending — receipt confirmations, invoice notifications, and account request alerts were silently failing. Fixed. Receipt email forwarding, invoice emails, and all other email features are now working.',
    ]},
    { version: '7.8.71', date: 'JUN 6, 2026', color: '#4ade80', items: [
        '<strong>Document View Fixed:</strong> The 📄 View button now appears after uploading a PDF or image. A Storage permission issue was silently preventing the file from saving — fixed.',
    ]},
    { version: '7.8.70', date: 'JUN 6, 2026', color: '#818cf8', items: [
        '<strong>Documents Tab Polish:</strong> Removing a document now shows a styled confirmation dialog instead of a plain browser popup. Upload results display as clear green (success) or red (error) banners so you know the upload worked at a glance.',
        '<strong>Renamed "Indexed Documents" → "My Documents"</strong> — cleaner label.',
    ]},
    { version: '7.8.69', date: 'JUN 6, 2026', color: '#4ade80', items: [
        '<strong>Document Upload Fixed:</strong> PDF and image documents can now be uploaded and read by Brain without any API key restrictions. The underlying embedding system has been replaced with a simpler, more reliable approach.',
        '<strong>View Original:</strong> Each uploaded document now has a 📄 View button that opens the original PDF or image in a new tab — so you can reference your insurance policy, warranty, or contract directly.',
        '<strong>Gemini Key No Longer Required for PDFs:</strong> Only image uploads need your Gemini API key (for text extraction via Vision). PDFs can be uploaded without it.',
    ]},
    { version: '7.8.67', date: 'JUN 6, 2026', color: '#f97316', items: [
        '<strong>Receipt Email — Direct Transaction Link:</strong> The "View Transaction" button in receipt confirmation emails now opens the exact transaction and pops the edit drawer — no searching required.',
        '<strong>Document Indexing Fixed:</strong> Uploading PDFs for Brain to index was broken due to a Google API version mismatch. Fixed — documents can now be uploaded and queried again.',
    ]},
    { version: '7.8.66', date: 'JUN 6, 2026', color: '#f59e0b', items: [
        '<strong>Resume Setup from Help Center:</strong> A new "Resume Setup Checklist" button in Help Center reopens the setup guide right where you left off — drops you directly onto the checklist with your previous progress intact.',
    ]},
    { version: '7.8.65', date: 'JUN 6, 2026', color: '#4ade80', items: [
        '<strong>Welcome Screen Fix:</strong> The "Welcome to Lumière Ledger" setup screen no longer pops up every time you open the app on mobile. Once you dismiss it, it stays gone — even if your phone clears local storage.',
    ]},
    { version: '7.8.60', date: 'JUN 6, 2026', color: '#38bdf8', items: [
        '<strong>Plaid Balance Cost Control:</strong> Live account balances are now cached for 10 days. The app was calling Plaid\'s balance API (billed at $0.10/call) on every page load — now it only calls when the cache expires or you hit Sync.',
        '<strong>Sync clears balance cache:</strong> Hitting the Sync button pulls fresh transactions and resets the balance cache so your next visit shows updated balances.',
        '<strong>Transactions unchanged:</strong> Transaction sync is a flat monthly fee per account — unaffected by how often you sync.',
    ]},
    { version: '7.8.59', date: 'JUN 5, 2026', color: '#4ade80', items: [
        '<strong>Error Tracking:</strong> Sentry now captures frontend crashes, unhandled errors, and failed API calls with full stack traces and user context.',
        '<strong>Structured Logging:</strong> Backend errors stream to Logtail with path, method, and user ID — no more digging through raw Vercel logs.',
    ]},
    { version: '7.8.58', date: 'JUN 5, 2026', color: '#f59e0b', items: [
        '<strong>Email Receipt Forwarding:</strong> Forward any receipt email to the address shown in Control Center → Integrations and it\'s automatically parsed and attached to the matching transaction.',
        '<strong>Auto-match on Plaid sync:</strong> Receipts that arrive before the bank transaction posts are held and matched automatically when your bank syncs (usually 1–3 days).',
        '<strong>Forwarding address in Integrations tab:</strong> Find your personal receipt address with a one-tap copy button in Control Center → Integrations.',
    ]},
    { version: '7.8.56', date: 'JUN 2, 2026', color: '#818cf8', items: [
        '<strong>Brain Reads Your Documents:</strong> Upload a contract, warranty, insurance policy, or loan document in Control Center → Documents. Brain will index it and answer questions about it — expiration dates, coverage limits, interest rates, serial numbers, anything in the text. Just ask: "When does my Sony warranty expire?" or "What\'s my van loan interest rate?"',
        '<strong>Document Library:</strong> The new Documents tab in Control Center shows all your indexed documents with type, section count, and upload date. Remove any document to clear it from Brain\'s knowledge.',
    ]},
    { version: '7.8.55', date: 'JUN 2, 2026', color: '#4ade80', items: [
        '<strong>Billing Exemptions:</strong> Internal billing exemptions updated for comped accounts.',
    ]},
    { version: '7.8.54', date: 'JUN 2, 2026', color: '#4ade80', items: [
        '<strong>Tax Bucket — Filtered by Category:</strong> The tax bucket dropdown now shows only the valid option for your selected category. Pick Advertising and you see Advertising. Pick Dining &amp; Drinks and you see Meals (50%). No more scrolling through 18 buckets to find the right one. Personal Expense is always available as an override.',
    ]},
    { version: '7.8.53', date: 'JUN 2, 2026', color: '#fbbf24', items: [
        '<strong>Tip Detection on Receipts:</strong> Scanning a receipt that includes a tip now shows a breakdown — subtotal + tip + tax = total — and saves the full charged amount so it matches your bank statement. No more manually adjusting the amount after scanning.',
        '<strong>Split Tip Charges — Auto-Merged:</strong> Some restaurants post the meal and tip as two separate bank charges. When the scanner detects this, it shows a "Split charge found" notice and automatically merges both charges into one entry when you save.',
    ]},
    { version: '7.8.52', date: 'JUN 2, 2026', color: '#f97316', items: [
        '<strong>No More Duplicate Transactions:</strong> Adding a manual entry (especially with a receipt from your phone) no longer creates a duplicate when Plaid or a CSV has already imported the same transaction. The system now checks for a matching bank transaction before saving — and if it finds one, it attaches your receipt and notes directly to the existing entry instead.',
        '<strong>Retroactive Cleanup:</strong> A new background cleanup pass links existing orphaned manual entries to their Plaid counterparts. Previous duplicates can now be resolved via Bank Import → Scan for Duplicates.',
        '<strong>CSV Import Fix:</strong> Importing a CSV file no longer overwrites the source, vendor, or amount on a transaction that was already synced from Plaid — only missing enrichment (category, tax info) is filled in.',
    ]},
    { version: '7.8.51', date: 'JUN 2, 2026', color: '#4ade80', items: [
        '<strong>Auto-Sync on Login:</strong> Connected banks now sync automatically in the background every time you log in — no need to tap Sync manually.',
        '<strong>Connected Banks — Redesigned:</strong> The bank connection cards now show a clear green "● Connected" badge so you can tell at a glance everything is working. The destructive Disconnect button is replaced with a subtle ··· menu so it no longer looks like an error state.',
    ]},
    { version: '7.8.50', date: 'JUN 2, 2026', color: '#f97316', items: [
        '<strong>Monthly Financial Report Email:</strong> On the 1st of each month, Lumière Ledger sends you a financial summary for the prior month — Total Spend, % of Income Spent, Top 3 spending categories, and your biggest changes vs your 3-month average. Styled like a Rocket Money report but in Lumière Ledger\'s dark theme.',
        '<strong>Subscriptions Line Item:</strong> If you have any Subscriptions-category transactions last month, the email breaks them out as a standalone line.',
    ]},
    { version: '7.8.49', date: 'MAY 27, 2026', color: '#4ade80', items: [
        '<strong>Top Expense Drivers — Click to Drill Down:</strong> Every category row on the Dashboard is now a clickable link. Tap any category — Dining &amp; Drinks, Auto &amp; Transport, Shopping, etc. — and the Transaction Ledger opens filtered to exactly those transactions. Hover shows a subtle highlight and an → indicator. The UNCATEGORIZED row opens the ledger pre-filtered to transactions that still need a category.',
        '<strong>Category Filter — Uncategorized Option:</strong> The Category dropdown on the Transaction Ledger now includes "Uncategorized" at the top of the list. Select it to instantly see every transaction that hasn\'t been assigned a category yet — same as the monthly insights shortcut, but always available.',
    ]},
    { version: '7.8.48', date: 'MAY 27, 2026', color: '#818cf8', items: [
        '<strong>Monthly Insights — Top 5:</strong> Each card in the monthly summary popup now shows up to 5 items instead of 3 — more context before you decide what needs attention.',
        '<strong>Go to Transactions — Filtered:</strong> Tapping "Go to Transactions" from the uncategorized step now opens the ledger pre-filtered to show only uncategorized transactions. An orange badge at the top lets you dismiss the filter when you\'re done.',
        '<strong>Tax Bucket Resets on Unmapped Categories:</strong> Selecting a category with no IRS mapping (Clothing, Entertainment, Groceries, etc.) now clears the tax bucket and unchecks Tax Deductible. Previously, the last-selected bucket would stay — silently marking unrelated transactions as deductible.',
        '<strong>Tax Deductible Requires a Tax Bucket:</strong> The Tax Deductible checkbox is now disabled until a tax bucket is selected. Select a category with a mapping, or pick a bucket manually, to enable it.',
        '<strong>Dashboard Loads Faster:</strong> The backend now fetches invoices and vendor settings at the same time as your transactions instead of waiting for each one in sequence. Fewer round trips = faster first paint on cold loads.',
    ]},
    { version: '7.8.47', date: 'MAY 26, 2026', color: '#4ade80', items: [
        '<strong>Category → Tax Bucket Auto-Map:</strong> Picking a category now instantly fills in the correct IRS Schedule C tax bucket — no more hunting through the dropdown. Dining &amp; Drinks → Meals (50%) at 50%. Software &amp; Tech → Office expense. Travel &amp; Vacation → Travel. Camera &amp; Equipment → Supplies. And 19 more mappings built in. Personal categories (Insurance (Personal), Pets, Personal Care) auto-mark as not deductible.',
        '<strong>Meals auto-set to 50%:</strong> Selecting Dining &amp; Drinks also sets Business Use % to 50 automatically — the IRS cap for meal deductions — so your Schedule C math is correct from the start.',
    ]},
    { version: '7.8.46', date: 'MAY 26, 2026', color: '#f97316', items: [
        '<strong>Monthly Spending Insights:</strong> Once per month, a summary slides up after you log in — showing your most frequent vendors, your largest transactions, and any uncategorized items that need attention. Tap "Go to Transactions" on the uncategorized step to fix them immediately. Dismisses until next month.',
        '<strong>Tax Bucket → Auto-Deductible:</strong> Selecting any business tax bucket (Travel, Meals, Office expense, etc.) on a transaction now automatically marks it as Tax Deductible. No more checking the box manually. "Personal Expense" still turns it off. Applies to the transaction drawer, manual entry, and Plaid imports.',
    ]},
    { version: '7.8.45', date: 'MAY 21, 2026', color: '#818cf8', items: [
        '<strong>Mileage — Invoice Link in Maps Mode:</strong> The "Link to Invoice" dropdown is now available in Maps Autopilot mode too, sitting next to the Notes field. Perfect for tax time — your mileage log will show exactly which client session each drive was for.',
    ]},
    { version: '7.8.44', date: 'MAY 21, 2026', color: '#818cf8', items: [
        '<strong>Mileage — Manual Entry:</strong> You can now log trips without an address. Switch to "Manual Entry" in the Log New Trip card and fill in date, name, miles, and optional notes. A "Link to Invoice" dropdown lets you attach the trip to a specific invoice (e.g. Invoice #42 — Miller Wedding) — the reference is saved with the trip record. All manual entries appear in Trip History alongside Maps entries.',
        '<strong>Maps Autopilot Badge:</strong> The badge now reads "Open Route in Maps" and includes a tooltip explaining that after calculating a route, you can tap the link to open it directly in Google Maps or your phone\'s navigation app.',
    ]},
    { version: '7.8.43', date: 'MAY 21, 2026', color: '#f97316', items: [
        '<strong>Invoice Approval — Payment Terms:</strong> Clients now see a clear Payment Information box before they sign. It outlines the 50% deposit requirement, when the remaining balance is due, accepted payment methods (Cash, Stripe, Venmo, Zelle), and a note that a confirmation email follows once the deposit is received.',
    ]},
    { version: '7.8.42', date: 'MAY 21, 2026', color: '#a78bfa', items: [
        '<strong>One Card Per Bank:</strong> Connected a bank via Plaid? You now see one card — not two. Previously your Plaid Live Sync card and your imported CSV card (e.g. "American Express Credit Card ···1001") both appeared showing the same data. The Live Sync card is now the single view: live balance, per-sub-account detail, This Month / Last Month / YTD, Transactions, Sync, and Disconnect — all in one place.',
    ]},
    { version: '7.8.41', date: 'MAY 21, 2026', color: '#38bdf8', items: [
        '<strong>Live Sync Card — Centered Stats:</strong> The spending tiles (This Month, Last Month, YTD, Transactions) are now center-aligned for a cleaner, more balanced look.',
        '<strong>Transactions Tile Now Works:</strong> Clicking "Transactions" on a Live Sync card now opens the ledger filtered to all accounts at that bank — USAA Checking, USAA Savings, etc. all appear together. A green badge shows the active filter with an ✕ to clear it.',
        '<strong>% of Month Bar Now Shows Real Data:</strong> The progress bar at the bottom of each account card now fills to show what portion of your total monthly spending that bank represents. Was stuck at 0% on Live Sync cards.',
    ]},
    { version: '7.8.40', date: 'MAY 21, 2026', color: '#10b981', items: [
        '<strong>Live Sync Spending Stats Fixed:</strong> The "This Month," "Last Month," "YTD," and "Transactions" tiles on Live Sync bank cards now show real numbers. Previously they always showed $0 even after a successful sync. Stats are now correctly totaled across all accounts at that bank.',
        '<strong>Transactions Tile — No More Dead Link:</strong> Clicking "Transactions" on a Live Sync card no longer navigates to a blank result. The tile still shows your transaction count — just without the broken link.',
    ]},
    { version: '7.8.39', date: 'MAY 21, 2026', color: '#a78bfa', items: [
        '<strong>Vendor Memory — Auto-Categorization:</strong> Edit a transaction\'s category, tax flag, or business % once, and every future import of that vendor will automatically get the same values. Starbucks always becomes "Client Entertainment." Delta always gets marked tax-deductible. No repeated corrections needed. Requires running migration 003 in Supabase SQL Editor.',
    ]},
    { version: '7.8.38', date: 'MAY 21, 2026', color: '#10b981', items: [
        '<strong>Credit Card Source Keys Fixed:</strong> If you have multiple cards from the same bank (e.g. two Amex cards), transactions from each card now stay separate. Previously they shared the same account label and mixed together.',
        '<strong>Receipt &amp; Note Protection:</strong> When Plaid removes a transaction (common on pending→posted transitions), your attached receipts, notes, and tax flags are now preserved. The transaction stays in your ledger as a manual record instead of being deleted.',
        '<strong>Self-Healing Source Names:</strong> On every sync, transaction source names are verified and corrected if they\'re out of date. Your existing Amex Delta transactions will be renamed to include the last-4 on next sync.',
    ]},
    { version: '7.8.37', date: 'MAY 21, 2026', color: '#38bdf8', items: [
        '<strong>Multiple Plaid Banks — Each Gets Its Own Card:</strong> Adding a second bank via Plaid (e.g. Amex Delta in addition to USAA) now correctly shows a separate card for each institution in the Live Sync section. Each card has its own live balances, Sync button, and Disconnect button. Previously only one card ever appeared regardless of how many banks were connected.',
    ]},
    { version: '7.8.36', date: 'MAY 20, 2026', color: '#f97316', items: [
        '<strong>Plaid Balance Resilience:</strong> Sub-accounts no longer disappear when the bank is temporarily unreachable. Your last known balances stay visible with an orange "Live balance unavailable — showing last known" note. If USAA or another bank needs re-authentication, you\'ll see a clear message explaining what to do instead of a blank card.',
    ]},
    { version: '7.8.35', date: 'MAY 20, 2026', color: '#10b981', items: [
        '<strong>Plaid Cross-Reference:</strong> The "Plaid Linked" badge on CSV accounts now shows which Plaid sub-account they map to (e.g. "Plaid Linked → ···7121"). If you have two Checking accounts and aren\'t sure which one links to USAA Checking ···7121, the badge tells you at a glance. No action needed — the link is detected automatically from your transaction history.',
    ]},
    { version: '7.8.34', date: 'MAY 20, 2026', color: '#38bdf8', items: [
        '<strong>Plaid Sub-Account Last-4:</strong> Each sub-account on the Live Sync card now shows the last 4 digits of the account number (e.g. ···1234) next to the account name.',
        '<strong>Savings & Older Plaid Transactions Now Visible:</strong> Clicking a sub-account previously showed 0 results if those transactions were imported before the account-ID column existed. The filter now falls back to source-name matching so all transactions appear.',
        '<strong>Account Filter Cleaned Up:</strong> The Account dropdown in the ledger now shows your named accounts first (from the Accounts page) rather than raw historical source strings. Legacy sources still appear below for backward compatibility.',
    ]},
    { version: '7.8.33', date: 'MAY 20, 2026', color: '#10b981', items: [
        '<strong>Plaid Card — Transactions Tile Now Clickable:</strong> The "Transactions" count on the Live Sync account card now links to the transaction ledger filtered to Plaid transactions. Previously the tile was non-interactive.',
    ]},
    { version: '7.8.32', date: 'MAY 20, 2026', color: '#f97316', items: [
        '<strong>Bulk Reassign Account:</strong> Select 2+ transactions and use the new "Reassign account…" dropdown in the floating action bar to move them all to a different account in one click. Perfect for fixing generic source keys like "Credit Card" or "Bank Account" left over from old imports. Transaction data is preserved — only the account assignment changes.',
    ]},
    { version: '7.8.31', date: 'MAY 20, 2026', color: '#38bdf8', items: [
        '<strong>Account Dropdown — Live Names:</strong> The Account field in the transaction editor and the Account filter in the ledger now show your real account names (from your Accounts page aliases) instead of raw import keys. "USD Account", "Bank Account", "Checking Account" etc. are gone — you see exactly what you named each account. Transaction data is unchanged — only the display labels update.',
    ]},
    { version: '7.8.30', date: 'MAY 20, 2026', color: '#38bdf8', items: [
        '<strong>Account Merging:</strong> Duplicate CSV accounts (e.g. same bank exported twice under different names) can now be merged into a single card. Click "Merge" on any CSV account and pick the target — the source account is absorbed and hidden. The target card shows which accounts are merged into it. Unmerge anytime to restore as standalone.',
    ]},
    { version: '7.8.25', date: 'MAY 20, 2026', color: '#10b981', items: [
        '<strong>Transaction Date Column Fixed:</strong> The date column no longer wraps to two lines in the transaction ledger.',
        '<strong>Plaid Account Name Repair — Reliability Fix:</strong> Previous version relied on transaction sync response for account names (empty when no new transactions). Now fetches account names directly before syncing — repair is guaranteed on every sync.',
    ]},
    { version: '7.8.24', date: 'MAY 20, 2026', color: '#10b981', items: [
        '<strong>Plaid Transactions — Real Account Names:</strong> Transactions imported via Plaid now show your actual account name (e.g. "USAA Checking", "USAA Credit Card") in the Account column instead of the generic "Plaid" label. Existing transactions are automatically corrected the next time you trigger a sync.',
    ]},
    { version: '7.8.18', date: 'MAY 20, 2026', color: '#38bdf8', items: [
        '<strong>New Sync Plan ($4.99/mo):</strong> Just want live bank sync without the full AI/invoicing suite? The new Sync plan gives you unlimited Plaid bank connections for a flat $4.99/month — no per-account fees. All connected accounts are included.',
        '<strong>Updated Upgrade Flow — Bank Import:</strong> When connecting a bank without an active subscription, you now see the Sync plan as the featured first option ("Just Plaid? Start Here"), with Core and Studio below for the full feature unlock. Choose what fits — checkout opens directly.',
        '<strong>Updated Upgrade Flow — Billing Section:</strong> The subscription upgrade cards in your Business Profile now show all three paid tiers (Sync · Core · Studio) in a side-by-side grid. Annual/monthly toggle applies to all three.',
        '<strong>Marketing Pricing Updated:</strong> The homepage now shows all 4 tiers (Free / Sync / Core / Studio) with the "Most Popular" badge on Core and accurate per-tier feature lists.',
    ]},
    { version: '7.8.17', date: 'MAY 20, 2026', color: '#f97316', items: [
        '<strong>Plaid Billing Gate — Inline Plan Upgrade UI:</strong> When connecting a bank without a payment method on file, you now see an inline card with Core and Studio upgrade options right inside the Bank Import section — no dead-end error message. Choose a plan, complete checkout, and come back to connect your bank. Monthly/Annual toggle included.',
        '<strong>Plaid Billing — All Users Pay:</strong> Every user (including beta) must have an active subscription before connecting Plaid. Only Joshua Deuermeyer and Michelle Gornichec are exempt. The $0.50/month per account fee applies to everyone.',
    ]},
    { version: '7.8.15', date: 'MAY 20, 2026', color: '#38bdf8', items: [
        '<strong>Connect Bank — Auto-Triggers Plaid Popup:</strong> Clicking "Connect a Bank" from the Accounts page now automatically opens the Plaid billing confirmation and connect flow. Previously it navigated to the Bank Import page but left the Plaid section collapsed — you had to find and click the button again.',
        '<strong>Billing Error Message Improved:</strong> If you hit the $0.50/month billing gate, the error now explains exactly where to add a payment method (Settings → Ledger Control Center → Business Profile → Billing section) instead of giving a vague message.',
    ]},
    { version: '7.8.14', date: 'MAY 20, 2026', color: '#a78bfa', items: [
        '<strong>Stripe Setup — Onboarding Step Added:</strong> "Enable Online Invoice Payments" is now a checklist step in the setup wizard. Clicking it takes you straight to the Business Profile.',
        '<strong>Stripe Setup — In-Profile Guidance:</strong> The Business Profile now includes a dedicated Stripe section with a 4-step walkthrough (create account → API Keys → copy publishable key → paste and save), a direct link to dashboard.stripe.com/apikeys, and a clear warning about never entering your secret key.',
    ]},
    { version: '7.8.13', date: 'MAY 19, 2026', color: '#10b981', items: [
        '<strong>Business Profile Layout Redesigned:</strong> The form now fills full width on desktop instead of capping at 850px. Orphaned half-row fields are paired — Business Name + Category, Phone + Address, Tax ID + Entity Type, NAICS + Invoice Notes, Contract Terms + Payment Methods all share rows. Textareas are more compact. On mobile (≤640px), all fields stack to a single column automatically.',
    ]},
    { version: '7.8.12', date: 'MAY 19, 2026', color: '#38bdf8', items: [
        '<strong>Onboarding Checklist Links Fixed:</strong> "Set Up AI" now correctly opens the AI Intelligence tab (was incorrectly opening Integrations). "Open Invoicing" now correctly opens the Invoicing page (was landing on the Execution Pipeline). "Explore the Help Docs" renamed to "Explore the Help Docs &amp; FAQs".',
    ]},
    { version: '7.8.11', date: 'MAY 19, 2026', color: '#a78bfa', items: [
        '<strong>Onboarding Wizard Minimizes on Navigation:</strong> Clicking any setup step link (Open Profile, Set Up AI, etc.) now collapses the wizard to a floating purple "📋 Resume Setup" button in the bottom-right corner. You can fully interact with the page, complete the step, then click the button to bring the checklist back. Previously the full-screen overlay blocked the page behind it.',
        '<strong>Upgrade Plans Now Visible for Beta Users:</strong> Beta Access accounts can now see the Core and Studio upgrade cards in the Billing section. Previously these were hidden for all grandfathered accounts. Lifetime Free accounts remain unaffected — no upgrade cards shown for lifetime.',
    ]},
    { version: '7.8.9', date: 'MAY 19, 2026', color: '#f43f5e', items: [
        '<strong>Build Fix:</strong> Resolved a syntax error in the onboarding wizard that caused all Vercel deployments since v7.8.7 to fail. An unescaped apostrophe in the checklist button text broke the JavaScript parser. All fixes from v7.8.7 and v7.8.8 (onboarding wizard, flash fix, label corrections) are now live for the first time.',
    ]},
    { version: '7.8.8', date: 'MAY 19, 2026', color: '#38bdf8', items: [
        '<strong>Upgrade Plan Flash Fixed:</strong> The Core and Studio upgrade cards no longer flash briefly for beta and lifetime users on every page load. The billing section now waits for subscription data to fully resolve before rendering — you see a clean "Loading…" state instead of a card that appears and disappears.',
        '<strong>Beta vs Lifetime Labels Corrected:</strong> Beta accounts now correctly show "Beta Access" with a days-remaining counter ("Beta access · 30 days remaining") instead of "Lifetime Free." True lifetime accounts continue to show "Lifetime Free" in green with the grandfathered savings note.',
    ]},
    { version: '7.8.7', date: 'MAY 19, 2026', color: '#f97316', items: [
        '<strong>New User Onboarding Wizard:</strong> First-time login now triggers a 3-page guided setup. Page 1 introduces what Lumière Ledger does with a feature overview. Page 2 explains how to get transactions in (CSV import vs Plaid live sync, with step-by-step instructions for each). Page 3 is a 5-step checklist with direct navigation links — Business Profile, Bank Import, AI Key, Invoicing, and Docs.',
        '<strong>Onboarding Trigger Fixed:</strong> The welcome wizard was never firing for new accounts because of a bug in the trigger condition. New users now see it reliably on first login.',
    ]},
    { version: '7.8.6', date: 'MAY 19, 2026', color: '#10b981', items: [
        '<strong>Filters Now Filter Sub-Accounts:</strong> The Credit / Checking / Savings filter pills now filter the live sub-account rows inside the Live Sync card. Click Credit → only USAA CC shows. Click Savings → only Savings and Photography show. Click Checking → only checking accounts show. The filter is truly useful now even when all your accounts are in Live Sync.',
        '<strong>Account Plans Nav Fixed:</strong> The "Account Plans" link in the menu now correctly opens your billing and plan details instead of a blank admin panel.',
    ]},
    { version: '7.8.5', date: 'MAY 19, 2026', color: '#38bdf8', items: [
        '<strong>Accounts Filter Fix:</strong> The Credit / Checking / Savings / Manual filter pills now work correctly. The 🔗 Live Sync section stays visible regardless of which filter is active — it\'s always shown when a Plaid connection exists. Type filters apply only to the grouped account sections below it.',
    ]},
    { version: '7.8.4', date: 'MAY 19, 2026', color: '#a78bfa', items: [
        '<strong>Per-Sub-Account Transaction Filtering:</strong> Click any Plaid sub-account (Savings, Photography, Checking, USAA CC, etc.) and the Transaction Ledger opens filtered to <em>only that account\'s transactions</em>. A green "Filtered to: [Account Name]" badge confirms the active filter with a clear ✕ to remove it. Requires one-time DB migration — see notes.',
        '<strong>Savings Account Type:</strong> Savings accounts are now detected as their own type and appear in a dedicated 💰 Savings group on the Accounts page. New "💰 Savings" filter pill added to quickly isolate savings accounts.',
        '<strong>Mailer Fallback Fix:</strong> Daily stats emails and intake notification emails no longer fall back to the unverified support@lumiereledger.com address — both now use support@throughthelens.media.',
    ]},
    { version: '7.8.3', date: 'MAY 19, 2026', color: '#f97316', items: [
        '<strong>Live Sync No Longer Shows Duplicates:</strong> The 🔗 Live Sync section now shows only your actual Plaid bank connection. CSV accounts that were cross-matched to Plaid ("Plaid Linked") now appear in their normal Credit/Checking groups — no more seeing USAA listed multiple times.',
        '<strong>Plaid Linked Badge Clarified:</strong> Hover the "Plaid Linked" badge on any CSV account to see: <em>"No extra billing — only the Live Sync connection has a fee."</em> These accounts do not cost $0.50/month.',
        '<strong>Unlink Button on CSV Accounts:</strong> Each "Plaid Linked" CSV account now has an "Unlink" button. Clicking it breaks the cross-match (clears the Plaid transaction IDs from that source) without touching your bank connection or billing. Use this to clean up accounts you don\'t want cross-matched.',
    ]},
    { version: '7.8.2', date: 'MAY 19, 2026', color: '#38bdf8', items: [
        '<strong>Instant Accounts Page:</strong> Account summaries now load from local cache immediately on every visit. Fresh data refreshes silently in the background — no more staring at a spinner.',
        '<strong>Instant Plaid Balances:</strong> Live bank balances (Savings, Checking, Credit Cards) appear from last session\'s cache the moment you open the page. A subtle "Refreshing…" label appears while the live pull completes.',
        '<strong>FAQ: How to Remove Plaid:</strong> Step-by-step instructions added — go to Accounts → Live Sync → Unsync. Clarifies that existing transactions are kept after disconnection.',
        '<strong>FAQ: How to Delete Your Account:</strong> Instructions to request full data deletion via email, including what gets deleted and the 5-business-day timeline.',
    ]},
    { version: '7.8.1', date: 'MAY 19, 2026', color: '#10b981', items: [
        '<strong>Sub-Account Drill-Down:</strong> Every Plaid sub-account row (Savings, Checking, Credit Cards, etc.) is now clickable. Hover to see the blue "View →" indicator and click to open the Transaction Ledger pre-filtered to your Plaid transactions.',
        '<strong>Hide Individual Sub-Accounts:</strong> Each sub-account row has a 👁 button — tap it to hide that specific account from view. Hidden sub-accounts collapse under a "Show N hidden" toggle and can be restored at any time. Persists across sessions.',
    ]},
    { version: '7.8.0', date: 'MAY 19, 2026', color: '#a78bfa', items: [
        '<strong>Full Terms of Service:</strong> Comprehensive 25-section Terms covering eligibility (US only, 18+), subscription billing, Plaid fee policy (no refunds), 30-day money-back guarantee, AI disclaimer, financial disclaimer, third-party services, and data ownership.',
        '<strong>Binding Arbitration:</strong> Dispute resolution via AAA arbitration (Nashville, TN). Class action waiver included. Governing law: Tennessee.',
        '<strong>Limitation of Liability Cap:</strong> Company liability capped at 12 months of fees paid or $100, whichever is greater.',
        '<strong>Survival Clauses:</strong> Key protective sections (warranties, liability, indemnification, arbitration) survive account termination.',
    ]},
    { version: '7.7.9', date: 'MAY 19, 2026', color: '#38bdf8', items: [
        '<strong>Auth Email via Resend:</strong> Supabase now routes confirmation emails through Resend (support@throughthelens.media) instead of its default sender — no more rate limits, no more spam folder.',
        '<strong>Signup Success Message:</strong> Now shows the correct sender address so new users know exactly what to expect.',
    ]},
    { version: '7.7.8', date: 'MAY 19, 2026', color: '#ef4444', items: [
        '<strong>Plaid Billing Gate (Security Fix):</strong> Free accounts can no longer connect to Plaid without a billing method on file. A fee disclosure modal now appears before any bank connection is initiated — $0.50/account/month.',
        '<strong>Onboarding Checklist:</strong> New accounts see a 4-step setup guide — Business Profile, AI Brain, Bank Sync, and Documentation — with a progress bar and per-step checkboxes that persist across sessions.',
        '<strong>Nav Reordered:</strong> Financials now includes Accounts. Operations is Bank Import → Mileage → Camera Gear. Settings now leads with Ledger Control Center, and includes a new "Account Plans" link.',
        '<strong>Login Page Cleaned Up:</strong> Success message no longer overflows. Explains the Supabase Auth confirmation email so users don\'t mistake it for spam. Brand transition banner removed.',
        '<strong>Profile Form:</strong> "Studio Logo" renamed to "Logo". Personal placeholder data removed from all fields.',
        '<strong>Invite Email:</strong> Footer updated from "private beta" message to a support email address.',
    ]},
    { version: '7.7.7', date: 'MAY 19, 2026', color: '#f97316', items: [
        '<strong>Landing Page Rebuilt:</strong> lumiereledger.com now matches the full marketing page — new headline, feature cards, Tax Automation and Client Management detail sections, AI example prompts, and pricing tiers.',
        '<strong>8 Feature Cards:</strong> AI Assistant, Invoicing, Executive Dashboard, CRM Pipeline, Gear Depreciation, Smart CSV Import, Mileage Tracking, and Receipt Management — each with description and badge.',
        '<strong>Pricing Section:</strong> Core (free beta), Pro ($19/mo, coming soon), and Studio ($49/mo, Q3 2026) all displayed with full feature lists.',
        '<strong>Final CTA Banner:</strong> "Stop Running Your Business From Spreadsheets" with the beta invite message.',
    ]},
    { version: '7.7.6', date: 'MAY 19, 2026', color: '#10b981', items: [
        '<strong>Synced Accounts Always on Top:</strong> Plaid-connected and Plaid-linked accounts now appear in their own "🔗 Live Sync" section at the very top of the Accounts page — no more hunting through the list.',
        '<strong>Unsync a Bank:</strong> Each Plaid Live Sync card now has an "Unsync" button. Click it, confirm, and the connection is removed. Your existing imported transactions are kept.',
        '<strong>Click Transaction Count → Filtered Ledger:</strong> Tap the Transactions tile on any account card and the Transaction Ledger opens pre-filtered to that account so you can review entries instantly.',
        '<strong>Logout Always Reachable:</strong> The nav dropdown now scrolls on short screens, so the Logout button is never cut off.',
        '<strong>Bank Import Cleanup:</strong> Removed the "Coming Soon" label from the Plaid section — it\'s live.',
    ]},
    { version: '7.7.5', date: 'MAY 19, 2026', color: '#38bdf8', items: [
        '<strong>Accounts Grouped by Type:</strong> Cards are now grouped as 💳 Credit Cards and 🏦 Checking & Savings — Plaid-connected accounts float to the top of each group.',
        '<strong>Plaid Linked Badge:</strong> CSV accounts that have been matched to your Plaid connection show a green "Plaid Linked" badge so you can see exactly which imports are covered.',
        '<strong>Sort &amp; Filter:</strong> Sort by spend, YTD, transaction count, or name. Filter pills narrow to Credit Cards or Checking only.',
        '<strong>Sync Button:</strong> 🔄 Sync button on any Plaid-connected account pulls new transactions from your bank on demand without going to Bank Import.',
    ]},
    { version: '7.7.4', date: 'MAY 19, 2026', color: '#4ade80', items: [
        '<strong>No More Duplicates When Connecting a Bank:</strong> If you already imported transactions from a bank via CSV, connecting that same bank via Plaid will now match existing records instead of creating duplicates. Your categories, notes, receipts, and tax flags are fully preserved.',
        '<strong>Smart Linking:</strong> Matched transactions get their Plaid ID attached — so future syncs know they\'re already in your ledger and skip them automatically.',
        '<strong>Sync Summary Shows Matches:</strong> After syncing, you\'ll see "X matched to existing imports" so you know exactly what was linked vs. what was new.',
    ]},
    { version: '7.7.3', date: 'MAY 19, 2026', color: '#10b981', items: [
        '<strong>Live Account Balances:</strong> Connected Banks now show real-time balances pulled directly from your bank via Plaid — current balance and available balance per account (checking, savings, credit cards).',
        '<strong>Real Bank Names:</strong> Plaid-connected accounts now show your actual institution name (e.g. "USAA") instead of "Plaid (Auto-Sync)". Sub-accounts are listed by name with their type and balance.',
        '<strong>Last Synced Timestamp:</strong> Each connected bank shows exactly when transactions were last pulled, so you always know how fresh the data is.',
    ]},
    { version: '7.7.2', date: 'MAY 19, 2026', color: '#10b981', items: [
        '<strong>Accounts Grouped by Type:</strong> The Accounts page now organizes cards into three clear sections — Connected Banks (Plaid), Imported Accounts (CSV), and Manual Entry — so you always know what\'s what.',
        '<strong>Live Sync Badge:</strong> Plaid-connected accounts show a pulsing green dot and "Live Sync" badge. CSV imports show blue "CSV Import". Manual entries show purple "Manual Entry".',
        '<strong>Color-coded Borders:</strong> Each card has a left accent border matching its connection type at a glance.',
    ]},
    { version: '7.7.1', date: 'MAY 19, 2026', color: '#4ade80', items: [
        '<strong>Rename Your Accounts:</strong> Each account card now has a ✏ pencil icon — click it, type a new name (e.g. "USAA Checking" or "Wise EUR"), and save. Your custom name persists across sessions.',
        '<strong>Hide Clutter Accounts:</strong> Click the 👁 eye icon on any account to hide it. Hidden accounts are collapsed into a "Show hidden" expander at the bottom — still accessible but out of the way.',
        '<strong>Source Key Reference:</strong> Each card now shows the raw source key (e.g. "checking") in small text below the institution name, so you know exactly which import it maps to.',
    ]},
    { version: '7.7.0', date: 'MAY 19, 2026', color: '#f97316', items: [
        '<strong>Smarter Subscription Search:</strong> Ask the Brain "how much do I spend on subscriptions?" and it now searches across every category — phone bills, insurance, gym memberships, streaming, cloud tools — not just Software & Subscriptions. Results are grouped by vendor with estimated monthly costs.',
        '<strong>Recurring Charge Detection:</strong> The Brain looks for vendors that appear repeatedly over the past 60–90 days and surfaces them as your actual recurring bills, regardless of which category they landed in.',
    ]},
    { version: '7.6.9', date: 'MAY 19, 2026', color: '#38bdf8', items: [
        '<strong>Accounts Page — Mobile Layout:</strong> Account cards and stats grid now fully responsive — on phone the 4-column stat grid collapses to 2×2, summary bar stacks cleanly, all text and badges wrap correctly at any screen width.',
    ]},
    { version: '7.6.8', date: 'MAY 19, 2026', color: '#4ade80', items: [
        '<strong>Accounts Page:</strong> New "Accounts" section in the nav — see every bank account and card side-by-side. Per-account: this month, last month, YTD spend, transaction count, % of total monthly spend, and last import date.',
        '<strong>Spend Trend Indicator:</strong> Each account card shows whether this month\'s spending is up or down vs. last month, with the exact percentage change.',
        '<strong>Summary Bar:</strong> At a glance — total monthly spend, bank/checking total, and credit card total across all accounts.',
        '<strong>Live Bank Sync Ready:</strong> Plaid is now fully wired — real encryption (libsodium), approved API keys, all 5 endpoints active. Connect a bank directly from the Accounts page or Bank Import.',
        '<strong>Admin Plan Types:</strong> Cleaned up to Beta Tester, Monthly, Annual, and Lifetime. Pro removed from new assignment flows; existing Pro users are unaffected.',
    ]},
    { version: '7.6.7', date: 'MAY 18, 2026', color: '#38bdf8', items: [
        '<strong>Billing Section in Profile:</strong> Your subscription plan now shows at the top of the Profile tab — plan badge, tier label, and savings callout for grandfathered members.',
        '<strong>Upgrade Card:</strong> Free users see a Core vs Studio comparison with a monthly/annual toggle. One click opens Stripe Checkout — no redirects through unrelated pages.',
        '<strong>Manage Billing:</strong> Paid subscribers get a "Manage Billing" button that opens the Stripe Customer Portal — cancel, upgrade, swap payment methods, or download past invoices.',
        '<strong>Lifetime Members:</strong> If you\'re on a grandfathered free account, the billing section shows your savings vs paid plans and confirms your free access is permanent.',
    ]},
    { version: '7.6.6', date: 'MAY 18, 2026', color: '#f97316', items: [
        '<strong>Tier Limits Now Enforced:</strong> Free plan caps are active — 500 transactions/mo, 3 invoices/mo, 5 automation rules, 10 CRM leads, and 5 equipment items. Hitting a cap returns a clear upgrade prompt instead of a silent failure.',
        '<strong>Core & Studio Limits:</strong> Core plan bumps transactions to 2,000/mo and invoices to 20/mo, with 25 automation rules. Studio is unlimited across the board.',
        '<strong>Error Shape:</strong> All limit responses include the current tier, the cap value, and a human-readable message — so the frontend can render a targeted upgrade card.',
    ]},
    { version: '7.6.5', date: 'MAY 18, 2026', color: '#a78bfa', items: [
        '<strong>Subscription Tiers — Free, Core & Studio:</strong> Lumière Ledger now has three tiers. Free is free forever for current members. Core ($9/mo) unlocks AI Brain, receipt scanning, full CRM, and more. Studio ($19/mo) adds unlimited everything, mileage automation, and priority support.',
        '<strong>Upgrade Gate:</strong> Premium features show a clean upgrade card when accessed on a lower tier — with a monthly/annual toggle and one-click checkout via Stripe.',
        '<strong>Admin Tier Overrides:</strong> Friends and family can be granted Studio or Core access from the admin panel with no billing impact. Their subscription stays untouched.',
        '<strong>Add-Ons Page Fixes:</strong> Website Lead Capture now routes correctly to the Integration tab. Photography Website Builder links directly to websites.throughthelens.media.',
    ]},
    { version: '7.6.4', date: 'MAY 18, 2026', color: '#38bdf8', items: [
        '<strong>Information Security Policy Published:</strong> The platform\'s official ISP is now accessible from the Documentation tab under "Legal & Compliance." Covers data handling, encryption, access controls, incident response, and Plaid integration security.',
        '<strong>Legal & Compliance Section:</strong> The Documentation tab now includes a dedicated compliance panel with direct links to the Information Security Policy (PDF), Privacy Policy, and Terms of Service — all in one place.',
    ]},
    { version: '7.6.3', date: 'MAY 18, 2026', color: '#4ade80', items: [
        '<strong>Bank Import — No More Emoji:</strong> Cleaned up the bank source list — all emoji icons removed, labels are plain text. The dropdown is now grouped: Rocket Money at the top (Recommended), major banks in the middle, niche banks at the bottom.',
        '<strong>Rocket Money Recommended:</strong> Rocket Money now appears first with a clear note — it covers all your accounts in one export, regardless of which banks you use. If you have multiple banks, this is the easiest path.',
        '<strong>Auto-Detect Still Works:</strong> Drop a CSV and the format is still auto-detected. The "Detected: Chase" confirmation message now shows clean bank names without icons.',
    ]},
    { version: '7.6.1', date: 'MAY 17, 2026', color: '#a78bfa', items: [
        '<strong>First-Run Onboarding:</strong> New users now see a setup modal on first login — guides you through adding your business name, Gemini API key, and first transactions. "GO TO SETUP" drops you directly into the Profile tab. Fires once; dismissed via "Skip for now" and never shown again.',
        '<strong>Admin Panel Fix:</strong> Changing a user\'s subscription plan (e.g., to Lifetime) now immediately reflects in the Subscriptions panel. Previously, the PATCH succeeded on the backend but the panel didn\'t re-fetch — changes appeared to have no effect until a manual page refresh.',
    ]},
    { version: '7.5.9', date: 'MAY 17, 2026', color: '#4ade80', items: [
        '<strong>Fast Receipt Processing:</strong> The "Scan or Upload Receipt" button now appears at the <strong>top</strong> of the transaction form — before any other fields. Point your camera at a receipt (or pick a file), and Gemini Vision auto-fills vendor, amount, date, category, and notes.',
        '<strong>PDF Storage:</strong> Images are automatically converted to PDF client-side before saving — smaller files, consistent format, no extra steps.',
        '<strong>iOS Scan Documents:</strong> On iPhone or iPad, the file picker surfaces Apple\'s native "Scan Documents" option — no special camera mode required. Works the same on desktop with standard file upload.',
        '<strong>No Key, No Problem:</strong> If you haven\'t set a Gemini key yet, the file still attaches — you just fill in the fields manually. Set your key in Control Center → Intelligence to enable auto-fill.',
    ]},
    { version: '7.5.8', date: 'MAY 17, 2026', color: '#38bdf8', items: [
        '<strong>Import Staleness Badge — Calendar Fix:</strong> "Updated today" on the Transaction Ledger now means the actual calendar date matches today — not "within the last 24 hours." An import at 10 PM last night correctly shows "1 day since last import" this morning.',
        '<strong>Import Staleness Badge — Bank Import Portal:</strong> The same green/yellow/red freshness badge now appears on the Bank Data Import screen so you can see how stale your data is before deciding whether to run a new import.',
    ]},
    { version: '7.5.7', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>Brain — Setup Prompt for New Users:</strong> Users without a Gemini API key now see an activation card instead of a hidden or broken chat. It explains the BYOB model, links to Google AI Studio for a free key, shows example questions, and links directly to the Control Center to enter the key.',
        '<strong>Brain — No Shared Tokens:</strong> Each user\'s Brain runs on their own Gemini API key and quota. The assistant button remains visible to all users as an onboarding prompt.',
    ]},
    { version: '7.5.6', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>Brain — Self-Describing Capabilities:</strong> Ask <strong>"what can you do?"</strong> and the Assistant gives you an accurate, complete list of what it can look up, what it can change (with your approval), and what it cannot do yet. No more discovery by trial and error.',
        '<strong>Brain — Updated Greeting:</strong> The Assistant now introduces itself with a prompt to ask about capabilities so you know where to start.',
    ]},
    { version: '7.5.5', date: 'MAY 17, 2026', color: '#38bdf8', items: [
        '<strong>Brain — Credit Card Payment Breakdown:</strong> Ask "how much did I pay toward credit cards in April?" and you\'ll get a breakdown by card — Delta SkyMiles, VentureOne, Checking, etc. — with totals per account.',
        '<strong>Brain — Smarter Context Rules:</strong> CC payments are excluded from general spending analysis (they\'re not real purchases) but fully visible when you explicitly ask about payments. The Brain now knows the difference.',
    ]},
    { version: '7.5.4', date: 'MAY 17, 2026', color: '#a78bfa', items: [
        '<strong>Brain — Conversation Memory:</strong> The Assistant now remembers what you were just talking about. Follow-up questions like "what about in 2026?" or "break that down by month" carry the context of your prior question — no need to repeat yourself.',
        '<strong>Brain — Cleaner Spending Breakdown:</strong> Internal Transfers and Credit Card Payments no longer appear in your top spending categories. Financial analysis now shows real business expense categories only.',
    ]},
    { version: '7.5.3', date: 'MAY 17, 2026', color: '#10b981', items: [
        '<strong>Brain — Category Search Fixed:</strong> "How much have I spent on travel?" now returns correct results. The Brain was searching for "Travel" (exact) but your ledger uses "Travel & Vacation" — fixed to use partial matching so any reasonable keyword finds the right category.',
        '<strong>Brain — Search Before Create:</strong> When you mention past purchases ("I bought Delta tickets, gas, hotels"), the Brain now searches your existing ledger first before offering to create new records. It will also retry with broader search terms before telling you a category has zero spending.',
    ]},
    { version: '7.5.2', date: 'MAY 17, 2026', color: '#10b981', items: [
        '<strong>Brain — Smarter Purchase Analysis:</strong> Credit card payments (AMEX EPAYMENT, ACH PMT, AUTOPAY, etc.) are no longer reported as purchases. When you ask "what\'s my biggest purchase?" the Brain now skips balance transfers and payment transactions — only real vendor purchases count.',
    ]},
    { version: '7.5.1', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>Brain — Invoice Total Fix:</strong> Invoices don\'t store a pre-computed total column — the total is calculated from your line items. The Brain now computes totals correctly from your invoice items, tax rate, and discount. Previously this caused a database error on every invoice lookup or status update.',
        '<strong>Brain — Mark Paid Simplified:</strong> Marking an invoice paid now sends only the status change — no phantom payment amount field that doesn\'t exist on the invoice record.',
    ]},
    { version: '7.5.0', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>Brain — Invoice Query Fix:</strong> Resolved a schema mismatch that caused "error retrieving invoice" on every invoice lookup. Client names are stored in a linked table, not a direct column — all three invoice tools now use the correct join.',
    ]},
    { version: '7.4.9', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>Brain — Multi-Invoice Fix:</strong> "Mark invoice 0428 and 1001 as paid" now works correctly. The Brain calls get_invoice separately for each number instead of combining them into a single broken query.',
        '<strong>Brain — Deeper Reasoning:</strong> The function-calling loop raised from 3 to 6 rounds — multi-step requests (look up 2 invoices, update both) no longer stall midway.',
        '<strong>Brain — Transaction Safety:</strong> Creating a transaction without a vendor, amount, or date now prompts you for the missing info instead of silently creating a $0 record.',
        '<strong>Brain — Link Transactions to Leads:</strong> Transaction search results now include IDs, enabling the Brain to link a specific expense to a CRM lead.',
    ]},
    { version: '7.4.8', date: 'MAY 17, 2026', color: '#38bdf8', items: [
        '<strong>Brain — Invoice Actions:</strong> You can now ask the Assistant to mark invoices as paid, sent, or draft. "Mark invoice #2026-0428 and #1001 as paid" — the Brain looks up both invoices, pulls the totals, and surfaces confirmation cards before changing anything.',
        '<strong>Brain — Multi-Invoice Support:</strong> Multiple invoice numbers in a single request are each resolved and queued as separate confirmation cards — approve or reject individually.',
    ]},
    { version: '7.4.7', date: 'MAY 17, 2026', color: '#10b981', items: [
        '<strong>Brain — Live Page Refresh:</strong> After you approve an action (update lead, add transaction, link records), the page you\'re on automatically reloads the affected data — no manual refresh needed.',
        '<strong>Brain — Multiline Input:</strong> The assistant chat now supports multi-line messages. Use <strong>Shift+Enter</strong> to add a new line; Enter alone sends the message. Input auto-expands as you type.',
    ]},
    { version: '7.4.6', date: 'MAY 17, 2026', color: '#f97316', items: [
        '<strong>AI Brain — CRM Write Fix:</strong> "Mark as Completed/Booked/Lost" now works correctly. The Brain was finding the lead but not passing its unique ID to the update action — lead ID is now included in all CRM lookups so write tools can execute.',
        '<strong>Greeting Personalization:</strong> The Assistant sidebar now greets you by your first name (from your contact or business name in settings).',
    ]},
    { version: '7.4.5', date: 'MAY 17, 2026', color: '#a78bfa', items: [
        '<strong>AI Brain — Confirmation UI:</strong> Write actions (update lead status, add transaction, link records) now surface Approve / Reject confirmation cards before anything is saved — no accidental changes.',
        '<strong>AI Brain — Account Tool:</strong> Ask "What accounts do I have?" or "List accounts with 2026 transactions" — the Brain now queries your actual sources from the ledger.',
        '<strong>Chat Formatting:</strong> The Assistant now renders bold text, bullet lists, and inline code in its responses instead of raw markdown symbols.',
    ]},
    { version: '7.4.4', date: 'MAY 17, 2026', color: '#a78bfa', items: [
        '<strong>AI Brain Upgrade — Live Data Queries:</strong> The Lumière Assistant now uses Gemini function calling to pull real data from your ledger on demand. Ask specific questions like "What did I spend on camera gear this year?" and the Brain queries your actual transactions instead of working from a pre-loaded summary.',
        '<strong>Four Live Tools:</strong> Search Transactions (filter by category, vendor, date, tax status), Financial Metrics Snapshot (YTD totals, burn rate, top categories), Invoice Summary (revenue, outstanding balances), and CRM Pipeline (lead status, booked value).',
        '<strong>Faster & More Accurate:</strong> Replaced a 3,000-token upfront data dump with targeted queries — responses are faster, answers reference exact figures from your live ledger.',
    ]},
    { version: '7.4.3', date: 'MAY 17, 2026', color: '#10b981', items: [
        '<strong>What\'s New Button:</strong> A new "WHAT\'S NEW" button now appears in the header after each update. Click it to see release notes — it dismisses automatically and reappears only when a new version ships.',
        '<strong>AI Engine — Tier 1 Quota Panel:</strong> The Brain Connectivity panel now correctly reflects your Tier 1 limits (1,000 RPM / 1M TPM / 10,000 RPD) under the StudioTracker project. Previous panel showed incorrect Free Tier limits.',
        '<strong>AI Engine — Gemini Version Fix:</strong> Retroactive Ledger Repair now correctly identifies as Gemini 2.5 Flash (was showing 2.0 Flash).',
    ]},
    { version: '7.4.2', date: 'MAY 16, 2026', color: '#10b981', items: [
        '<strong>Update Notifications Fixed:</strong> The "Update Available" banner in the header was stuck and had not fired since v7.0.0. Version tracking is now live — you\'ll see a prompt to refresh within 5 minutes of any new release going live.',
        '<strong>Update Banner:</strong> Cleaner text, no emoji. Checks every 5 minutes instead of every 60 seconds.',
    ]},
    { version: '7.4.1', date: 'MAY 16, 2026', color: '#a8b6dd', items: [
        '<strong>Ledger Control Center — Polish:</strong> Tab pills now text-only, matching the nav. "Studio License Lock" renamed to "License Activation." Stale version string removed and replaced with current version.',
        '<strong>Integration Tab:</strong> Intake URL updated to <code>www.lumiereledger.com/api/intake</code>. Emojis removed from the tab.',
    ]},
    { version: '7.4.0', date: 'MAY 16, 2026', color: '#38bdf8', items: [
        '<strong>Navigation Redesign:</strong> Dropdown menu rebuilt — emojis removed, items grouped into labeled sections (Financials, Operations, Client Work, Settings). Cleaner and faster to scan.',
        '<strong>Ledger Control Center — Performance:</strong> LCC now loads in a fraction of the time. Previously fired 7–11 API calls on open; now fires 2. Heavy data loads only when you navigate to a tab that needs it.',
        '<strong>System Status Panel:</strong> Replaced the stat count cards with a real-time system status strip — Database connection, Email/SMTP readiness, last-checked time, and a manual Refresh button.',
        '<strong>Loading Skeleton:</strong> If a tab takes more than a second to load, animated placeholder bars appear so the page never looks empty or broken.',
    ]},
    { version: '7.3.9', date: 'MAY 16, 2026', color: '#38bdf8', items: [
        '<strong>Mark Paid on Draft Invoices:</strong> Portal-paid clients (e.g., FotoFetch) can now be marked paid directly from draft status — no unwanted email send required.',
        '<strong>Edit Restored on Paid Invoices:</strong> Paid invoice records are now fully editable again. Access Edit on any invoice regardless of status for corrections and record-keeping.',
    ]},
    { version: '7.3.8', date: 'MAY 16, 2026', color: '#4ade80', items: [
        '<strong>Client Override Fix:</strong> Fixed a bug where typing a new client name in the invoice form could silently reuse a prior client\'s record (Boris bug). Client fields now clear the linked ID on manual change.',
        '<strong>CRM Import — Duplicate Disambiguation:</strong> The leads dropdown now shows shoot type and date alongside the name — so duplicate-named leads (e.g., two "FotoFetch" entries) are distinguishable at a glance.',
        '<strong>Save &amp; Send Email:</strong> New single-step button in the invoice form footer. Saves the draft and immediately sends the client email — eliminates the two-step save → find → send workflow.',
    ]},
    { version: '7.3.5', date: 'MAY 16, 2026', color: '#f97316', items: [
        '<strong>Domain Migration — CORS:</strong> <code>www.lumiereledger.com</code> added to allowed origins. Auth calls from the new domain no longer fail.',
        '<strong>Pay Portal Links:</strong> Invoice email payment links now point to <code>www.lumiereledger.com</code> instead of the old domain.',
        '<strong>Email Reliability:</strong> Hardcoded fallback from-addresses corrected to the verified Resend sending domain — eliminates silent email delivery failures if the env var is ever missing.',
    ]},
    { version: '7.1.0', date: 'MAY 6, 2026', color: '#38bdf8', items: [
        '<strong>Website Lead Capture:</strong> Booking form submissions on your photography website now route directly into the CRM pipeline in real time — no Zapier, no manual imports.',
        '<strong>Client Deduplication:</strong> Returning clients are automatically matched by email and linked to their existing profile. No duplicate contact cards.',
        '<strong>Real-Time Notifications:</strong> New leads trigger an instant in-app toast notification and a red badge counter on the CRM nav link — so you know the moment a client books.',
        '<strong>Multi-Tenant Intake Keys:</strong> Every user can generate their own API key to connect their website. Keys are labeled, rotatable, and manageable from the new Integrations tab.',
        '<strong>Integrations Tab:</strong> New tab in the Ledger Control Center with full setup instructions — copy your intake URL, secret key, and code snippet in one place.',
        '<strong>Add-Ons Marketplace:</strong> New <code>/addons</code> page surfaces available platform extensions. Website Lead Capture is live; Website Builder, Client Portal, and Contract E-Sign are in development.',
    ]},
    { version: '7.0.0', date: 'MAY 1, 2026', color: '#f97316', items: [
        '<strong>Lumière Ledger Rebrand:</strong> The platform is officially Lumière Ledger! Overhauled the UI, replaced all instances of the old branding, and implemented the new premium app icon.',
        '<strong>Layer 2 System Watchdog:</strong> Added an hourly internal cron job to test DB/SMTP health and alert the admin if degraded.',
        '<strong>Layer 1 Uptime Monitoring:</strong> Configured external HTTP ping via UptimeRobot to ensure public API availability.'
    ]},
    { version: '6.3.0', date: 'APRIL 8, 2026', color: '#f59e0b', items: [
        '<strong>Persistent Ignoral:</strong> You can now explicitly IGNORE/RESTORE noise or generic recurring vendors directly from the intelligence view. These rules automatically persist in the backend.',
        '<strong>Multi-Timeframe Analytics:</strong> Top Expense Drivers and analytical projections can now be seamlessly evaluated across <em>Full Year</em>, <em>Last Year</em>, <em>YTD</em>, and <em>Current Month</em> arrays with native zero-latency switching.',
        '<strong>Pagination Defenses:</strong> Surmounted strict database truncation limits. The metrics engine now auto-paginates, pulling 100% of your data rows for completely accurate multi-year reporting.',
        '<strong>Contextual Accuracy:</strong> Relabeled subscription mathematics to intelligently align with overarching "Recurring Vendors" analysis, protecting footprint totals.'
    ]},
    { version: '6.2.0', date: 'APRIL 8, 2026', color: '#10b981', items: [
        '<strong>Operational Intelligence Revamp:</strong> Complete rewrite of the recurring vendor tracking center. Removed legacy static cards and replaced them with a responsive 4-metric summary strip.',
        '<strong>Action-Driven Filters:</strong> New filter controls allow one-click table narrowing for "Review Candidates", "Duplicates", and "Unused" subscriptions.',
        '<strong>Top Offenders Snapshot:</strong> Automatic detection and isolation of the three highest monthly recurring expenses for immediate visibility.',
        '<strong>Streamlined Table:</strong> Cleaned up the Operational Intelligence table with uniform 25% column spacing and unified pill flags, directly mapping to standard database truths.'
    ]},
    { version: '6.1.0', date: 'APRIL 8, 2026', color: '#818cf8', items: [
        '<strong>Maps Autopilot:</strong> Rebuilt the Mileage Tracker with Google Maps integration. Address autocomplete (Google Places) for both Start (A) and End (B) fields.',
        '<strong>Auto Distance Calculation:</strong> Google Distance Matrix API instantly computes the exact driving miles between any two addresses — no manual counting.',
        '<strong>Dark Route Preview:</strong> A styled dark-mode map renders the A\u2192B route with a purple polyline for visual confirmation before logging.',
        '<strong>Flexible Multi-Stop Logging:</strong> Each trip is logged as a single one-way segment. Log multiple trips per day with different clients and destinations.',
        '<strong>Smart Trip History:</strong> The Trip History table now parses and displays the Trip Name, Route, and Notes as separate structured lines for clean IRS-compliant records.',
    ]},
    { version: '6.0.0-SECURITY', date: 'APRIL 8, 2026', color: '#ef4444', items: [
        '<strong>Security Lockdown (Critical):</strong> Activated Row-Level Security (RLS) across all Supabase tables to enforce strict hardware-level data isolation between studios.',
        '<strong>Multi-Tenant Integrity:</strong> Audited and hardened 40+ backend endpoints (Mileage, Assets, Rules, Invoices) to ensure per-request <code>user_id</code> filtering.',
        '<strong>Defense-in-Depth:</strong> Every database query now combines both RLS policy protection and explicit backend owner-checking for redundant security.',
        '<strong>Admin Transparency:</strong> Re-pathed SaaS telemetry and engagement tracking to the Service Layer to maintain operational visibility without exposing user data.',
    ]},
    { version: '5.4.0', date: 'APRIL 5, 2026', color: '#a855f7', items: [
        '<strong>Financial Insight Strip:</strong> Six live analytical signals embedded inside Monthly Performance \u2014 powered by server-side math, zero added DB queries.',
        '<strong>Margin Quality:</strong> Net margin % MTD with delta vs prior month and Healthy/Watch/Risk classification.',
        '<strong>Cash Reality:</strong> Invoice collection rate (collected vs open) as a single actionable percentage.',
        '<strong>Expense Pressure:</strong> Fixed vs variable cost split using recurring vendor inference \u2014 flags cost structure risk above 70%.',
        '<strong>Revenue Quality:</strong> Detects single-source dependency \u2014 flags concentration risk above 60% of total revenue.',
        '<strong>Burn Rate + Runway:</strong> 3-month trailing average spend with months-of-runway from cash-on-hand.',
        '<strong>Short-Term Signal:</strong> Current month revenue velocity vs prior month as a leading growth/contraction indicator.',
    ]},
    { version: '5.3.1', date: 'APRIL 5, 2026', color: '#38bdf8', items: [
        '<strong>One-Tap Asset Capture:</strong> Rewired the Transaction Drawer for field use. Staging a receipt during a new transaction save now auto-sequences the database entry and the image upload in a single atomic action.',
        '<strong>Mobile Analytics Fix:</strong> Added horizontal overflow protection and minimum data-width logic to the Operating Intelligence table. Recurring vendor amounts and flags no longer clip on small screens.',
        '<strong>Brand Stabilization:</strong> Replaced the global text-only "LUMIÈRE LEDGER" placeholder in the main header with the official 3D brand icon. Unified the icon across the Dashboard V2 and PWA home-screen manifest.',
        '<strong>Interactive Vendor Auditing:</strong> All recurring vendor rows are now clickable triggers that jump directly to the transaction ledger filtered by provider name.',
        '<strong>Deterministic Forecasting:</strong> Expanded the YTD Projector with granular inflation/creep variables for 2%, 3%, and 7% scenarios.'
    ]},
    { version: '5.3.0', date: 'APRIL 4, 2026', color: '#4ade80', items: [
        '<strong>Dashboard V2 Architecture (Beta):</strong> A complete rebuild of the Executive Analytics dashboard, focusing on data clarity, performance, and actionable intelligence over aesthetics.',
        '<strong>Backend Metrics Engine:</strong> Centralized calculations for YTD/MTD Revenue, Net Profit, and Operating Expenses entirely on the server. Reduces browser memory overhead and ensures 100% data consistency everywhere.',
        '<strong>Performance Combo Chart & Ghost Bars:</strong> Removed confusing independent line graphs. Added a unified HTML-native visual overlaying Monthly Revenue vs. Expense vs. Net Profit, along with reclaimed UI space for quick-hit Fixed/Variable sub calculations.',
        '<strong>Interactive KPIs:</strong> All top-level snapshot cards (Revenue, Expenses, Receivables) are now interactive routing modules that jump directly to the pre-filtered core data ledger.',
        '<strong>Obligations & Invoice Health 2.0:</strong> We now dynamically digest the invoice ledger to provide 4-column cash-flow insight: Exact uncollected totals, strict calculation of overdue dollars, upcoming expectation forecasts (next 7 days), and average historical collection time.',
        '<strong>Recurring Vendor Inference:</strong> AI Brain logic is now backed by a deterministic backend algorithm. Automatically detects and flags recurring subscriptions and potential <em>Personal Leakage</em> directly on the dashboard.'
    ]},
    { version: '5.2.0', date: 'APRIL 3, 2026', color: '#38bdf8', items: [
        '<strong>AI Category Segregation:</strong> Deep-linked Dividend and Interest income categories into the Brain logic. No more generic "Side Income" tagging for asset yields.',
        '<strong>Executive Dashboard Sort:</strong> Enabled multi-column sorting (Invoice #, Date, Client, Status) on the global invoice matrix.',
        '<strong>Print Isolation Hub:</strong> Native 1" margin PDF generation now clears the viewport and isolates only the invoice for professional A4/Letter accuracy.',
        '<strong>ROAMAP: Phase 1 Deep Context:</strong> Brain now looks at multi-year comparatives for trend analysis (YTD/Prior Yr).',
        '<strong>ROADMAP: Phase 2 Tool Integration:</strong> [PLANNED] Giving the AI "Hands" to create invoices and update CRM statuses via voice/chat commands.',
        '<strong>ROADMAP: Phase 3 Vision RAG:</strong> [PLANNED] Direct analysis of uploaded PDF receipts, contracts, and manual ledger attachments.',
    ]},
    { version: '5.1.0', date: 'APRIL 2, 2026', color: '#f97316', items: [
        '<strong>Invoice Cloning:</strong> Added a one-click "Clone" button on the invoice dashboard to instantly duplicate proposals or bill new clients with identical parameters.',
        '<strong>Attachment URLs:</strong> You can now attach a direct URL (like Google Drive or Pixieset) to any invoice. It automatically prints on the PDF and the Client Email as an interactive button.',
        '<strong>Dynamic Email Senders:</strong> Outbound emails securely adopt your Official Business Name. Furthermore, any client replies are intelligently routed directly back to your personal Business Email account.',
        '<strong>Intelligent Discount Scaling:</strong> Completely rebuilt the discount processing engine backend to guarantee 100% precision on scaled percentages across PDFs, Emails, and the Pay Portal.',
        '<strong>Visual & PDF Refinements:</strong> Cleaned up empty quantity rows on the PDF generator and optimized layout spacing dynamically. The Lumière Ledger logic gracefully prevents blank rows from bleeding lines onto the formal file.'
    ]},
    { version: '5.0.0', date: 'APRIL 1, 2026', color: 'var(--accent)', items: [
        '<strong>Pay Now Portal:</strong> Clients receive a branded payment link (<code>/pay/:token</code>) — no login required. Shows invoice summary, payment handles, and e-signature capture.',
        '<strong>Dual E-Signatures:</strong> Photographers check "I authorize this invoice" in the creator. Clients type their full name to approve on the Pay Portal — timestamp and signature stored permanently.',
        '<strong>Premium Invoice Email:</strong> Fully redesigned client email with inline line-item table, studio logo, conditional notes, orange Pay Now CTA button, and PDF attachment.',
        '<strong>Photographer Approval Notification:</strong> When a client signs, the photographer receives a dark-mode branded email with signature details, payment handles shown to client, and a deep-link back into Lumière Ledger.',
        '<strong>Payment Handles:</strong> Business Profile now stores Venmo, Zelle, CashApp, and Stripe Publishable Key — surfaced on the Pay Portal with tap-to-open links.',
        '<strong>Tax Exempt Toggle:</strong> Invoice creator now includes a one-click toggle to zero out tax for exempt projects.',
        '<strong>Customer Notes:</strong> Dedicated notes section on invoices for shoot details, thank-you messages, and special instructions — only appears in email and Pay Portal when filled in.',
        '<strong>Qty Guard:</strong> Line items without a quantity no longer show unit price or total — but still contribute to subtotal calculations.',
        '<strong>Smart Dedup Merge Engine:</strong> CSV import now merges bank transactions with matching manual entries (±2 day window, same amount) instead of skipping — keeps your category, notes, and receipt; updates source to the bank.',
        '<strong>Retroactive Duplicate Scanner:</strong> New tool in Bank Data Import — scan your entire ledger for existing duplicates with side-by-side review, one-click merge, or auto-merge high-confidence pairs.',
        '<strong>AI Brain Modal:</strong> Welcome popup is now evergreen (no version number) and suppressed automatically if you have already configured your own Gemini API key.',
    ]},
    { version: '4.3.0', date: 'MARCH 27, 2026', color: 'var(--accent)', items: [
        '<strong>CORS Hardened:</strong> API now restricted to app.throughthelens.media only.',
        '<strong>Support Email:</strong> All outbound mail now routes through support@throughthelens.media.',
        '<strong>IRS Rates Auto-Seeded:</strong> Mileage rates 2020–2026 auto-populate on first load — no manual entry needed.',
        '<strong>Mileage Intelligence:</strong> Brain AI now reads real IRS rate from DB per year instead of hardcoded value.',
        '<strong>Supabase RLS Hardening:</strong> Enabled Row Level Security on all unprotected tables; function search_paths locked.',
    ]},
    { version: '4.0.0', date: 'MARCH 18, 2026', color: 'var(--accent)', items: [
        '<strong>Your Assistant:</strong> Initial release of the floating AI assistant for real-time financial consultation.',
        '<strong>Gemini 1.5 Flash:</strong> Migrated whole-studio intelligence to the latest Google Flash model for 2x speed.',
        '<strong>Privacy Lockdown:</strong> Implemented Row Level Security (RLS) for AI settings; bringing "your own key" now isolates data.',
        '<strong>Dashboard Grid:</strong> Precision calibration for Intelligence cards (9-card desktop grid).',
        '<strong>Smart Recurring:</strong> Improved detection patterns for operational burn that ignores one-off equipment transfers.',
    ]},
    { version: '3.9.3', date: 'MARCH 16, 2026', color: 'var(--accent)', items: [
        '<strong>Pro Entry Integrated:</strong> Released Google OAuth (One-Tap login) as the primary studio entry method.',
        '<strong>Automated Expiration Logic:</strong> Studio licenses now auto-recalculate (Annual 365D, Pro 999D) upon plan change.',
        '<strong>Identity Fix:</strong> Resolved sync issue between License Records and Profiles; display names now persist correctly.',
        '<strong>Pulse Resilience:</strong> Switched engagement telemetry to Service Layer to ensure 100% visibility in SaaS Dashboard regardless of RLS.',
        '<strong>Smarter Bills:</strong> Improved detection patterns for operational overhead (Fitness, Software, Licenses).',
    ]},
    { version: '3.8', date: 'MARCH 14, 2026', color: 'var(--accent)', items: [
        '<strong>SaaS Control Center:</strong> Integrated real-time engagement pulse and user activity reporting.',
        '<strong>Enhanced User Mgmt:</strong> Added ability to edit invites and active session details (name, plan type).',
        '<strong>License Health:</strong> Visual color-coded alerts (Green/Yellow/Red) for expiring access sessions.',
        '<strong>Auto-Update Core:</strong> Aggressive cache-busting and version synchronization for all users.',
        '<strong>Cloud Parity:</strong> Fully decommissioned NAS modules in favor of Supabase/Vercel resilience.',
    ]},
    { version: '3.7', date: 'MARCH 13, 2026', color: '#fff', items: [
        '<strong>Documentation Refresh:</strong> Integrated the "Change Log" repository for real-time feature tracking.',
        '<strong>Widescreen Optimization:</strong> Expanded Onboarding and FAQ containers to 1400px for better data density.',
        '<strong>Branding Evolution:</strong> Increased "LUMIÈRE LEDGER" brand presence in the primary command bar.',
        '<strong>Executive Symmetry:</strong> Precision grid calibration for dashboard controls (CHARTS, YEAR, SYNC).',
        '<strong>Dual Trajectory:</strong> Split profitability tracking into dual modules for "Margin %" and "Net Income Pulse".',
        '<strong>Inventory Density:</strong> Optimized Equipment Locker for 40% higher visibility per scroll.',
    ]},
    { version: '3.6.1', date: 'MARCH 12, 2026', color: '#fff', items: [
        '<strong>Mobile Command Bar:</strong> Initial release of the PWA bottom navigation for field usage.',
        '<strong>Visual Pulse:</strong> Added color-coded "Data Age" indicators to ensure sync health.',
        '<strong>Performance:</strong> Global implementation of <code>fadeIn</code> page transitions.',
    ]},
    { version: '3.5', date: 'MARCH 11, 2026', color: '#fff', items: [
        '<strong>Pipeline-to-Invoice:</strong> Direct lead conversion engine for rapid billing.',
        '<strong>Receipt Forensics:</strong> Integrated file storage for equipment serialized assets.',
        '<strong>Security Core:</strong> Role-based restriction for administrator-only studio management.',
    ]},
];

export default function ChangeLogModal({ onClose }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="card glass glow-blue" style={{ width: '100%', maxWidth: '700px', padding: '40px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '1.8rem', margin: 0 }}>System Intelligence Update Log</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
                        {RELEASES.map(r => (
                            <section key={r.version}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                    <div style={{ fontWeight: 950, fontSize: '1.4rem', color: r.color }}>{r.version}</div>
                                    <div style={{ fontWeight: 800, opacity: 0.6, fontSize: '12px' }}>{r.date}</div>
                                </div>
                                <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '15px' }}>
                                    {r.items.map((item, i) => (
                                        <li key={i} style={{ fontSize: '14px', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: item }} />
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </div>
                <button className="btn primary glow-blue" onClick={onClose} style={{ marginTop: '30px', width: '100%', padding: '15px' }}>CLOSE UPDATES</button>
            </div>
        </div>
    );
}
