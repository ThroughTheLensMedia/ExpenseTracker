import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllExpenses, fetchExpenseYears, formatMoney, apiGet, apiUpload } from '../api';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useModal } from '../components/ModalContext.jsx';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

export default function Dashboard() {
    const modal = useModal();
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState([]);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [search] = useState('');
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
    const [billsYear, setBillsYear] = useState(new Date().getFullYear());
    const [billsExpenses, setBillsExpenses] = useState([]);
    
    // Intelligence States
    const [startingCash, setStartingCash] = useState(() => Number(localStorage.getItem('studio_cash') || 25000));
    const [pipelineConversion, setPipelineConversion] = useState(60); // Default to 60% as seen in screenshot
    const [burnMode, setBurnMode] = useState('conservative'); 
    const [weights] = useState({ 
        'new lead': 0.1, 
        'inquiry': 0.1,
        'quoted': 0.4, 
        'proposal': 0.4,
        'booked': 0.9, 
        'contract': 0.9,
        'pitching': 0.2, 
        'negotiating': 0.6 
    });

    const [snapLoading, setSnapLoading] = useState(false);
    const [snapSuccess, setSnapSuccess] = useState(false);
    const [showAIWelcome, setShowAIWelcome] = useState(false);
    const [importReminderDays, setImportReminderDays] = useState(() => Number(localStorage.getItem('studio_import_reminder') || 7));
    const [showProjections, setShowProjections] = useState(true);
    const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
    const [visibleCharts, setVisibleCharts] = useState(() => {
        const defaults = { flow: true, trajectory: true, allocation: true, recurring: true, bills: true };
        try {
            const saved = localStorage.getItem('dashboard_charts');
            if (!saved) return defaults;
            return { ...defaults, ...JSON.parse(saved) };
        } catch (e) {
            return defaults;
        }
    });

    useEffect(() => {
        localStorage.setItem('dashboard_charts', JSON.stringify(visibleCharts));
    }, [visibleCharts]);

    const fileInputRef = useRef(null);

    const loadData = async (targetYear = selectedYear) => {
        setLoading(true);
        setError(null);
        try {
            const [exp, lds, yrs] = await Promise.all([
                fetchAllExpenses(false, targetYear),
                apiGet('/leads'),
                fetchExpenseYears()
            ]);
            setExpenses(exp);
            setLeads(lds.leads || []);
            if (yrs.length > 0) {
                setAvailableYears(yrs);
            }
        } catch (e) { 
            console.error(e);
            setError(e.message);
        }
        finally { setLoading(false); }
    };

    useEffect(() => {
        // Initial load should try to find the best starting year with data
        fetchExpenseYears().then(yrs => {
            if (yrs.length > 0) {
                setAvailableYears(yrs);
                // Pick the first year in the list (already sorted desc by API)
                const latest = yrs[0];
                if (latest !== selectedYear) {
                    setSelectedYear(latest);
                } else {
                    loadData(latest);
                }
            } else {
                loadData(selectedYear);
            }
        });
    }, []);

    useEffect(() => {
        localStorage.setItem('studio_cash', startingCash);
    }, [startingCash]);

    useEffect(() => {
        localStorage.setItem('studio_import_reminder', importReminderDays);
    }, [importReminderDays]);

    useEffect(() => {
        loadData();
        const hasSeenAI = localStorage.getItem('has_seen_ai_welcome_v4_4');
        if (!hasSeenAI) {
            setShowAIWelcome(true);
        }
    }, []);

    const dismissAIWelcome = () => {
        localStorage.setItem('has_seen_ai_welcome_v4_4', 'true');
        setShowAIWelcome(false);
    };

    useEffect(() => {
        loadData(selectedYear);
    }, [selectedYear]);

    useEffect(() => {
        const fetchBillsData = async () => {
            try {
                const data = await fetchAllExpenses(false, billsYear);
                setBillsExpenses(data);
            } catch (e) {
                console.error("Failed to fetch bills data", e);
            }
        };
        fetchBillsData();
    }, [billsYear]);

    const operationalExpenses = useMemo(() => {
        const ignore = ['internal transfer', 'credit card payment', 'funds transfer', 'payment', 'transfer'];
        return expenses.filter(r => {
            const cat = String(r.category || '').toLowerCase();
            const vend = String(r.vendor || '').toLowerCase();
            return !ignore.some(i => cat.includes(i) || vend.includes(i));
        });
    }, [expenses]);

    const years = useMemo(() => {
        const set = new Set(availableYears);
        for (const r of operationalExpenses) {
            const y = Number(String(r.expense_date || '').slice(0, 4));
            if (y) set.add(y);
        }
        return [...set].sort((a, b) => b - a);
    }, [operationalExpenses, availableYears]);

    const filtered = useMemo(() => {
        // Double check formatting to ensure matches
        const yearStr = String(selectedYear);
        let rows = operationalExpenses.filter(r => {
            if (!r.expense_date) return false;
            return r.expense_date.includes(yearStr);
        });
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter(r => `${r.vendor} ${r.category} ${r.notes}`.toLowerCase().includes(q));
        }
        return rows;
    }, [operationalExpenses, selectedYear, search]);

    const stats = useMemo(() => {
        let income = 0, spend = 0, missing = 0;
        const byCat = new Map();
        const monthlyData = Array(12).fill().map(() => ({ income: 0, expense: 0 }));
        let lastImportDate = null;
        for (const r of filtered) {
            const cents = Number(r.amount_cents || 0);
            const isIncome = cents < 0;
            if (isIncome) income += Math.abs(cents); else spend += cents;

            if (cents > 7500 && !r.receipt_link) missing++;

            // Track last bank import
            if (r.source && r.source !== 'manual' && r.expense_date) {
                if (!lastImportDate || r.expense_date > lastImportDate) {
                    lastImportDate = r.expense_date;
                }
            }

            const monthIndex = parseInt(String(r.expense_date).slice(5, 7), 10) - 1;
            if (monthIndex >= 0 && monthIndex <= 11) {
                if (isIncome) monthlyData[monthIndex].income += Math.abs(cents);
                else monthlyData[monthIndex].expense += cents;
            }

            if (cents > 0) {
                const c = r.category || 'Uncategorized';
                const cPrev = byCat.get(c) || { count: 0, cents: 0 };
                cPrev.count++; cPrev.cents += cents;
                byCat.set(c, cPrev);
            }
        }
        return { 
            income, spend, net: income - spend, missing, 
            topCats: [...byCat.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 10), 
            monthlyData,
            lastImportDate,
            recurringBills: [...filtered].filter(r => {
                const cents = Number(r.amount_cents || 0);
                return cents > 0; // Spending only
            })
        };
    }, [filtered]);

    // Trendline & Projection Calculation
    const trendStats = useMemo(() => {
        if (!operationalExpenses.length) return null;

        const monthlyMap = new Map();
        for (const r of operationalExpenses) {
            if (!r.expense_date) continue;
            const monthKey = String(r.expense_date).slice(0, 7);
            const cents = Number(r.amount_cents || 0);

            if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { income: 0, spend: 0, net: 0, month: monthKey });

            const st = monthlyMap.get(monthKey);
            if (cents < 0) st.income += Math.abs(cents); else st.spend += cents;
            st.net = st.income - st.spend;
        }

        const sortedMonths = [...monthlyMap.keys()].sort();
        if (sortedMonths.length === 0) return null;

        const last6 = sortedMonths.slice(-6);
        const dataActual = last6.map(m => monthlyMap.get(m));

        // Naive Projection based on 3-month rolling average
        const projBase = dataActual.slice(-3);
        const avgIncome = projBase.reduce((s, d) => s + d.income, 0) / (projBase.length || 1);
        const avgSpend = projBase.reduce((s, d) => s + d.spend, 0) / (projBase.length || 1);
        const avgNet = avgIncome - avgSpend;

        let lastMonthStr = last6[last6.length - 1];
        let [ly, lm] = lastMonthStr.split('-').map(Number);
        const projected = [];
        for (let i = 0; i < 3; i++) {
            lm++;
            if (lm > 12) { lm = 1; ly++; }
            const nextM = `${ly}-${String(lm).padStart(2, '0')}`;
            projected.push({ month: nextM, income: avgIncome, spend: avgSpend, net: avgNet });
        }

        return { actual: dataActual, projected };
    }, [operationalExpenses]);

    // YoY and MoM Variance Calculation
    const variances = useMemo(() => {
        if (!operationalExpenses.length) return { yoyIncome: 0, yoySpend: 0, momIncome: 0, momSpend: 0 };

        const py = selectedYear - 1;
        let pyInc = 0, pySpnd = 0;
        let maxStr = '0000-00';

        for (let r of operationalExpenses) {
            if (!r.expense_date) continue;
            const ym = r.expense_date.slice(0, 7);
            if (ym > maxStr) maxStr = ym;

            if (r.expense_date.startsWith(String(py))) {
                const c = Number(r.amount_cents || 0);
                if (c < 0) pyInc += Math.abs(c); else pySpnd += c;
            }
        }

        let cmInc = 0, cmSpnd = 0;
        let pmInc = 0, pmSpnd = 0;
        let [ly, lm] = maxStr.split('-').map(Number);

        if (!isNaN(ly) && !isNaN(lm)) {
            let prevLm = lm - 1;
            let prevLy = ly;
            if (prevLm === 0) { prevLm = 12; prevLy--; }
            const prevMStr = `${prevLy}-${String(prevLm).padStart(2, '0')}`;

            for (let r of operationalExpenses) {
                if (!r.expense_date) continue;
                const ym = r.expense_date.slice(0, 7);
                const c = Number(r.amount_cents || 0);
                if (ym === maxStr) {
                    if (c < 0) cmInc += Math.abs(c); else cmSpnd += c;
                } else if (ym === prevMStr) {
                    if (c < 0) pmInc += Math.abs(c); else pmSpnd += c;
                }
            }
        }

        const calc = (cur, prv) => prv ? (((cur - prv) / prv) * 100).toFixed(1) : 0;

        return {
            yoyIncome: calc(stats.income, pyInc),
            yoySpend: calc(stats.spend, pySpnd),
            yoyNet: calc(stats.net, pyInc - pySpnd),
            momIncome: calc(cmInc, pmInc),
            momSpend: calc(cmSpnd, pmSpnd)
        };
    }, [operationalExpenses, selectedYear, stats]);

    const renderVariance = (val, type, label) => {
        const num = Number(val);
        if (!num) return null;
        const isGood = type === 'income' ? num > 0 : num < 0;
        const color = isGood ? '#4ade80' : '#ff4d4d';
        return (
            <span style={{ fontSize: '10px', fontWeight: 900, color, marginLeft: '8px', background: `${color}15`, padding: '2px 6px', borderRadius: '4px' }}>
                {label} {num > 0 ? '+' : ''}{num}%
            </span>
        );
    };

    const handleQuickSnap = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSnapLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            await apiUpload('/receipts/snap', formData);
            
            setSnapSuccess(true);
            setTimeout(() => setSnapSuccess(false), 3000);
            loadData(selectedYear);
        } catch (err) {
            modal.alert("Snap failed: " + err.message);
        } finally {
            setSnapLoading(false);
        }
    };

    const barChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
            { label: 'Revenue', data: stats.monthlyData.map(m => m.income / 100), backgroundColor: '#4ade80', borderRadius: 4 },
            { label: 'COGS & Opex', data: stats.monthlyData.map(m => m.expense / 100), backgroundColor: '#ff4d4d', borderRadius: 4 }
        ]
    };

    const chartColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

    const runwayIntel = useMemo(() => {
        const burn = trendStats?.projected[0].spend || 0;
        const cashValue = startingCash * 100;
        const months = burn > 0 ? (cashValue / burn).toFixed(1) : '∞';
        const taxLiability = (stats.net * 0.25);
        return { months, taxLiability: taxLiability > 0 ? taxLiability : 0 };
    }, [startingCash, trendStats, stats.net]);

    const recurringActivity = useMemo(() => {
        const vendorStats = {};
        filtered.forEach(e => {
            const cents = Number(e.amount_cents || 0);
            if (e.vendor && cents > 0) { // Spending only
                if (!vendorStats[e.vendor]) {
                    vendorStats[e.vendor] = { count: 0, total: 0, months: new Set() };
                }
                vendorStats[e.vendor].count++;
                vendorStats[e.vendor].total += cents;
                if (e.expense_date) vendorStats[e.vendor].months.add(e.expense_date.slice(0, 7));
            }
        });
        
        return Object.entries(vendorStats)
            .filter(([_, meta]) => meta.months.size > 1) // Must span at least 2 different months
            .sort((a, b) => b[1].total - a[1].total) // Sort by total spend
            .slice(0, 9); // Top 9 cards for a perfect 3x3 grid
    }, [filtered]);

    const projectedBills = useMemo(() => {
        const vendors = {};
        const priorityCategories = [
            'bills & utilities', 
            'health & medical', 
            'professional services', 
            'subscriptions', 
            'taxes & licenses',
            'health & wellness',
            'fitness',
            'wellness',
            'personal care',
            'entertainment',
            'software',
            'insurance'
        ];

        // Process expenses for the selected Bills Year
        billsExpenses.forEach(r => {
            const cents = Number(r.amount_cents || 0);
            const rawCat = String(r.category || '').toLowerCase();
            const normalizedVendor = String(r.vendor || '').trim().toLowerCase();
            
            // Check for direct match or substring in priority categories
            const isPriority = priorityCategories.some(pc => rawCat.includes(pc));
            
            if (cents > 0 && normalizedVendor && isPriority) {
                if (!vendors[normalizedVendor]) {
                    vendors[normalizedVendor] = {
                        displayName: r.vendor, // Keep the nicely formatted one for display
                        rows: [],
                        category: r.category
                    };
                }
                vendors[normalizedVendor].rows.push(r);
            }
        });

        const bills = Object.entries(vendors)
            .filter(([_, data]) => {
                // SMMARTER CHECK: Must happen in 2+ different months to be a "bill"
                const months = new Set(data.rows.map(r => r.expense_date?.slice(0, 7)));
                return months.size >= 2;
            }) 
            .map(([_, data]) => {
                const vendorRows = data.rows;
                const total = vendorRows.reduce((s, x) => s + (x.amount_cents || 0), 0);
                const avg = total / vendorRows.length;
                const lastDate = [...vendorRows].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date))[0].expense_date;
                return { 
                    vendor: data.displayName, 
                    avg, 
                    count: vendorRows.length, 
                    lastDate, 
                    lastAmount: vendorRows[0].amount_cents, 
                    category: data.category 
                };
            })
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 15);

        return bills;
    }, [billsExpenses]);

    // MBA-Level Rolling 6-Month Intelligence Charts
    const rollingFinancials = useMemo(() => {
        if (!stats.monthlyData) return null;
        
        const now = new Date();
        const currentMonthIdx = now.getMonth(); // 0-11
        
        // 1. Get 3 months of Historical Data (Past 2 + Current)
        const labels = [];
        const marginData = [];
        const incomeData = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        for (let i = -2; i <= 0; i++) {
            let mIdx = (currentMonthIdx + i + 12) % 12;
            labels.push(months[mIdx]);
            const mData = stats.monthlyData[mIdx];
            marginData.push(mData.income > 0 ? ((mData.income - mData.expense) / mData.income * 100).toFixed(1) : 0);
            incomeData.push((mData.income - mData.expense) / 100);
        }

        // 2. Calculate Projected Yield for the next 3 months
        const rawYield = leads.reduce((s, l) => {
            const statusKey = String(l.status || '').toLowerCase();
            return s + (Number(l.estimated_value || 0) * (weights[statusKey] || 0));
        }, 0) * 100;
        const conversionMultiplier = pipelineConversion / 100;
        const monthlyYield = (rawYield * conversionMultiplier) / 3;

        // 3. Calculate Projected Burn
        const burnMultiplier = burnMode === 'growth' ? 1.5 : 1.0;
        const avgBurn = (trendStats?.projected[0].spend || 0) * burnMultiplier;

        // 4. Generate 3 months of Forecast Data
        for (let i = 1; i <= 3; i++) {
            let mIdx = (currentMonthIdx + i + 12) % 12;
            labels.push(`${months[mIdx]} (Proj)`);
            
            // Forecast Net Income = Avg Monthly Yield - Avg Burn
            const forecastNet = (monthlyYield - avgBurn) / 100;
            const forecastMargin = monthlyYield > 0 ? ((monthlyYield - avgBurn) / monthlyYield * 100).toFixed(1) : 0;
            
            marginData.push(forecastMargin);
            incomeData.push(forecastNet);
        }

        return {
            labels,
            marginDataset: {
                labels,
                datasets: [{
                    label: 'Profit Margin %',
                    data: marginData,
                    borderColor: '#4ade80',
                    backgroundColor: 'rgba(74, 222, 128, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    segment: {
                        dash: ctx => ctx.p0DataIndex >= 2 ? [5, 5] : undefined
                    }
                }]
            },
            incomeDataset: {
                labels,
                datasets: [{
                    label: 'Net Income Pulse ($)',
                    data: incomeData,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    segment: {
                        dash: ctx => ctx.p0DataIndex >= 2 ? [5, 5] : undefined
                    }
                }]
            }
        };
    // Projected Yield Explanation:
    // Measures the expected cash inflow based on the probability of closure (weights) 
    // multiplied by your historical conversion efficiency (coefficient).
    // Formula: Sum(Lead Value * Weight) * (Conversion % / 100)
    }, [stats.monthlyData, leads, weights, pipelineConversion, burnMode, trendStats]);

    const allocationData = useMemo(() => {
        return {
            labels: stats.topCats.map(([c]) => c),
            datasets: [{
                data: stats.topCats.map(([_, meta]) => meta.cents / 100),
                backgroundColor: chartColors,
                borderWidth: 0,
                hoverOffset: 15
            }]
        };
    }, [stats.topCats]);

    const trendChartData = useMemo(() => {
        if (!trendStats) return null;
        const labels = [...trendStats.actual, ...trendStats.projected].map(d => d.month);
        return {
            labels,
            datasets: [
                {
                    label: 'Actual / Projected Burn',
                    data: [...trendStats.actual, ...trendStats.projected].map(d => d.spend),
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    segment: {
                        dash: ctx => ctx.p0DataIndex >= trendStats.actual.length - 1 ? [5, 5] : undefined
                    }
                }
            ]
        };
    }, [trendStats]);

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '100px' }}>
            {/* 🧠 AI Intelligence Welcome Modal */}
            {showAIWelcome && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
                    <div className="card glass glow-blue" style={{ width: '100%', maxWidth: '550px', padding: '40px 24px', position: 'relative', textAlign: 'center', margin: 'auto' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '25px' }}>📸</div>
                        <h2 style={{ fontSize: '2.4rem', fontWeight: 950, marginBottom: '15px', letterSpacing: '-0.03em' }}>Welcome to v4.1.3 PRO</h2>
                        <h3 style={{ color: 'var(--accent)', fontWeight: 800, marginBottom: '25px', fontSize: '1.2rem' }}>"EVERYONE BRINGS THEIR OWN BRAIN"</h3>
                        
                        <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '30px' }}>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ fontSize: '20px' }}>🔐</div>
                                <div>
                                    <div style={{ fontWeight: 900, fontSize: '14px', marginBottom: '4px' }}>Isolated Intelligence</div>
                                    <div className="muted" style={{ fontSize: '13px' }}>Your financial data is protected by Row Level Security and never shared or trained on by others. Every photographer brings their own private "Brain".</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ fontSize: '20px' }}>🔎</div>
                                <div>
                                    <div style={{ fontWeight: 900, fontSize: '14px', marginBottom: '4px' }}>Automated Expense Forensic</div>
                                    <div className="muted" style={{ fontSize: '13px' }}>The Brain scans hundreds of historical bank entries in seconds to identify and categorize tax deductions you may have missed.</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ fontSize: '20px' }}>💎</div>
                                <div>
                                    <div style={{ fontWeight: 900, fontSize: '14px', marginBottom: '4px' }}>First-Class Advisor</div>
                                    <div className="muted" style={{ fontSize: '13px' }}>Ask "Your Assistant" (📸) specific questions about your burn rate, largest purchases, or tax strategies.</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button className="btn primary glow-blue" onClick={() => { dismissAIWelcome(); navigate('/StudioControlCenter?tab=intelligence'); }} style={{ flex: 2, padding: '18px', fontWeight: 950 }}>
                                CONNECT YOUR BRAIN
                            </button>
                            <button className="btn secondary" onClick={dismissAIWelcome} style={{ flex: 1, padding: '18px', fontWeight: 900, opacity: 0.6 }}>
                                LATER
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ───── Executive Header ───── */}
            <div className="card glass glow-blue" style={{ padding: '40px', border: 'none', margin: 0, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 950, letterSpacing: '-0.03em', lineHeight: 1 }}>Executive Analytics</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                                <span className="muted" style={{ fontWeight: 700, fontSize: '14px' }}>Financial Command Center</span>
                                <span style={{ padding: '2px 8px', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', borderRadius: '4px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.05em' }}>V4.3.0</span>
                                <span onClick={() => navigate('/StudioControlCenter?tab=help')} style={{ cursor: 'pointer', fontSize: '10px', fontWeight: 900, color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>HELP & DOCS</span>
                                {loading && <span className="spinner-small" style={{ marginLeft: '10px' }}></span>}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 130px)', gridAutoRows: '42px', rowGap: '24px', columnGap: '12px', minWidth: '272px' }}>
                            {/* Control Group A: Configuration */}
                            <button className="btn secondary sm" onClick={() => setChartSettingsOpen(true)} style={{ height: '42px', width: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: '12px', fontWeight: 950, fontSize: '13px', letterSpacing: '0.05em' }}>
                                CHARTS
                            </button>
                            <select 
                                value={selectedYear} 
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="btn secondary sm"
                                style={{ height: '42px', width: '130px', padding: '0 10px', fontWeight: 950, background: 'rgba(255,255,255,0.03)', fontSize: '14px', textAlign: 'center', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>

                            {/* Control Group B: Data Sync */}
                            {(() => {
                                const days = stats.lastImportDate ? Math.floor((new Date() - new Date(stats.lastImportDate)) / (1000 * 60 * 60 * 24)) : null;
                                const statusColor = days === null ? 'rgba(255,255,255,0.1)' : days < 5 ? '#4ade80' : days < 7 ? '#f59e0b' : '#ff4d4d';
                                return (
                                    <div className="card glass sm" style={{ height: '42px', width: '130px', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: `1px solid ${statusColor}`, borderRadius: '12px' }}>
                                         <small style={{ fontSize: '8px', fontWeight: 950, textTransform: 'uppercase', color: statusColor, marginBottom: '2px' }}>{days === null ? 'STATUS' : `${days}D AGE`}</small>
                                        <div style={{ fontSize: '14px', fontWeight: 950 }}>{stats.lastImportDate ? new Date(stats.lastImportDate).toLocaleDateString([], {month: '2-digit', day: '2-digit'}) : 'EMPTY'}</div>
                                    </div>
                                );
                            })()}
                            <button 
                                className="btn primary glow-blue" 
                                onClick={() => navigate('/import')} 
                                style={{ height: '42px', width: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: 0, fontSize: '12px', fontWeight: 950, borderRadius: '12px' }}
                            >
                                SYNC BANK
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="card glass" style={{ border: '1px solid #ff4d4d', padding: '20px', background: 'rgba(255, 77, 77, 0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <div>
                        <div style={{ fontWeight: 900, color: '#ff4d4d' }}>SYSTEM COMMUNICATION ERROR</div>
                        <div className="muted" style={{ fontSize: '13px' }}>{error}. This usually means the API is waking up or there is a database timeout.</div>
                    </div>
                    <button className="btn sm secondary" onClick={() => loadData()} style={{ marginLeft: 'auto' }}>Retry Sync</button>
                </div>
            )}

            {/* Core Intelligence Hero */}
            <div className="grid two mobile-single">
                <div className="card glass glow-blue" style={{ margin: 0, padding: '30px', border: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>STUDIO INTELLIGENCE</h2>
                            <p className="muted small" style={{ fontWeight: 700 }}>MBA-Level Analysis & Pipeline Forecast</p>
                        </div>
                        <div className="tag secondary" style={{ fontSize: '9px', padding: '4px 10px' }}>DYNAMIC AI FORECAST</div>
                    </div>

                    <div className="grid two" style={{ marginTop: '40px' }}>
                        <div>
                            <small className="muted" style={{ fontWeight: 900, display: 'block', marginBottom: '12px' }}>PROJECTED RUNWAY</small>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '20px', color: '#f97316' }}>{runwayIntel.months === '∞' ? '♾️' : '⏱️'}</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 950, lineHeight: 1 }}>
                                        {(() => {
                                            const burnMult = burnMode === 'growth' ? 1.5 : 1.0;
                                            const burn = (trendStats?.projected[0].spend || 0) * burnMult;
                                            const cashValue = startingCash * 100;
                                            return burn > 0 ? (cashValue / burn).toFixed(1) : '∞';
                                        })()}
                                        <span style={{ fontSize: '12px', fontWeight: 900, opacity: 0.5 }}> MONTHS</span>
                                    </div>
                                    <div className="muted extra-small" style={{ fontWeight: 700 }}>
                                        {burnMode === 'growth' ? 'High Velocity ' : 'Standard '} Burn: {formatMoney(((trendStats?.projected[0].spend || 0) * (burnMode === 'growth' ? 1.5 : 1)))}/mo
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <small 
                                onClick={() => modal.alert("Projected Yield is a mathematical forecast of future cash inflows. It takes your current CRM pipeline, applies probability weights based on lead status (Pitching = 20%, Booked = 90%), and then calibrates the total against your selectable Conversion Co-efficient to account for historical studio performance.")}
                                className="muted" 
                                style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', cursor: 'pointer' }}
                            >
                                PROJECTED YIELD <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '50%', width: '14px', height: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>?</span>
                            </small>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '20px', color: '#38bdf8' }}>💰</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 950, lineHeight: 1 }}>
                                        {formatMoney(
                                            leads.reduce((s, l) => {
                                                const statusKey = String(l.status || '').toLowerCase();
                                                return s + (Number(l.estimated_value || 0) * (weights[statusKey] || 0));
                                            }, 0) * 100 * (pipelineConversion / 100)
                                        )}
                                    </div>
                                    <div className="muted extra-small" style={{ fontWeight: 700 }}>Weighted at {pipelineConversion}% efficiency</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card glass" style={{ margin: 0, padding: '30px', border: 'none', background: 'rgba(15, 23, 42, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.1rem', margin: 0, opacity: 0.8 }}>FORECAST CONTROLS</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setBurnMode('conservative')} className={`btn sm ${burnMode === 'conservative' ? 'primary' : 'secondary'}`} style={{ fontSize: '8px' }}>CONSERVATIVE</button>
                            <button onClick={() => setBurnMode('growth')} className={`btn sm ${burnMode === 'growth' ? 'primary' : 'secondary'}`} style={{ fontSize: '8px' }}>GROWTH MODE</button>
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '25px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <small className="muted" style={{ fontWeight: 900 }}>CURRENT STUDIO CASH (LP)</small>
                            <span style={{ color: 'var(--accent)', fontWeight: 950 }}>{formatMoney(startingCash * 100)}</span>
                        </div>
                        <input type="range" min="0" max="250000" step="5000" value={startingCash} onChange={e => setStartingCash(Number(e.target.value))} style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <small className="muted" style={{ fontSize: '9px' }}>$0</small>
                            <small className="muted" style={{ fontSize: '9px' }}>$250K (MBA CAP)</small>
                        </div>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <small className="muted" style={{ fontWeight: 900 }}>PIPELINE CONVERSION CO-EFFICIENT</small>
                            <span style={{ color: '#38bdf8', fontWeight: 950 }}>{pipelineConversion}%</span>
                        </div>
                        <input type="range" min="0" max="200" step="10" value={pipelineConversion} onChange={e => setPipelineConversion(Number(e.target.value))} style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <small className="muted" style={{ fontSize: '9px' }}>0% CRITICAL</small>
                            <small className="muted" style={{ fontSize: '9px' }}>200% AGGRESSIVE</small>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Level KPIs - Single Row Adaptive */}
            <div style={{ 
                display: 'flex', 
                gap: '20px', 
                flexWrap: 'wrap',
                width: '100%'
            }}>
                <div className="card glass" style={{ margin: 0, padding: '24px', border: 'none', background: 'rgba(255,255,255,0.02)', flex: '1 1 300px' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.1em', marginBottom: '8px' }}>GROSS REVENUE</div>
                    <div style={{ fontSize: '2rem', fontWeight: 950, color: '#4ade80', lineHeight: 1 }}>{formatMoney(stats.income)}</div>
                    <div style={{ marginTop: '12px' }}>
                        {renderVariance(variances.momIncome, 'income', 'MoM')}
                        {renderVariance(variances.yoyIncome, 'income', 'YoY')}
                    </div>
                </div>
                <div className="card glass" style={{ margin: 0, padding: '24px', border: 'none', background: 'rgba(255,255,255,0.02)', flex: '1 1 300px' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.1em', marginBottom: '8px' }}>OPERATING EXPENSES</div>
                    <div style={{ fontSize: '2rem', fontWeight: 950, color: '#ff4d4d', lineHeight: 1 }}>{formatMoney(stats.spend)}</div>
                    <div style={{ marginTop: '12px' }}>
                        {renderVariance(variances.momSpend, 'spend', 'MoM')}
                        {renderVariance(variances.yoySpend, 'spend', 'YoY')}
                    </div>
                </div>
                <div className="card glass" style={{ margin: 0, padding: '24px', border: 'none', background: 'rgba(255,255,255,0.02)', flex: '1 1 300px' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.1em', marginBottom: '8px' }}>NET INCOME (EBITDA)</div>
                    <div style={{ fontSize: '2rem', fontWeight: 950, color: '#f8fafc', lineHeight: 1 }}>{formatMoney(stats.net)}</div>
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80' }}>
                            {((stats.net / (stats.income || 1)) * 100).toFixed(1)}% MARGIN
                        </span>
                        {renderVariance(variances.yoyNet, 'income', 'YoY')}
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid two" style={{ gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))' }}>
                {visibleCharts.flow && (
                    <div className="card glass" style={{ margin: 0, padding: '24px', height: '400px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Cash Flow Velocity</h2>
                            <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>MoM Revenue vs COGS Analysis</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'end' } } }} />
                        </div>
                    </div>
                )}
                {visibleCharts.trajectory && (
                    <>
                        <div className="card glass" style={{ margin: 0, padding: '24px', height: '400px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Profit Margin Trajectory</h2>
                                    <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>3-Month Projection ({pipelineConversion}% Conversion)</div>
                                </div>
                                <button onClick={() => modal.alert("FORECAST DATA SOURCE:\n\n1. Historical: Real-time calculation of EBITDA / Gross Revenue.\n2. Projected: Projected Monthly Yield (Weighted CRM Pipeline) minus Average Operational Burn (rolling 3-month avg).")} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}>?</button>
                            </div>
                            <div style={{ flex: 1 }}>
                                {rollingFinancials && <Line data={rollingFinancials.marginDataset} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v + '%' } } } }} />}
                            </div>
                        </div>
                        <div className="card glass" style={{ margin: 0, padding: '24px', height: '400px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Net Income Pulse</h2>
                                    <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Cash Velocity Outlook</div>
                                </div>
                                <button onClick={() => modal.alert("NET INCOME PULSE DATA SOURCE:\n\n1. Historical: Total Monthly Revenue minus total COGS/Expenses.\n2. Projected: Sum of Weighted CRM Inflows distributed over 90 days, minus standard operational burn (adjusted for Growth Mode velocity).")} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}>?</button>
                            </div>
                            <div style={{ flex: 1 }}>
                                {rollingFinancials && <Line data={rollingFinancials.incomeDataset} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => formatMoney(v * 100) } } } }} />}
                            </div>
                        </div>
                    </>
                )}
                {visibleCharts.allocation && (
                    <div className="card glass" style={{ margin: 0, padding: '24px', height: '400px', display: 'flex', flexDirection: 'column', background: 'rgba(15, 23, 42, 0.4)' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Expense Allocation</h2>
                            <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Capital distribution by category</div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: '20px', alignItems: 'center' }}>
                            <div style={{ flex: 1, maxHeight: '280px' }}>
                                <Doughnut data={allocationData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '75%' }} />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                 {stats.topCats.slice(0, 5).map(([cat, meta], idx) => (
                                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: chartColors[idx % chartColors.length] }} />
                                            <span style={{ opacity: 0.8 }}>{cat}</span>
                                        </div>
                                        <span style={{ fontWeight: 900 }}>{((meta.cents / (stats.spend || 1)) * 100).toFixed(0)}%</span>
                                    </div>
                                 ))}
                            </div>
                        </div>
                    </div>
                )}
                {visibleCharts.recurring && (
                    <div className="card glass desktop-only" style={{ margin: 0, padding: '24px', minHeight: '420px', gridColumn: 'span 2' }}>
                        <h2 style={{ fontSize: '1.2rem', margin: '0 0 20px 0' }}>Intelligence: Recurring Vendor Activity</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            {recurringActivity.map(([vendor, meta]) => {
                                const count = meta.count;
                                const total = meta.total;
                                const allocation = stats.spend > 0 ? ((total / stats.spend) * 100).toFixed(1) : 0;
                                return (
                                    <div key={vendor} className="card" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <div className="muted extra-small" style={{ fontWeight: 900, color: '#6366f1' }}>RECURRING VENDOR</div>
                                                <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--accent)' }}>{allocation}% ALLOCATION</div>
                                            </div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 950, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vendor}</div>
                                        </div>
                                        
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                                <span className="tag show" style={{ fontSize: '10px', padding: '4px 10px', background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.2)' }}>{count} transactions</span>
                                                <span style={{ fontWeight: 800, color: '#ff4d4d', fontSize: '1.1rem' }}>{formatMoney(total)}</span>
                                            </div>
                                            <div style={{ marginTop: '12px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${Math.min(allocation * 3, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1 0%, var(--accent) 100%)' }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {recurringActivity.length === 0 && (
                                <div className="muted" style={{ padding: '40px', textAlign: 'center', gridColumn: 'span 5' }}>No recurring vendors detected for {selectedYear} yet.</div>
                            )}
                        </div>
                    </div>
                )}

                {visibleCharts.bills && (
                    <div className="card glass" style={{ margin: 0, padding: '24px', gridColumn: 'span 2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Recurring Monthly Bills</h2>
                                <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Strategic operational overhead tracking</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className="muted extra-small" style={{ fontWeight: 900 }}>HISTORICAL SNAPSHOT:</span>
                                <select 
                                    value={billsYear} 
                                    onChange={e => setBillsYear(Number(e.target.value))}
                                    style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', fontWeight: 900, cursor: 'pointer' }}
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="tableWrap" style={{ border: 'none' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <th style={{ padding: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 900 }}>VENDOR</th>
                                        <th style={{ padding: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 900 }}>CATEGORY</th>
                                        <th style={{ padding: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 900 }}>LAST BILLED</th>
                                        <th style={{ padding: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 900 }}>EST. AMOUNT</th>
                                        <th style={{ padding: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 900, textAlign: 'right' }}>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectedBills.map(b => (
                                        <tr key={b.vendor} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '15px 12px', fontWeight: 900 }}>{b.vendor}</td>
                                            <td style={{ padding: '15px 12px' }}><span className="tag secondary" style={{ fontSize: '10px', padding: '2px 8px' }}>{b.category?.toUpperCase()}</span></td>
                                            <td style={{ padding: '15px 12px', fontSize: '13px', opacity: 0.8 }}>{new Date(b.lastDate).toLocaleDateString()}</td>
                                            <td style={{ padding: '15px 12px', fontWeight: 950, color: '#ff4d4d' }}>{formatMoney(b.avg)}</td>
                                            <td style={{ padding: '15px 12px', textAlign: 'right' }}>
                                                <button onClick={() => navigate('/transactions?q=' + encodeURIComponent(b.vendor))} className="btn sm secondary" style={{ fontSize: '10px', padding: '6px 12px' }}>REVIEW</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {projectedBills.length === 0 && (
                                        <tr><td colSpan="5" className="muted" style={{ padding: '30px', textAlign: 'center' }}>No recurring monthly bills detected yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Customize View Modal */}
            {chartSettingsOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card glass" style={{ width: '100%', maxWidth: '500px', padding: '40px' }}>
                        <h2 style={{ margin: '0 0 10px 0' }}>Dashboard Intelligence</h2>
                        <p className="muted" style={{ marginBottom: '30px' }}>Toggle the modules you want active on your executive command center.</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {Object.entries(visibleCharts).map(([key, isVisible]) => (
                                <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                                        {key === 'recurring' ? 'STRATEGIC VENDOR INTELLIGENCE' : key === 'bills' ? 'MONTHLY BILLS & RECURRING LEAKS' : `${key} ANALYTICS`}
                                    </span>
                                    <input 
                                        type="checkbox" 
                                        checked={isVisible} 
                                        onChange={() => setVisibleCharts(prev => ({ ...prev, [key]: !prev[key] }))}
                                        style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }}
                                    />
                                </label>
                            ))}
                        </div>
                        
                        <button className="btn primary glow-blue" onClick={() => setChartSettingsOpen(false)} style={{ width: '100%', marginTop: '30px', padding: '15px' }}>
                            APPLY LAYOUT
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
