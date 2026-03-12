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
    Legend
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
    Legend
);

export default function Dashboard() {
    const modal = useModal();
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState([]);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [search] = useState('');
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
    
    // Intelligence States
    const [startingCash, setStartingCash] = useState(() => Number(localStorage.getItem('studio_cash') || 5000));
    const [weights, setWeights] = useState({ 'New Lead': 0.1, 'Quoted': 0.4, 'Booked': 0.9 });

    // PWA Mobile States
    const [snapLoading, setSnapLoading] = useState(false);
    const [snapSuccess, setSnapSuccess] = useState(false);
    const [importReminderDays, setImportReminderDays] = useState(() => Number(localStorage.getItem('studio_import_reminder') || 7));
    const fileInputRef = useRef(null);

    const loadData = async (targetYear = selectedYear) => {
        setLoading(true);
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
                // If current year is empty but we have other years, and this is the first load
                if (exp.length === 0 && targetYear === new Date().getFullYear() && yrs.includes(yrs[0])) {
                   // We don't auto-switch yet, but we'll let the user know or they can use the dropdown
                }
            }
        } catch (e) { console.error(e); }
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
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/pwa/quick-capture', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            if (!res.ok) throw new Error("Upload Failed");

            setSnapSuccess(true);
            setTimeout(() => setSnapSuccess(false), 3000);
            loadData();
        } catch (err) {
            modal.alert("Camera Snap Failed: " + err.message);
        } finally {
            setSnapLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const profitMargin = stats.income > 0 ? ((stats.net / stats.income) * 100).toFixed(1) : 0;
    const avgMonthlyBurn = stats.spend / 12;

    const runwayIntel = useMemo(() => {
        // Weighted Pipeline Value
        let weightedValue = 0;
        leads.forEach(l => {
            const w = weights[l.status] || 0;
            weightedValue += (l.quoted_value_cents || 0) * w;
        });

        const totalLiquidity = (startingCash * 100) + weightedValue;
        const burnPerMonth = avgMonthlyBurn > 100 ? avgMonthlyBurn : 0; // Ignore tiny/zero burn for runway
        const monthsRunway = burnPerMonth > 0 ? (totalLiquidity / burnPerMonth).toFixed(1) : '∞';

        // Additional insights for charts
        const monthlyProfitMargins = stats.monthlyData.map(d => d.income > 0 ? ((d.income - d.expense) / d.income * 100) : 0);
        const taxLiability = stats.income * 0.25; // 25% reserve as estimate

        return {
            weightedValue,
            totalLiquidity,
            monthsRunway: isFinite(monthsRunway) ? monthsRunway : '∞',
            monthlyProfitMargins,
            taxLiability
        };
    }, [leads, weights, startingCash, avgMonthlyBurn, stats]);

    const barChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
            { label: 'Revenue', data: stats.monthlyData.map(d => d.income / 100), backgroundColor: '#4ade80', borderRadius: 4, barPercentage: 0.6 },
            { label: 'COGS & Opex', data: stats.monthlyData.map(d => d.expense / 100), backgroundColor: 'rgba(255, 77, 77, 0.8)', borderRadius: 4, barPercentage: 0.6 }
        ],
    };

    const trendChartData = useMemo(() => {
        if (!trendStats) return null;
        const labels = [...trendStats.actual.map(d => d.month), ...trendStats.projected.map(d => '*' + d.month)];

        const actualNet = trendStats.actual.map(d => d.net / 100);
        const actualIncome = trendStats.actual.map(d => d.income / 100);
        const actualSpend = trendStats.actual.map(d => d.spend / 100);

        const lastActualIdx = trendStats.actual.length - 1;

        const projNet = Array(labels.length).fill(null);
        const projIncome = Array(labels.length).fill(null);
        const projSpend = Array(labels.length).fill(null);

        if (lastActualIdx >= 0) {
            projNet[lastActualIdx] = actualNet[lastActualIdx];
            projIncome[lastActualIdx] = actualIncome[lastActualIdx];
            projSpend[lastActualIdx] = actualSpend[lastActualIdx];
        }

        trendStats.projected.forEach((d, i) => {
            projNet[lastActualIdx + 1 + i] = d.net / 100;
            projIncome[lastActualIdx + 1 + i] = d.income / 100;
            projSpend[lastActualIdx + 1 + i] = d.spend / 100;
        });

        return {
            labels,
            datasets: [
                {
                    label: 'Actual Revenue',
                    data: actualIncome,
                    borderColor: '#4ade80',
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2,
                    pointBackgroundColor: '#4ade80',
                    pointRadius: 4,
                },
                {
                    label: 'Proj. Revenue',
                    data: projIncome,
                    borderColor: '#4ade80',
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2,
                    pointBackgroundColor: '#4ade80',
                    pointRadius: 4,
                    pointStyle: 'rectRot'
                },
                {
                    label: 'Actual Opex',
                    data: actualSpend,
                    borderColor: '#ff4d4d',
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2,
                    pointBackgroundColor: '#ff4d4d',
                    pointRadius: 4,
                },
                {
                    label: 'Proj. Opex',
                    data: projSpend,
                    borderColor: '#ff4d4d',
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2,
                    pointBackgroundColor: '#ff4d4d',
                    pointRadius: 4,
                    pointStyle: 'rectRot'
                },
                {
                    label: 'Actual Net Income',
                    data: actualNet,
                    borderColor: '#2f6bff',
                    backgroundColor: 'rgba(47, 107, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#2f6bff',
                    pointRadius: 4,
                },
                {
                    label: 'Proj. Net (+3Mo)',
                    data: projNet,
                    borderColor: '#f7b955',
                    borderDash: [6, 6],
                    fill: false,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#f7b955',
                    pointRadius: 5,
                    pointStyle: 'rectRot'
                }
            ]
        };
    }, [trendStats]);

    // Expanded color palette for Top 10 categories
    const chartColors = ['#2f6bff', '#4ade80', '#f7b955', '#ff4d4d', '#9333ea', '#06b6d4', '#ec4899', '#f97316', '#8b5cf6', '#14b8a6'];

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto', paddingBottom: '100px' }}>

            {/* ── Dashboard Executive Header ── */}
            <div className="card glass glow-blue" style={{ padding: '24px 30px', border: 'none', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, background: 'linear-gradient(90deg, #fff, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Executive Analytics
                        </h1>
                        <div className="muted" style={{ marginTop: '6px', fontSize: '14px' }}>
                            Financial Command Center • <span className="tag ok" style={{ fontSize: '9px', padding: '2px 6px', verticalAlign: 'middle' }}>V3.6.0-PWA</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="btn secondary" style={{ padding: '10px 16px', borderRadius: '12px', fontWeight: 900, fontSize: '14px', appearance: 'none', outline: 'none', cursor: 'pointer' }}>
                            {years.map(y => <option key={y} value={y}>FY {y}</option>)}
                        </select>
                        <button className="btn primary" onClick={loadData} style={{ padding: '10px 20px', fontSize: '14px' }}>
                            {loading ? 'SYNCING...' : 'SYNC LEDGER'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile-Only Quick Snap Action */}
            <div className="pwa-snap-bar mobile-only" style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={fileInputRef}
                    onChange={handleQuickSnap}
                    style={{ display: 'none' }}
                />
                <button
                    onClick={() => fileInputRef.current.click()}
                    className={`btn ${snapSuccess ? 'ok' : 'glow-blue'}`}
                    style={{ flex: 2, padding: '16px', borderRadius: '16px', fontSize: '14px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={snapLoading}
                >
                    {snapLoading ? "📤 ..." : snapSuccess ? "✅ SAVED" : "📷 QUICK SNAP"}
                </button>
                <button
                    onClick={() => navigate('/crm?new=true')}
                    className="btn secondary"
                    style={{ flex: 1, padding: '16px', borderRadius: '16px', fontSize: '14px', fontWeight: 900, borderColor: 'rgba(56, 189, 248, 0.4)' }}
                >
                    + LEAD
                </button>
            </div>

            {/* ── Studio Intelligence: Runway & Forecast ── */}
            <div className="card glass glow-blue" style={{ display: 'block', width: '100%', padding: '24px 30px', border: 'none', margin: '0 0 20px 0', background: 'linear-gradient(135deg, rgba(47, 107, 255, 0.08) 0%, transparent 100%)', minHeight: '180px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '30px' }}>
                    <div style={{ flex: '1', minWidth: '300px' }}>
                        <h2 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.02em', color: '#fff' }}>STUDIO INTELLIGENCE</h2>
                        <div className="muted" style={{ fontSize: '12px', marginBottom: '25px', fontWeight: 600 }}>CFO Projection & Pipeline Velocity</div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Projected Runway</small>
                                <div style={{ fontSize: '2.5rem', fontWeight: 950, color: runwayIntel.monthsRunway > 6 ? '#4ade80' : '#f7b955', marginTop: '4px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                    {runwayIntel.monthsRunway} <span style={{ fontSize: '12px', opacity: 0.6, fontWeight: 800 }}>MONTHS</span>
                                </div>
                                <div className="muted" style={{ fontSize: '10px', marginTop: '4px', fontWeight: 700 }}>Based on {formatMoney(avgMonthlyBurn)} avg. monthly burn</div>
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Projected Yield</small>
                                <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#fff', marginTop: '4px' }}>{formatMoney(runwayIntel.weightedValue)}</div>
                                <div className="muted" style={{ fontSize: '10px', marginTop: '4px', fontWeight: 700 }}>Weighted value of active leads</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', minWidth: '320px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 style={{ margin: '0 0 15px 0', fontSize: '11px', fontWeight: 900, opacity: 0.8 }}>FORECAST CONTROLS</h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <small className="muted" style={{ fontWeight: 800, fontSize: '10px' }}>CURRENT LIQUIDITY</small>
                                    <div style={{ position: 'relative', width: '120px' }}>
                                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 900, color: '#6366f1' }}>$</span>
                                        <input 
                                            type="number" 
                                            value={startingCash} 
                                            onChange={e => setStartingCash(Number(e.target.value))}
                                            style={{ 
                                                width: '100%', 
                                                padding: '6px 6px 6px 20px', 
                                                fontSize: '13px', 
                                                fontWeight: 900, 
                                                background: 'rgba(255,255,255,0.05)', 
                                                border: '1px solid rgba(99, 102, 241, 0.3)', 
                                                borderRadius: '8px',
                                                color: '#fff',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                                <input 
                                    type="range" min="0" max="250000" step="1000"
                                    value={startingCash} 
                                    onChange={e => setStartingCash(Number(e.target.value))}
                                    style={{ width: '100%', accentColor: '#6366f1', height: '4px', cursor: 'pointer' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                {Object.keys(weights).map(k => (
                                    <div key={k}>
                                        <div style={{ fontSize: '8px', fontWeight: 950, opacity: 0.5, marginBottom: '4px', whiteSpace: 'nowrap' }}>{k.toUpperCase()} Prob.</div>
                                        <select 
                                            value={weights[k]} 
                                            onChange={e => setWeights({...weights, [k]: Number(e.target.value)})}
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px', padding: '6px', fontSize: '10px', fontWeight: 900 }}
                                        >
                                            {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(v => (
                                                <option key={v} value={v}>{(v * 100).toFixed(0)}%</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <small className="muted" style={{ fontWeight: 800, fontSize: '9px' }}>DATA FRESHNESS REMINDER</small>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <input 
                                            type="number" 
                                            value={importReminderDays} 
                                            onChange={e => setImportReminderDays(Number(e.target.value))}
                                            style={{ width: '40px', padding: '4px', fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: '4px', textAlign: 'center' }}
                                        />
                                        <span className="muted" style={{ fontSize: '9px', fontWeight: 800 }}>DAYS</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {stats.lastImportDate && (
                    <div style={{ marginTop: '20px', borderTop: '1px dotted rgba(255,255,255,0.1)', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                        <div style={{ display: 'flex', gap: '30px' }}>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Last Ledger Sync</small>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: (Date.now() - new Date(stats.lastImportDate)) / (1000 * 3600 * 24) > importReminderDays ? '#f59e0b' : '#4ade80', marginTop: '4px' }}>
                                    {stats.lastImportDate} ({(Math.floor((Date.now() - new Date(stats.lastImportDate)) / (1000 * 3600 * 24)))} days ago)
                                </div>
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Vigilance Alert</small>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: '#fff', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    Remind after 
                                    <input 
                                        type="number" 
                                        value={importReminderDays} 
                                        onChange={e => setImportReminderDays(Number(e.target.value))}
                                        style={{ width: '40px', padding: '2px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', textAlign: 'center', fontSize: '10px' }}
                                    />
                                    days
                                </div>
                            </div>
                        </div>
                        {(Date.now() - new Date(stats.lastImportDate)) / (1000 * 3600 * 24) > importReminderDays && (
                            <div className="btn secondary" onClick={() => navigate('/import')} style={{ fontSize: '10px', padding: '8px 16px', borderRadius: '10px', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', fontWeight: 900 }}>
                                🔄 REFRESH LEDGER DATA
                            </div>
                        )}
                    </div>
                )}
            </div>
           
            {/* ── Key Performance Indicators (KPIs) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div className="card glass" style={{ margin: 0, padding: '24px', borderTop: '3px solid #4ade80', borderRadius: '16px' }}>
                    <div className="muted small" style={{ fontWeight: 800, letterSpacing: '0.05em', fontSize: '10px' }}>
                        GROSS REVENUE
                        {renderVariance(variances.yoyIncome, 'income', 'YoY')}
                        {renderVariance(variances.momIncome, 'income', 'MoM')}
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#4ade80', marginTop: '4px' }}>{formatMoney(stats.income)}</div>
                </div>
                <div className="card glass" style={{ margin: 0, padding: '24px', borderTop: '3px solid #ff4d4d', borderRadius: '16px' }}>
                    <div className="muted small" style={{ fontWeight: 800, letterSpacing: '0.05em', fontSize: '10px' }}>
                        OPERATING EXPENSES
                        {renderVariance(variances.yoySpend, 'spend', 'YoY')}
                        {renderVariance(variances.momSpend, 'spend', 'MoM')}
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#ff4d4d', marginTop: '4px' }}>{formatMoney(stats.spend)}</div>
                </div>
                <div className="card glass" style={{ margin: 0, padding: '24px', borderTop: '3px solid #2f6bff', borderRadius: '16px', background: 'linear-gradient(180deg, rgba(47, 107, 255, 0.05), transparent)' }}>
                    <div className="muted small" style={{ fontWeight: 800, letterSpacing: '0.05em', fontSize: '10px' }}>
                        NET INCOME (EBITDA)
                        {renderVariance(variances.yoyNet, 'income', 'YoY')}
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 950, color: stats.net >= 0 ? '#fff' : '#ff4d4d', marginTop: '4px' }}>{formatMoney(stats.net)}</div>
                </div>
            </div>

            {/* ── Advanced Analytics Charts (Desktop) ── */}
            <div className="desktop-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', alignItems: 'start' }}>

                {/* Cash Flow Velocity Chart */}
                <div className="card glass" style={{ margin: 0, padding: '24px', height: '420px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Cash Flow Velocity</h2>
                            <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>MoM Revenue vs COGS Analysis</div>
                        </div>
                    </div>
                    <div style={{ flex: 1, position: 'relative', minHeight: '300px', width: '100%', overflow: 'hidden' }}>
                        <Bar data={barChartData} options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'top', align: 'end', labels: { color: '#a8b6dd', font: { size: 11, weight: 'bold' }, boxWidth: 12, usePointStyle: true } },
                                tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(15,26,51,0.95)', titleColor: '#fff', bodyColor: '#a8b6dd', bodyFont: { size: 13, weight: 'bold' }, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 8 }
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: '#a8b6dd', font: { size: 10, weight: 'bold' } } },
                                y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#a8b6dd', font: { size: 10 }, callback: v => '$' + (v / 1000) + 'k' } }
                            }
                        }} />
                    </div>
                </div>

                {/* NEW: Profit Margin Trajectory */}
                <div className="card glass" style={{ margin: 0, padding: '24px', height: '420px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Profit Margin Trajectory</h2>
                            <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Net Yield Percentage by Month</div>
                        </div>
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Line data={{
                            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                            datasets: [{
                                label: 'Margin %',
                                data: runwayIntel.monthlyProfitMargins,
                                borderColor: '#818cf8',
                                backgroundColor: 'rgba(129, 140, 248, 0.1)',
                                fill: true,
                                tension: 0.4,
                                borderWidth: 3,
                                pointRadius: 4
                            }]
                        }} options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { ticks: { callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                                x: { grid: { display: false } }
                            }
                        }} />
                    </div>
                </div>

                {/* Capital Allocation & Tax Liability */}
                <div className="card glass" style={{ margin: 0, padding: '24px', minHeight: '420px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Capital Allocation</h2>
                            <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Top 10 Expense Categories</div>
                        </div>
                        <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
                            {stats.topCats.length > 0 ? (
                                <Doughnut data={{
                                    labels: stats.topCats.map(c => c[0]),
                                    datasets: [{
                                        data: stats.topCats.map(c => c[1].cents / 100),
                                        backgroundColor: chartColors,
                                        borderWidth: 0,
                                        hoverOffset: 15
                                    }]
                                }} options={{
                                    responsive: true, maintainAspectRatio: false,
                                    cutout: '75%',
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: { backgroundColor: 'rgba(15,26,51,0.95)', bodyColor: '#fff', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, bodyFont: { size: 13, weight: 'bold' }, callbacks: { label: function (context) { return ' $' + context.raw.toLocaleString(); } } }
                                    }
                                }} />
                            ) : (
                                <div className="muted center" style={{ paddingTop: '80px', fontSize: '12px' }}>Insufficient Data</div>
                            )}
                            {stats.topCats.length > 0 && (
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                                    <div className="muted" style={{ fontSize: '10px', fontWeight: 800 }}>OPEX</div>
                                    <div style={{ fontSize: '20px', fontWeight: 950, color: '#fff' }}>{((stats.topCats[0][1].cents / stats.spend) * 100).toFixed(0)}%</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '24px' }}>
                        <div>
                            <small className="muted" style={{ fontWeight: 900, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tax Reservoir Est.</small>
                            <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#f7b955', marginTop: '4px' }}>{formatMoney(runwayIntel.taxLiability)}</div>
                            <div className="muted" style={{ fontSize: '10px', marginTop: '4px', fontWeight: 700 }}>25% of {selectedYear} Net Income</div>
                        </div>
                        
                        <div style={{ marginTop: 'auto' }}>
                             <div className="muted" style={{ fontSize: '10px', fontWeight: 800, marginBottom: '10px' }}>DISTRIBUTION ARCHIVE</div>
                             {stats.topCats.slice(0, 4).map(([cat, meta]) => (
                                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '8px' }}>
                                    <span className="muted" style={{ fontWeight: 700 }}>{cat}</span>
                                    <span style={{ fontWeight: 900 }}>{((meta.cents / stats.spend) * 100).toFixed(0)}%</span>
                                </div>
                             ))}
                        </div>
                    </div>
                </div>

                {/* Burn Velocity Projection */}
                <div className="card glass" style={{ margin: 0, padding: '24px', height: '420px', display: 'flex', flexDirection: 'column' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Burn Velocity Projection</h2>
                            <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Rolling 3-Mos Operational Runrate</div>
                        </div>
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Line data={trendChartData} options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { position: 'top', align: 'end' } },
                            scales: {
                                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => '$' + (v / 1000) + 'k' } },
                                x: { grid: { display: false } }
                            }
                        }} />
                    </div>
                </div>
            </div>

            {/* ── Mobile Analytics Stack (Streamlined) ── */}
            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card glass" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1rem', margin: '0 0 15px 0' }}>Cash Flow Velocity</h3>
                    <div style={{ height: '250px' }}>
                        <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                    </div>
                </div>
                <div className="card glass" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1rem', margin: '0 0 15px 0' }}>Capital Allocation</h3>
                    <div style={{ height: '250px', position: 'relative' }}>
                        <Doughnut data={{
                                labels: stats.topCats.map(c => c[0]),
                                datasets: [{ data: stats.topCats.map(c => c[1].cents / 100), backgroundColor: chartColors, borderWidth: 0 }]
                            }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} 
                        />
                    </div>
                </div>
            </div>

            {/* ── SCC Console: AI Brain Placeholder ── */}
            <div className="card glass" style={{ margin: 0, padding: '24px', borderTop: '3px solid #6366f1', borderRadius: '16px', background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05), transparent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', margin: '0 0 4px 0', color: '#6366f1' }}>SCC Console</h3>
                        <div className="muted" style={{ fontSize: '12px' }}>AI Brain & Predictive Analytics</div>
                    </div>
                    <button className="btn primary" style={{ fontSize: '13px', padding: '10px 16px', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#fff', fontWeight: 900, background: '#6366f1' }}>
                        LAUNCH AI BRAIN →
                    </button>
                </div>
                <div style={{ marginTop: '16px', background: 'rgba(99, 102, 241, 0.08)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                    <div style={{ fontSize: '13px', color: '#c7d2fe', lineHeight: 1.6 }}>
                        The SCC (Studio Command Center) AI Brain provides advanced predictive analytics and strategic recommendations.
                    </div>
                </div>
            </div>

            {/* Trajectory Alert / Audit Intelligence */}
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

                {stats.missing > 0 ? (
                    <div style={{ marginTop: '16px', background: 'rgba(255, 77, 77, 0.08)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 77, 77, 0.15)' }}>
                        <div style={{ fontSize: '13px', color: '#ffd0d0', lineHeight: 1.6 }}>
                            <strong>Critical Warning:</strong> You have {stats.missing} transactions without verification. Use the <strong>Mobile Quick Snap</strong> feature to secure these items immediately.
                        </div>
                    </div>
                ) : (
                    <div style={{ marginTop: '16px', background: 'rgba(25, 195, 125, 0.08)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(25, 195, 125, 0.15)' }}>
                        <div style={{ fontSize: '13px', color: '#baf6db', lineHeight: 1.6 }}>
                            All high-value operations for {selectedYear} are currently documented. Studio risk exposure is minimal.
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

