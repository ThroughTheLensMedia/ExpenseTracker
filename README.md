# Studio Tracker Executive Dashboard (2026 Edition)

Welcome to your Financial Command Center. This application is engineered to transition from high-level "Rocket Money" snapshots to a pro-tier Revenue & Tax Ledger for media professionals.

## 🚀 How to Use

### 1. Unified Bank Ingestion
1. Export your transactions from **Rocket Money**, **USAA**, **Chase**, **Apple Card**, **Navy Federal (NFCU)**, or **Wise**.
2. Navigate to the **Import Data** tab.
3. Drag and drop your `.csv` file. 
4. *Intelligence:* The system auto-detects your bank format and maps headers to the unified ledger. If your bank is unsupported, use the **Universal Mapper**.

### 2. Studio Intelligence & Runway
- **Forecast Controls:** Adjust your "Starting Cash" and "Weighted Pipeline Probability" on the Dashboard to see your exact runway (in months).
- **Vigilance Reminders:** Set a custom days-to-sync reminder to ensure your ledger data never goes stale.
- **Profit Trajectory:** Monitor your quarterly margin health based on actual processed invoices vs opex.

### 3. Tax & SCC Governance
- **SCC Console:** Access the **Studio Control Center** (`/StudioControlCenter`) to manage client invites, beta testing codes, and global platform settings.
- **Schedule C Reporting:** All categorizations map directly to IRS Line Items for instant year-end filing.

---

## 🛠 Local Development & Testing

To test changes without affecting the production session:

1. **Open Terminal** on your Mac.
2. **Navigate to the web-folder:**
   ```bash
   cd "/Users/dewey/Downloads/Expense Tracker 2026 v3/web-react"
   ```
3. **Launch the Dev Server:**
   ```bash
   npm run dev
   ```
4. **Access the Preview:** Open `http://localhost:5173` in your browser.

---

## ❓ FAQ

**Q: How do I categorize 50% vs 100% deduction?**
A: Use the "Edit" function on any transaction. Standard business expenses (Software, Ads) are 100%. Meals and Van Fuel are typically 50%.

**Q: Why is my revenue showing up correctly but the chart looks off?**
A: Ensure your categories in the Bank CSV aren't being double-counted by the "Internal Transfer" filter. The dashboard ignores "Transfers" to prevent artificial income inflation.

**Q: How do I export for my CPA?**
A: Go to the **Tax** tab, select the year, and click **Download Ledger CSV**. This provides a line-item audit trail for every Schedule C bucket.

---

## System Architecture
- **Backend:** Node.js / Express
- **Database:** Supabase (PG) / RLS Enabled
- **Intelligence:** Chart.js V4 + Pipeline Weighted Forecasting
- **Identity:** Cloudflare Protected / Job Title Integration
