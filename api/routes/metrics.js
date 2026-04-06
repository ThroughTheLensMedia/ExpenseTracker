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
          .select("status, due_date, tax_percent, discount_cents, invoice_items(quantity, unit_price_cents)")
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
    const incomeByCategory = {}; // For revenue quality insight
    let priorMonthIncome = 0;
    let priorMonthSpend = 0;
    let totalInvoiceCollected = 0;
    const priorMonth = currentMonth === 1 ? 12 : currentMonth - 1;

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
        if (isNaN(monthNum)) continue;
        
        if (isIncome) {
          ytdIncome += absValue;
          if (monthNum === currentMonth && targetYear == new Date().getFullYear()) {
            mtdIncome += absValue;
          }
          if (monthNum >= 1 && monthNum <= 12) {
             monthlyPerformance[monthNum - 1].income += absValue;
          }
          // Revenue quality: track income by category
          const rawIncCat = row.category || 'Uncategorized';
          incomeByCategory[rawIncCat] = (incomeByCategory[rawIncCat] || 0) + absValue;
          // Prior month delta
          if (monthNum === priorMonth && targetYear == new Date().getFullYear()) {
            priorMonthIncome += absValue;
          }
        } else {
          ytdSpend += absValue;
          if (monthNum === currentMonth && targetYear == new Date().getFullYear()) {
             mtdSpend += absValue;
          }
          if (monthNum >= 1 && monthNum <= 12) {
             monthlyPerformance[monthNum - 1].spend += absValue;
          }
          // Prior month spend delta
          if (monthNum === priorMonth && targetYear == new Date().getFullYear()) {
            priorMonthSpend += absValue;
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

    // Compute Invoice Health, Receivables & Cash Reality
    let openReceivablesCents = 0;
    let overdueCount = 0;
    let overdueCents = 0;
    let dueSoonCount = 0;
    let draftCount = 0;
    
    if (invoices) {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().slice(0, 10);

        for (const inv of invoices) {
            const subtotal = (inv.invoice_items || []).reduce((s, it) => s + ((it.unit_price_cents || 0) * (it.quantity || 0)), 0);
            const tax = Math.round(subtotal * ((inv.tax_percent || 0) / 100));
            const discountPct = (inv.discount_cents || 0) / 10000;
            const discount = Math.round(subtotal * discountPct);
            const totalDue = subtotal + tax - discount;

            // Cash Reality: count paid invoices as collected
            if (inv.status === 'paid') {
                totalInvoiceCollected += totalDue;
            }

            if (inv.status === 'sent') {
                if (totalDue > 0) openReceivablesCents += totalDue;
                if (inv.due_date && inv.due_date < todayStr) {
                    overdueCount++;
                    overdueCents += totalDue;
                } else if (inv.due_date && inv.due_date >= todayStr && inv.due_date <= nextWeekStr) {
                    dueSoonCount++;
                }
            } else if (inv.status === 'draft') {
                draftCount++;
            }
        }
    }

    // === FINANCIAL INSIGHT CALCULATIONS ===

    // 1. Margin Quality
    const marginPct = mtdIncome > 0 ? ((mtdIncome - mtdSpend) / mtdIncome) * 100 : 0;
    const priorMarginPct = priorMonthIncome > 0 ? ((priorMonthIncome - priorMonthSpend) / priorMonthIncome) * 100 : 0;
    const marginDelta = Number((marginPct - priorMarginPct).toFixed(1));
    const marginStatus = marginPct >= 35 ? 'healthy' : marginPct >= 20 ? 'watch' : 'risk';

    // 2. Cash Reality
    const cashPipeline = totalInvoiceCollected + openReceivablesCents;
    const collectionRate = cashPipeline > 0 ? (totalInvoiceCollected / cashPipeline) * 100 : 0;
    const cashStatus = collectionRate >= 85 ? 'healthy' : collectionRate >= 70 ? 'watch' : 'risk';

    // 3. Expense Pressure (recurring vendors = fixed costs proxy)
    const fixedMonthlyCents = recurringVendors.reduce((s, v) => s + v.avgMonthlyCents, 0);
    const variableCents = Math.max(0, mtdSpend - fixedMonthlyCents);
    const fixedRatioPct = mtdSpend > 0 ? (fixedMonthlyCents / mtdSpend) * 100 : 0;
    const expenseStatus = fixedRatioPct < 50 ? 'healthy' : fixedRatioPct < 70 ? 'watch' : 'risk';

    // 4. Revenue Quality (top income category as % of YTD)
    const incomeEntries = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]);
    const topIncomeSource = incomeEntries[0] || ['Unknown', 0];
    const topSourcePct = ytdIncome > 0 ? (topIncomeSource[1] / ytdIncome) * 100 : 0;
    const revenueStatus = topSourcePct <= 40 ? 'healthy' : topSourcePct <= 60 ? 'watch' : 'risk';

    // 5. Burn Rate (avg of last 3 completed months spend)
    const completedMonths = monthlyPerformance.slice(0, Math.max(0, currentMonth - 1)).filter(m => m.spend > 0);
    const last3 = completedMonths.slice(-3);
    const avgBurnRate = last3.length > 0 ? last3.reduce((s, m) => s + m.spend, 0) / last3.length : mtdSpend;
    const cashOnHand = ytdIncome - ytdSpend;
    const monthsRunway = avgBurnRate > 0 ? Number((cashOnHand / avgBurnRate).toFixed(1)) : 0;

    // 6. Short-Term Signal (current vs prior month revenue)
    const shortTermPct = priorMonthIncome > 0 ? Number((((mtdIncome - priorMonthIncome) / priorMonthIncome) * 100).toFixed(1)) : 0;

    res.json({
      snapshot: {
        mtdIncome, mtdSpend, mtdNet: mtdIncome - mtdSpend,
        ytdIncome, ytdSpend, ytdNet: ytdIncome - ytdSpend,
        openReceivablesCents
      },
      analytics: { topCategories, recurringVendors },
      obligations: {
        overdueInvoices: overdueCount, overdueCents,
        dueSoonCount, avgDaysToCollect: 14, draftInvoices: draftCount
      },
      performance: monthlyPerformance,
      insights: {
        marginQuality:    { pct: Number(marginPct.toFixed(1)), delta: marginDelta, status: marginStatus },
        cashReality:      { collected: totalInvoiceCollected, open: openReceivablesCents, rate: Number(collectionRate.toFixed(1)), status: cashStatus },
        expensePressure:  { fixed: Math.round(fixedMonthlyCents), variable: Math.round(variableCents), ratio: Number(fixedRatioPct.toFixed(1)), status: expenseStatus },
        revenueQuality:   { topSource: topIncomeSource[0], topPct: Number(topSourcePct.toFixed(1)), status: revenueStatus },
        burnRate:         { avgMonthlySpend: Math.round(avgBurnRate), monthsRunway },
        shortTermSignal:  { pctChange: shortTermPct, direction: shortTermPct >= 0 ? 'up' : 'down' }
      }
    });

  } catch (e) {
    console.error("Metrics logic failed:", e?.message || e, e?.details || '', e?.hint || '');
    res.status(500).json({ error: String(e.message || e), details: e?.details, hint: e?.hint });
  }
});

module.exports = router;
