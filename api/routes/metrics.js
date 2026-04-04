const express = require("express");
const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const targetYear = req.query.year || new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    
    const startDate = `${targetYear}-01-01`;
    const endDate = `${targetYear}-12-31`;

    const [ { data: expenses, error: expError }, { data: invoices, error: invError } ] = await Promise.all([
      req.sb
          .from("expenses")
          .select("amount_cents, expense_date, category, vendor")
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
          .eq("user_id", req.user.id),
      req.sb
          .from("invoices")
          .select("status, total_cents, amount_paid_cents, due_date")
          .eq("user_id", req.user.id)
    ]);
      
    if (expError) throw expError;
    if (invError) throw invError;

    let ytdIncome = 0;
    let ytdSpend = 0;
    let mtdIncome = 0;
    let mtdSpend = 0;

    const ignoreCategories = ['internal transfer', 'credit card payment', 'funds transfer', 'payment', 'transfer'];
    const knownSubscriptions = ['adobe', 'netflix', 'hulu', 'spotify', 'apple', 'google workspace', 'squarespace', 'chatgpt', 'openai', 'amazon web services', 'aws'];
    const leakageWarningKeywords = ['netflix', 'hulu', 'spotify', 'peloton', 'xbox', 'playstation', 'door dash', 'ubereats'];

    const categoryBreakdown = {};
    const vendorActivity = {}; // For recurring tracking
    const monthlyPerformance = Array(12).fill().map((_, i) => ({ month: String(i + 1).padStart(2, '0'), income: 0, spend: 0, net: 0 }));

    if (expenses) {
      for (const row of expenses) {
        const cat = String(row.category || '').toLowerCase();
        const vend = String(row.vendor || '').toLowerCase();
        
        // Skip transfers
        if (ignoreCategories.some(i => cat.includes(i) || vend.includes(i))) continue;

        const cents = Number(row.amount_cents || 0);
        const isIncome = cents < 0;
        const absValue = Math.abs(cents);
        
        const monthNum = parseInt(String(row.expense_date || '').slice(5, 7), 10);
        
        if (isIncome) {
          ytdIncome += absValue;
          if (monthNum === currentMonth && targetYear == new Date().getFullYear()) {
            mtdIncome += absValue;
          }
          if (monthNum >= 1 && monthNum <= 12) {
             monthlyPerformance[monthNum - 1].income += absValue;
          }
        } else {
          ytdSpend += absValue;
          if (monthNum === currentMonth && targetYear == new Date().getFullYear()) {
             mtdSpend += absValue;
          }
          if (monthNum >= 1 && monthNum <= 12) {
             monthlyPerformance[monthNum - 1].spend += absValue;
          }
          
          const rawCat = row.category || 'Uncategorized';
          categoryBreakdown[rawCat] = (categoryBreakdown[rawCat] || 0) + absValue;

          // Track vendor hits for recurrence
          if (vend) {
             if (!vendorActivity[vend]) {
                 vendorActivity[vend] = { count: 0, total: 0, lastDate: row.expense_date };
             }
             vendorActivity[vend].count += 1;
             vendorActivity[vend].total += absValue;
             if (row.expense_date > vendorActivity[vend].lastDate) {
                 vendorActivity[vend].lastDate = row.expense_date;
             }
          }
        }
        
      }
      
      // Compute Net per month
      for (let i = 0; i < 12; i++) {
        monthlyPerformance[i].net = monthlyPerformance[i].income - monthlyPerformance[i].spend;
      }
    }

    const topCategories = Object.entries(categoryBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([category, cents]) => ({ category, cents }));

    // Compute Recurring Vendors
    const recurringVendors = [];
    for (const [vend, data] of Object.entries(vendorActivity)) {
        const isKnownSub = knownSubscriptions.some(k => vend.includes(k));
        if (data.count >= 3 || isKnownSub) {
            const avgCost = data.total / data.count;
            const isLeakage = leakageWarningKeywords.some(k => vend.includes(k));
            
            recurringVendors.push({
                vendor: vend,
                avgMonthlyCents: avgCost,
                annualProjectedCents: avgCost * 12,
                lastSeen: data.lastDate,
                count: data.count,
                flags: {
                    isSubscription: isKnownSub,
                    leakageWarning: isLeakage, // Personal expense showing up on business side
                    cancelCandidate: data.count < 6 && avgCost > 2000 // Arb flag: Expensive infrequent sub
                }
            });
        }
    }
    
    // Sort recurring by largest projected impact
    recurringVendors.sort((a, b) => b.annualProjectedCents - a.annualProjectedCents);

    // Compute Invoice Health & Receivables
    let openReceivablesCents = 0;
    let overdueCount = 0;
    let draftCount = 0;
    
    if (invoices) {
        const today = new Date().toISOString().slice(0, 10);
        for (const inv of invoices) {
            if (inv.status === 'sent' || inv.status === 'partial') {
                const due = (inv.total_cents || 0) - (inv.amount_paid_cents || 0);
                if (due > 0) openReceivablesCents += due;
                if (inv.due_date && inv.due_date < today) overdueCount++;
            } else if (inv.status === 'draft') {
                draftCount++;
            }
        }
    }

    res.json({
      snapshot: {
        mtdIncome,
        mtdSpend,
        mtdNet: mtdIncome - mtdSpend,
        ytdIncome,
        ytdSpend,
        ytdNet: ytdIncome - ytdSpend,
        openReceivablesCents
      },
      analytics: {
         topCategories,
         recurringVendors
      },
      obligations: {
         overdueInvoices: overdueCount,
         draftInvoices: draftCount
      },
      performance: monthlyPerformance
    });

  } catch (e) {
    console.error("Metrics logic failed", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

module.exports = router;
