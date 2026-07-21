const express = require("express");
const router = express.Router();
const { isNonSpendRow, KNOWN_SUBSCRIPTION_VENDORS } = require("../utils/spendCategories");
const { deriveCadenceDays, monthlyEquivalentCents } = require("../utils/recurringVendors");

router.get("/summary", async (req, res) => {
  try {
    const targetYear = req.query.year || new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const startDate = `${targetYear - 1}-01-01`;
    const endDate = `${targetYear}-12-31`;

    // Fire invoices and vendor_settings in parallel while paginating expenses
    const invoicesPromise = req.sb
        .from("invoices")
        .select("status, due_date, tax_percent, discount_cents, invoice_items(quantity, unit_price_cents)")
        .eq("user_id", req.user.id);
    const vendorSettingsPromise = req.sb
        .from("vendor_settings")
        .select("vendor, is_ignored")
        .eq("user_id", req.user.id)
        .then(r => r).catch(() => ({ data: null }));
    const vendorAliasesPromise = req.sb
        .from("vendor_aliases")
        .select("vendor_key, canonical_name")
        .eq("user_id", req.user.id)
        .then(r => r).catch(() => ({ data: null }));

    let allExpenses = [];
    let offset = 0;
    let keepFetching = true;
    let expError = null;

    // Auto-paginate safely through 1000+ row barriers
    while (keepFetching) {
        const { data, error } = await req.sb
            .from("expenses")
            .select("amount_cents, expense_date, category, vendor, is_subscription, billing_cycle, tax_deductible, business_use_pct")
            .gte("expense_date", startDate)
            .lte("expense_date", endDate)
            .eq("user_id", req.user.id)
            .range(offset, offset + 999);

        if (error) {
            expError = error;
            break;
        }
        if (data && data.length > 0) {
            allExpenses = allExpenses.concat(data);
            offset += 1000;
        }
        if (!data || data.length < 1000) {
            keepFetching = false;
        }
    }

    // Await the parallel fetches now that pagination is done
    const [{ data: invoices, error: invError }, { data: vSettings }, { data: vAliases }] = await Promise.all([
        invoicesPromise,
        vendorSettingsPromise,
        vendorAliasesPromise,
    ]);

    if (expError) throw expError;
    if (invError) throw invError;

    // Build ignored vendors list (safe — vendor_settings table may not exist yet)
    const ignoredVendorsList = vSettings
        ? vSettings.filter(v => v.is_ignored).map(v => String(v.vendor).toLowerCase())
        : [];

    // Resolve vendor name variants (e.g. "Starlink" + "Starlink Internet") to
    // one canonical name for recurring-spend rollups. Untouched vendors pass
    // through unchanged — this map is empty until a user explicitly merges.
    const vendorAliasMap = {};
    (vAliases || []).forEach(a => { vendorAliasMap[String(a.vendor_key).toLowerCase()] = String(a.canonical_name).toLowerCase(); });

    let ytdIncome = 0;
    let ytdSpend = 0;
    let mtdIncome = 0;
    let mtdSpend = 0;
    let ytdDeductibleCents = 0; // same formula as tax.js: tax_deductible ? amount * business_use_pct/100 : 0

    const knownSubscriptions = KNOWN_SUBSCRIPTION_VENDORS;
    const leakageWarningKeywords = ['netflix', 'hulu', 'spotify', 'peloton', 'xbox', 'playstation', 'door dash', 'ubereats'];

    const categoryBreakdownYear = {};
    const categoryBreakdownLastYear = {};
    const categoryBreakdownYtd = {};
    const categoryBreakdownMonth = {};

    const vendorActivity = {}; // For recurring tracking
    const monthlyPerformance = Array(12).fill().map((_, i) => ({ month: String(i + 1).padStart(2, '0'), income: 0, spend: 0, net: 0 }));
    const incomeByCategory = {}; // For revenue quality insight
    let priorMonthIncome = 0;
    let priorMonthSpend = 0;
    let totalInvoiceCollected = 0;
    const priorMonth = currentMonth === 1 ? 12 : currentMonth - 1;

    if (allExpenses.length > 0) {
      for (const row of allExpenses) {
        const cat = String(row.category || '').toLowerCase();
        const rawVend = String(row.vendor || '').toLowerCase();
        const vend = vendorAliasMap[rawVend] || rawVend;

        // Skip non-spend rows — shared with cron.js's weekly digest so the
        // dashboard and email agree on the same YTD totals (v7.14.0 fix).
        if (isNonSpendRow(row.category, row.vendor)) continue;

        const cents = Number(row.amount_cents || 0);
        const isIncome = cents < 0;
        const absValue = Math.abs(cents);
        
        const dateParts = String(row.expense_date || '').split('T')[0].split('-');
        const rowYear = parseInt(dateParts[0], 10);
        const monthNum = parseInt(dateParts[1], 10);
        if (isNaN(monthNum) || isNaN(rowYear)) continue;
        
        const rawCat = row.category || 'Uncategorized';
        
        if (rowYear == targetYear - 1 && !isIncome) {
            categoryBreakdownLastYear[rawCat] = (categoryBreakdownLastYear[rawCat] || 0) + absValue;
        }

        if (rowYear == targetYear) {
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
              if (row.tax_deductible) {
                const pct = (row.business_use_pct === null || row.business_use_pct === undefined) ? 100 : row.business_use_pct;
                ytdDeductibleCents += absValue * (pct / 100);
              }
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
              
              categoryBreakdownYear[rawCat] = (categoryBreakdownYear[rawCat] || 0) + absValue;
              
              if (targetYear == new Date().getFullYear()) {
                  if (monthNum <= currentMonth) {
                      categoryBreakdownYtd[rawCat] = (categoryBreakdownYtd[rawCat] || 0) + absValue;
                  }
                  if (monthNum === currentMonth) {
                      categoryBreakdownMonth[rawCat] = (categoryBreakdownMonth[rawCat] || 0) + absValue;
                  }
              }

              // Track vendor hits for recurrence
              if (vend) {
                 if (!vendorActivity[vend]) {
                     vendorActivity[vend] = { count: 0, total: 0, lastDate: row.expense_date, is_sub: false, dates: [], billingCycle: null };
                 }
                 vendorActivity[vend].count += 1;
                 vendorActivity[vend].total += absValue;
                 vendorActivity[vend].dates.push(row.expense_date);
                 if (row.is_subscription) vendorActivity[vend].is_sub = true;
                 if (row.billing_cycle) vendorActivity[vend].billingCycle = row.billing_cycle;
                 if (row.expense_date > vendorActivity[vend].lastDate) {
                     vendorActivity[vend].lastDate = row.expense_date;
                 }
              }
            }
        }
        
      }
      
      // Compute Net per month
      for (let i = 0; i < 12; i++) {
        monthlyPerformance[i].net = monthlyPerformance[i].income - monthlyPerformance[i].spend;
      }
    }

    const formatTop = (bdown) => Object.entries(bdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([category, cents]) => ({ category, cents }));

    const topCategoriesYear = formatTop(categoryBreakdownYear);
    const topCategoriesLastYear = formatTop(categoryBreakdownLastYear);
    const topCategoriesYtd = formatTop(categoryBreakdownYtd);
    const topCategoriesMonth = formatTop(categoryBreakdownMonth);

    // Compute Recurring Vendors
    const recurringVendors = [];
    for (const [vend, data] of Object.entries(vendorActivity)) {
        const isKnownSub = data.is_sub || knownSubscriptions.some(k => vend.includes(k));
        if (data.count >= 3 || isKnownSub) {
            const avgCostPerOccurrence = data.total / data.count;
            const { cadenceDays, cadenceConfirmed } = deriveCadenceDays(data.dates, data.billingCycle);
            const avgMonthlyCents = monthlyEquivalentCents(avgCostPerOccurrence, cadenceDays);
            const isLeakage = leakageWarningKeywords.some(k => vend.includes(k));

            recurringVendors.push({
                vendor: vend,
                avgMonthlyCents,
                annualProjectedCents: avgMonthlyCents * 12,
                lastSeen: data.lastDate,
                cadenceConfirmed,
                flags: {
                    isSubscription: isKnownSub,
                    review: data.count < 6 && avgCost > 2000, 
                    duplicate: false,
                    unused: false,
                    ignored: ignoredVendorsList.includes(vend)
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
        openReceivablesCents, ytdDeductibleCents
      },
      analytics: {
        topCategoriesYear,
        topCategoriesLastYear,
        topCategoriesYtd,
        topCategoriesMonth,
        recurringVendors
      },
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
