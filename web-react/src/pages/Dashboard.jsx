import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllExpenses, fetchExpenseYears, formatMoney, apiGet } from '../api';
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
    
    // Intelligence States
    const [startingCash, setStartingCash] = useState(25000); // Default estimate
    const [weights, setWeights] = useState({ 'New Lead': 0.1, 'Quoted': 0.4, 'Booked': 0.9 });

    // PWA Mobile States
    const [snapLoading, setSnapLoading] = useState(false);
    const [snapSuccess, setSnapSuccess] = useState(false);
    const [importReminderDays, setImportReminderDays] = useState(() => Number(localStorage.getItem('studio_import_reminder') || 7));
    const [showProjections, setShowProjections] = useState(true);
    const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
    const [visibleCharts, setVisibleCharts] = useState(() => {
        try {
            const saved = localStorage.getItem('dashboard_charts');
            return saved ? JSON.parse(saved) : { flow: true, trajectory: true, allocation: true, recurring: true };
        } catch (e) {
            return { flow: true, trajectory: true, allocation: true, recurring: true };
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
                fetchAllExpenses(true, targetYear),
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
        loadData(selectedYear);
    }, [selectedYear]);

    const operationalExpenses = useMemo(() => {
        const ignore = ['internal transfer', 'credit card payment', 'funds transfer'];
        return expenses.filter(r => {
            const cat = String(r.category || '').toLowerCase();
            return !ignore.some(i => cat.includes(i));
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
            lastImportDate
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
            formData.append('receipt', file);
            
            const r = await fetch('/api/receipts/snap', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            if (!r.ok) throw new Error('Upload failed');
            
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
        const vendorCounts = {};
        filtered.forEach(e => {
            if (e.vendor) vendorCounts[e.vendor] = (vendorCounts[e.vendor] || 0) + 1;
        });
        return Object.entries(vendorCounts)
            .filter(([_, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [filtered]);

    const trajectoryData = useMemo(() => {
        if (!stats.monthlyData) return null;
        return {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Profit Margin %',
                data: stats.monthlyData.map(m => m.income > 0 ? ((m.income - m.expense) / m.income * 100).toFixed(1) : 0),
                borderColor: '#4ade80',
                backgroundColor: 'rgba(74, 222, 128, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
            }]
        };
    }, [stats.monthlyData]);

    const netIncomeData = useMemo(() => {
        if (!stats.monthlyData) return null;
        return {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Monthly Net Income ($)',
                data: stats.monthlyData.map(m => (m.income - m.expense) / 100),
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
            }]
        };
    }, [stats.monthlyData]);

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
            {/* ───── Executive Header ───── */}
            <div className="card glass glow-blue" style={{ padding: '40px', border: 'none', margin: 0, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 950, letterSpacing: '-0.03em', lineHeight: 1 }}>Executive Analytics</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                                <span className="muted" style={{ fontWeight: 700, fontSize: '14px' }}>Financial Command Center</span>
                                <span style={{ padding: '2px 8px', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', borderRadius: '4px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.05em' }}>V3.6.1-PWA</span>
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
                <div className="card glass" style={{ margin: 0, padding: '30px', border: 'none', background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>STUDIO INTELLIGENCE</h2>
                            <p className="muted small" style={{ fontWeight: 700 }}>CFO Projection & Pipeline Velocity</p>
                        </div>
                        <div className="tag secondary" style={{ fontSize: '9px', padding: '4px 10px' }}>PRO FORECAST</div>
                    </div>

                    <div className="grid two" style={{ marginTop: '40px' }}>
                        <div>
                            <small className="muted" style={{ fontWeight: 900, display: 'block', marginBottom: '12px' }}>PROJECTED RUNWAY</small>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '20px', color: '#f97316' }}>{runwayIntel.months === '∞' ? '♾️' : '⏱️'}</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 950, lineHeight: 1 }}>{runwayIntel.months} <span style={{ fontSize: '12px', fontWeight: 900, opacity: 0.5 }}>MONTHS</span></div>
                                    <div className="muted extra-small" style={{ fontWeight: 700 }}>Based on {formatMoney(trendStats?.projected[0].spend || 0)} avg. monthly burn</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <small className="muted" style={{ fontWeight: 900, display: 'block', marginBottom: '12px' }}>PROJECTED YIELD</small>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '20px', color: '#38bdf8' }}>💰</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 950, lineHeight: 1 }}>{formatMoney(leads.reduce((s, l) => s + (Number(l.estimated_value || 0) * (weights[l.status] || 0)), 0) * 100)}</div>
                                    <div className="muted extra-small" style={{ fontWeight: 700 }}>Weighted value of active leads</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card glass" style={{ margin: 0, padding: '30px', border: 'none', background: 'rgba(15, 23, 42, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.1rem', margin: 0, opacity: 0.8 }}>FORECAST CONTROLS</h2>
                    </div>
                    
                    <div style={{ marginTop: '25px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <small className="muted" style={{ fontWeight: 900 }}>CURRENT STUDIO CASH</small>
                            <span style={{ color: 'var(--accent)', fontWeight: 950 }}>{formatMoney(startingCash * 100)}</span>
                        </div>
                        <input type="range" min="0" max="100000" step="1000" value={startingCash} onChange={e => setStartingCash(Number(e.target.value))} style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <small className="muted" style={{ fontSize: '9px' }}>$0</small>
                            <small className="muted" style={{ fontSize: '9px' }}>$100K+</small>
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
            <div className="grid two mobile-single" style={{ gap: '20px' }}>
                {visibleCharts.flow && (
                    <div className="card glass" style={{ margin: 0, padding: '24px', height: '420px', display: 'flex', flexDirection: 'column' }}>
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
                        <div className="card glass" style={{ margin: 0, padding: '24px', height: '420px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Profit Margin Trajectory</h2>
                                <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Real-time profitability yield per month (%)</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                {trajectoryData && <Line data={trajectoryData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v + '%' } } } }} />}
                            </div>
                        </div>
                        <div className="card glass" style={{ margin: 0, padding: '24px', height: '420px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Net Income Pulse</h2>
                                <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Monthly net profitability in USD</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                {netIncomeData && <Line data={netIncomeData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => formatMoney(v * 100) } } } }} />}
                            </div>
                        </div>
                    </>
                )}
                {visibleCharts.allocation && (
                    <div className="card glass" style={{ margin: 0, padding: '24px', height: '420px', display: 'flex', flexDirection: 'column', background: 'rgba(15, 23, 42, 0.4)' }}>
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
                    <div className="card glass" style={{ margin: 0, padding: '24px', height: '420px', gridColumn: 'span 2' }}>
                        <h2 style={{ fontSize: '1.2rem', margin: '0 0 20px 0' }}>Intelligence: Recurring Activity</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            {recurringActivity.map(([vendor, count]) => {
                                const total = filtered.filter(f => f.vendor === vendor).reduce((s, x) => s + (x.amount_cents || 0), 0);
                                const allocation = stats.spend > 0 ? ((total / stats.spend) * 100).toFixed(1) : 0;
                                return (
                                    <div key={vendor} className="card" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div className="muted extra-small" style={{ fontWeight: 900 }}>RECURRING VENDOR</div>
                                            <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--accent)' }}>{allocation}% ALLOCATION</div>
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 950, marginBottom: '4px' }}>{vendor}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                            <span className="tag ok" style={{ fontSize: '10px' }}>{count} transactions</span>
                                            <span style={{ fontWeight: 800, color: '#ff4d4d' }}>{formatMoney(total)}</span>
                                        </div>
                                        <div style={{ marginTop: '12px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: `${allocation}%`, height: '100%', background: 'var(--accent)' }} />
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
            </div>
            
            {/* Customize View Modal */}
            {chartSettingsOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card glass" style={{ width: '100%', maxWidth: '500px', padding: '40px' }}>
                        <h2 style={{ margin: '0 0 10px 0' }}>Dashboard Intelligence</h2>
                        <p className="muted" style={{ marginBottom: '30px' }}>Toggle the modules you want active on your executive command center.</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {Object.entries(visibleCharts).map(([key, val]) => (
                                <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', cursor: 'pointer' }}>
                                    <span style={{ fontWeight: 800, textTransform: 'capitalize' }}>{key} Module</span>
                                    <input 
                                        type="checkbox" 
                                        checked={val} 
                                        onChange={() => setVisibleCharts(prev => ({ ...prev, [key]: !prev[key] }))}
                                        style={{ width: '20px', height: '20px' }}
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
