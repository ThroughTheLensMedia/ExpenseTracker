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
            return saved ? JSON.parse(saved) : { flow: true, trajectory: true, allocation: true, burn: true };
        } catch (e) {
            return { flow: true, trajectory: true, allocation: true, burn: true };
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
                                {loading && <span className="spinner-small" style={{ marginLeft: '10px' }}></span>}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn secondary" onClick={() => setChartSettingsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px' }}>
                                <span style={{ fontSize: '16px' }}>⚙️</span>
                                <span style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase' }}>CUSTOMIZE VIEW</span>
                            </button>
                            <select 
                                value={selectedYear} 
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="btn secondary"
                                style={{ padding: '12px 20px', fontWeight: 800, minWidth: '120px', background: 'rgba(255,255,255,0.03)' }}
                            >
                                {years.map(y => <option key={y} value={y}>{y} FISCAL</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ marginTop: '30px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                         <div style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => window.open('https://app.throughthelens.media/StudioDocs', '_blank')}>
                            📄 STUDIO DOCUMENTATION & FAQ
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
                    
                    <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>CURRENT STUDIO CASH</small>
                                <span style={{ color: 'var(--accent)', fontWeight: 950 }}>{formatMoney(startingCash * 100)}</span>
                            </div>
                            <input type="range" min="0" max="100000" step="1000" value={startingCash} onChange={e => setStartingCash(Number(e.target.value))} style={{ width: '100%' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                             <div className="card" style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', flex: 1, textAlign: 'center' }}>
                                <small className="muted" style={{ fontSize: '9px', fontWeight: 900, display: 'block', marginBottom: '4px' }}>LAST IMPORT</small>
                                <div style={{ fontSize: '12px', fontWeight: 900 }}>{stats.lastImportDate ? new Date(stats.lastImportDate).toLocaleDateString() : 'N/A'}</div>
                            </div>
                            <div className="card" onClick={() => navigate('/import')} style={{ padding: '10px 15px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', flex: 1, textAlign: 'center', cursor: 'pointer' }}>
                                <small style={{ color: '#38bdf8', fontSize: '9px', fontWeight: 950, display: 'block', marginBottom: '4px' }}>IMPORT PORTAL</small>
                                <div style={{ fontSize: '12px', fontWeight: 900, color: 'white' }}>SYNC BANK 🏦</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Level KPIs */}
            <div className="grid three mobile-single" style={{ gap: '20px' }}>
                <div className="card glass" style={{ margin: 0, padding: '30px', border: 'none', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.1em', marginBottom: '10px' }}>GROSS REVENUE</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#4ade80', lineHeight: 1 }}>{formatMoney(stats.income)}</div>
                    <div style={{ marginTop: '15px' }}>
                        {renderVariance(variances.momIncome, 'income', 'MoM')}
                        {renderVariance(variances.yoyIncome, 'income', 'YoY')}
                    </div>
                </div>
                <div className="card glass" style={{ margin: 0, padding: '30px', border: 'none', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.1em', marginBottom: '10px' }}>OPERATING EXPENSES</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#ff4d4d', lineHeight: 1 }}>{formatMoney(stats.spend)}</div>
                    <div style={{ marginTop: '15px' }}>
                        {renderVariance(variances.momSpend, 'spend', 'MoM')}
                        {renderVariance(variances.yoySpend, 'spend', 'YoY')}
                    </div>
                </div>
                <div className="card glass" style={{ margin: 0, padding: '30px', border: 'none', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.1em', marginBottom: '10px' }}>NET INCOME (EBITDA)</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#f8fafc', lineHeight: 1 }}>{formatMoney(stats.net)}</div>
                    <div style={{ marginTop: '15px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 900, padding: '4px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
                            {((stats.net / (stats.income || 1)) * 100).toFixed(1)}% PROFIT MARGIN
                        </span>
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
                    <div className="card glass" style={{ margin: 0, padding: '24px', height: '420px', background: 'rgba(15, 23, 42, 0.4)' }}>
                        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Profit Margin Trajectory</h2>
                        <div className="muted" style={{ fontSize: '11px', marginTop: '4px', marginBottom: '20px' }}>Net Yield Percentage by Month</div>
                        
                        <div style={{ textAlign: 'center', paddingTop: '40px' }}>
                            <div style={{ fontSize: '3rem', fontWeight: 950, color: runwayIntel.taxLiability > 0 ? '#f7b955' : '#4ade80' }}>{formatMoney(runwayIntel.taxLiability)}</div>
                            <div className="muted" style={{ fontSize: '11px', marginTop: '8px', fontWeight: 700 }}>ESTIMATED TAX LIABILITY (25%)</div>
                        </div>
                        
                        <div style={{ marginTop: '60px' }}>
                             <div className="muted extra-small" style={{ fontWeight: 900, marginBottom: '15px' }}>CAPITAL ALLOCATION ARCHIVE</div>
                             {stats.topCats.slice(0, 4).map(([cat, meta]) => (
                                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '10px' }}>
                                    <span style={{ opacity: 0.6 }}>{cat}</span>
                                    <span style={{ fontWeight: 900 }}>{((meta.cents / (stats.spend || 1)) * 100).toFixed(0)}%</span>
                                </div>
                             ))}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="card glass" style={{ margin: 0, padding: '24px', borderTop: stats.missing > 0 ? '3px solid #ff4d4d' : '3px solid #4ade80' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', margin: '0 0 4px 0', color: stats.missing > 0 ? '#ff4d4d' : '#4ade80' }}>{stats.missing > 0 ? 'Mobile Audit intelligence' : 'Executive Health OK'}</h3>
                        <div className="muted" style={{ fontSize: '12px' }}>Verification System Status</div>
                    </div>
                    {stats.missing > 0 && (
                        <button className="btn secondary" onClick={() => navigate('/transactions?audit=true')} style={{ fontSize: '13px', padding: '10px 16px', borderColor: 'rgba(255, 77, 77, 0.4)', color: '#ff4d4d', fontWeight: 900 }}>
                            PENDING: {stats.missing} RECEIPTS →
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}
