# Freelancer Expense Tracker (Rocket Money Edition)

Welcome to your new Freelancer Expense & Tax Tracker! This application is designed specifically for freelancers, sole proprietors, and small business owners who want to replace clunky accounting software (like QuickBooks) with a lightning-fast, Rocket Money-integrated dashboard.

## Overview
This tracker takes your raw transaction exports from Rocket Money and turns them directly into a Schedule C (Form 1040) tax report. It automatically categorizes common business expenses, tracks your deductible mileage, stores your physical receipts, and handles asset depreciation. 

---

## 🚀 How to Use

### 1. Import Your Data
1. Export your transactions from Rocket Money as a `.csv` file.
2. Go to the **Transactions** tab in the Expense Tracker.
3. Drag and drop your `.csv` file into the "Import Rocket Money CSV" box.
4. *Magic:* The app will automatically scan your imports and assign obvious business expenses (like Software, Advertising, certain vendors like *Amazon*, *T-Mobile*) directly to their correct IRS Schedule C Tax Buckets.

### 2. Review and Categorize 
By design, Rocket Money mixes your personal and business spending. The app filters this for you:
1. Go to the **Tax** tab.
2. Look for the yellow warning badge: `⚠ [Number] unclassified in [Year]`.
3. Click the yellow badge to open the **Audit Modal**.
4. Scroll through the transactions. If you see a business expense that wasn't auto-caught, click **Edit** and assign it a "Tax Bucket" and a "Business Use %".
5. Leave all your personal expenses (Groceries, Personal Dining, Pets) as "Unassigned". The app will correctly ignore them for your tax calculations.

### 3. Track Your Mileage
Stop using third-party mileage trackers that cost monthly fees. 
1. Open the **Tax** tab.
2. Scroll to the **Car & Truck — Standard Mileage** section.
3. Add your trips (e.g., "75 miles - Client Photoshoot").
4. The app automatically downloads the official IRS Standard Mileage Rates direct from `IRS.gov` for the given year and multiplies your miles by the exact legal deduction rate.

### 4. Track Your Equipment Depreciation
Did you buy a $3,000 camera or a new laptop? You need to depreciate it.
1. Go to the **Equipment** tab.
2. Add your gear, purchase date, cost, and business use percentage.
3. The app calculates your legal depreciation deduction (using either Section 179 or Straight-Line methods) and pushes that total directly back to Line 13 of your Schedule C on the Tax tab.

### 5. Attach Receipts to Transactions
IRS rules require receipts for expenses over $75. 
1. Next to any transaction over $75, you'll see a red `Needed` badge.
2. Click **Edit**.
3. You can either paste a link to Google Drive/Dropbox, or click **Choose File** to directly upload a PDF or image of the receipt to your server.
4. The app will securely link it, and the badge turns into a green `View` button. 

### 6. Taxes at Year End
Come April 15th, you don't need to do any math.
1. Go to the **Tax** tab and select the desired year.
2. Copy the numbers directly from the screen into your digital tax software (TurboTax, FreeTaxUSA, etc) or hand them to your CPA.
3. Click **Export Line-Item CSV** to download a finalized, accountant-ready spreadsheet proving exactly which transactions make up each of those Schedule C line items.

---

## System Architecture for Developers
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)
- **Frontend:** React (Vite) + Chart.js
- **Auth:** Cloudflare Zero Trust (JWT Validation)
- **Deployment:** Vercel (Frontend) / Synology NAS Docker (Backend)

Enjoy having complete control over your financial data!
