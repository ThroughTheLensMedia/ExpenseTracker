import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import OperationalIntelligenceSection from '../components/dashboard/OperationalIntelligenceSection.jsx';
import { fetchDashboardMetrics, getDashboardMetricsCache, apiGet, apiPost } from '../api';

const DEFAULT_WIDGETS = {
    invoices: true,
    forecast: true,
    performance_chart: true,
    top_expenses: true,
    insights: true,
    operational_intelligence: true,
};

export default function DashboardV2({ apiStatus }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [topCatFilter, setTopCatFilter] = useState('ytd'); // 'year', 'last_year', 'ytd', 'month'

    // Widget visibility
    const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
    const [showGearPanel, setShowGearPanel] = useState(false);
    const gearRef = useRef(null);

    // Phase F: Forecast Assumptions
    const [growthAssump, setGrowthAssump] = useState(1.10); // 10% defaults
    const [expenseAssump, setExpenseAssump] = useState(1.05); // 5% defaults
    
    // Derived Forecast
    const moRemaining = 12 - new Date().getMonth() - 1; 
    const avgMonthlyRev = metrics ? (metrics.snapshot.ytdIncome / (12 - moRemaining)) : 0;
    const avgMonthlyExp = metrics ? (metrics.snapshot.ytdSpend / (12 - moRemaining)) : 0;
        
    const projectedRev = metrics ? metrics.snapshot.ytdIncome + ((avgMonthlyRev * growthAssump) * moRemaining) : 0;
    const projectedExp = metrics ? metrics.snapshot.ytdSpend + ((avgMonthlyExp * expenseAssump) * moRemaining) : 0;
    const projectedNet = projectedRev - projectedExp;

    const targetYear = new Date().getFullYear();

    useEffect(() => {
        const loadAll = async () => {
            // Load settings (for widget config) in parallel with metrics
            apiGet('/settings').then(s => {
                const cfg = s?.dashboard_config?.widgets;
                if (cfg) setWidgets({ ...DEFAULT_WIDGETS, ...cfg });
            }).catch(() => {}); // non-blocking — default to all-on on error

            // Stale-while-revalidate: if cached data exists, show it instantly
            const cached = getDashboardMetricsCache(targetYear);
            if (cached) {
                setMetrics(cached);
                setLoading(false);
                fetchDashboardMetrics(targetYear, true)
                    .then(({ data }) => setMetrics(data))
                    .catch(() => {});
                return;
            }
            // Cold load: no cache yet
            try {
                setLoading(true);
                const { data } = await fetchDashboardMetrics(targetYear);
                setMetrics(data);
                setError(null);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        loadAll();
    }, [targetYear]);

    // Close gear panel on outside click
    useEffect(() => {
        function handleClick(e) {
            if (gearRef.current && !gearRef.current.contains(e.target)) setShowGearPanel(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    async function saveWidgets(next) {
        setWidgets(next);
        try {
            const current = await apiGet('/settings');
            await apiPost('/settings', {
                dashboard_config: { ...(current?.dashboard_config || {}), widgets: next },
            });
        } catch {} // non-blocking
    }

    function toggleWidget(key) {
        saveWidgets({ ...widgets, [key]: !widgets[key] });
    }

    // Format currency
    const formatMoney = (cents) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format((cents || 0) / 100);
    };


    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
            {/* Header Area */}
            <div className="card glass glow-blue" style={{ border: 'none', margin: 0, padding: '40px', position: 'relative', overflow: 'visible', zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', position: 'relative' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 950, letterSpacing: '-0.03em', lineHeight: 1 }}>Business Analytics</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                            <span className="muted" style={{ fontWeight: 700, fontSize: '14px' }}>Financial Command Center</span>
                            {loading && <span className="spinner-small" style={{ marginLeft: '10px' }}></span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', position: 'relative' }} ref={gearRef}>
                        <button
                            onClick={() => setShowGearPanel(p => !p)}
                            title="Customize dashboard"
                            style={{ background: showGearPanel ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                        >
                            ⚙️
                        </button>
                        {showGearPanel && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '16px', width: 240, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                                <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Show / Hide Sections</div>
                                {[
                                    { key: 'invoices', label: 'Invoice & Receivables' },
                                    { key: 'forecast', label: 'Year-End Forecast' },
                                    { key: 'performance_chart', label: 'Monthly Performance' },
                                    { key: 'insights', label: 'Financial Insights' },
                                    { key: 'top_expenses', label: 'Top Expense Drivers' },
                                    { key: 'operational_intelligence', label: 'Operational Intelligence' },
                                ].map(({ key, label }) => (
                                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <input
                                            type="checkbox"
                                            checked={widgets[key] !== false}
                                            onChange={() => toggleWidget(key)}
                                            style={{ accentColor: '#f97316', width: 15, height: 15, flexShrink: 0 }}
                                        />
                                        <span style={{ fontSize: 13, fontWeight: 700, color: widgets[key] !== false ? 'white' : 'rgba(255,255,255,0.35)' }}>{label}</span>
                                    </label>
                                ))}
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, margin: '10px 0 0', textAlign: 'center' }}>
                                    Also in Control Center → Dashboard
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="card glass" style={{ border: '1px solid #ff4d4d', padding: '20px', background: 'rgba(255, 77, 77, 0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <div>
                        <div style={{ fontWeight: 900, color: '#ff4d4d' }}>METRICS ENGINE ERROR</div>
                        <div className="muted" style={{ fontSize: '13px' }}>{error}</div>
                    </div>
                </div>
            )}

            {/* Layer 1: Executive Snapshot - Top KPI Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                <div className="card glass cursor-pointer" onClick={() => navigate('/transactions')} style={{ margin: 0, padding: '24px', position: 'relative', borderTop: '4px solid #4ade80', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em', marginBottom: '8px' }}>GROSS REVENUE (MTD)</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#4ade80' }}>
                        {loading ? '---' : formatMoney(metrics?.snapshot?.mtdIncome)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                        YTD: {loading ? '---' : formatMoney(metrics?.snapshot?.ytdIncome)}
                    </div>
                </div>

                <div className="card glass cursor-pointer" onClick={() => navigate('/transactions')} style={{ margin: 0, padding: '24px', position: 'relative', borderTop: '4px solid #f97316', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em', marginBottom: '8px' }}>OPERATING EXPENSE (MTD)</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#f97316' }}>
                        {loading ? '---' : formatMoney(metrics?.snapshot?.mtdSpend)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                        YTD: {loading ? '---' : formatMoney(metrics?.snapshot?.ytdSpend)}
                    </div>
                </div>

                <div className="card glass cursor-pointer" onClick={() => navigate('/transactions')} style={{ margin: 0, padding: '24px', position: 'relative', borderTop: '4px solid #38bdf8', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em', marginBottom: '8px' }}>NET PROFIT (MTD)</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#38bdf8' }}>
                        {loading ? '---' : formatMoney(metrics?.snapshot?.mtdNet)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                        YTD: {loading ? '---' : formatMoney(metrics?.snapshot?.ytdNet)}
                    </div>
                </div>

                <div className="card glass cursor-pointer" onClick={() => navigate('/crm')} style={{ margin: 0, padding: '24px', position: 'relative', borderTop: '4px solid #fcd34d', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em', marginBottom: '8px' }}>OPEN RECEIVABLES</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#fcd34d' }}>
                        {loading ? '---' : formatMoney(metrics?.snapshot?.openReceivablesCents)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                        AWAITING PAYMENT
                    </div>
                </div>
            </div>

            {/* Layer 5: Cash, Receivables, Obligations (Moved up) */}
            {widgets.invoices !== false && <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Invoice & Obligations Health</h2>
                        <div className="muted" style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Watch your cash flow liabilities</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ fontWeight: 900, color: '#ef4444', fontSize: '20px' }}>{loading ? '-' : formatMoney(metrics?.obligations?.overdueCents)}</div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginTop: '4px' }}>{loading ? '-' : metrics?.obligations?.overdueInvoices} Overdue Invoices</div>
                        <button className="btn sm secondary" onClick={() => navigate('/crm/financials')} style={{ marginTop: 'auto', paddingTop: '10px', fontSize: '10px', alignSelf: 'stretch' }}>CHASE PAYMENTS</button>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ fontWeight: 900, color: 'white', fontSize: '20px' }}>{loading ? '-' : formatMoney(metrics?.snapshot?.openReceivablesCents)}</div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginTop: '4px' }}>Total Unpaid Pipeline</div>
                        <button className="btn sm outline" onClick={() => navigate('/crm/financials')} style={{ marginTop: 'auto', paddingTop: '10px', fontSize: '10px', alignSelf: 'stretch' }}>VIEW LEDGER</button>
                    </div>

                    <div style={{ background: 'rgba(252, 211, 77, 0.05)', border: '1px solid rgba(252, 211, 77, 0.2)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ fontWeight: 900, color: '#fcd34d', fontSize: '20px' }}>{loading ? '-' : metrics?.obligations?.dueSoonCount} Expected</div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginTop: '4px' }}>Due within 7 days</div>
                    </div>

                    <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ fontWeight: 900, color: '#38bdf8', fontSize: '20px' }}>{loading ? '-' : metrics?.obligations?.avgDaysToCollect} Days</div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginTop: '4px' }}>Avg Collection Time</div>
                    </div>

                </div>
                {/* Empty state — no invoices yet */}
                {!loading && metrics?.obligations?.overdueCents === 0 && metrics?.obligations?.overdueInvoices === 0 && metrics?.snapshot?.openReceivablesCents === 0 && (
                    <div style={{ marginTop: 16, padding: '14px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, textAlign: 'center' }}>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>No open invoices yet. </span>
                        <button onClick={() => navigate('/crm/financials')} style={{ fontSize: 13, fontWeight: 800, color: '#fcd34d', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Send your first invoice →</button>
                    </div>
                )}
            </div>}

            {/* Layer 6: Forecast & Scenario Modeling (Moved up) */}
            {widgets.forecast !== false && <div className="card glass" style={{ margin: 0, padding: '30px', borderTop: '4px solid #a855f7' }}>
                <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Year-End Growth Forecast</h2>
                        <div className="muted" style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Projected trajectory based on custom variables</div>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', background: 'rgba(255,255,255,0.03)', padding: '10px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, color: '#4ade80' }}>TARGET MONTHLY REVENUE GROWTH +%</label>
                            <select value={growthAssump} onChange={e => setGrowthAssump(Number(e.target.value))} style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', fontWeight: 900, fontSize: '14px' }}>
                                <option value={1.00}>Flat (0%)</option>
                                <option value={1.05}>Conservative (5%)</option>
                                <option value={1.10}>Aggressive (10%)</option>
                                <option value={1.25}>Hyper (25%)</option>
                                <option value={0.90}>Recession (-10%)</option>
                            </select>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, color: '#f87171' }}>EXPECTED MONTHLY EXPENSE CREEP +%</label>
                            <select value={expenseAssump} onChange={e => setExpenseAssump(Number(e.target.value))} style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', fontWeight: 900, fontSize: '14px' }}>
                                <option value={1.00}>Locked (0%)</option>
                                <option value={1.02}>Stable (2%)</option>
                                <option value={1.03}>Avg Inflation (3%)</option>
                                <option value={1.05}>High Inflation (5%)</option>
                                <option value={1.07}>Stressed (7%)</option>
                                <option value={1.15}>Expansion (15%)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    <div style={{ padding: '20px', background: 'rgba(74, 222, 128, 0.05)', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div className="muted" style={{ fontWeight: 900, fontSize: '10px', color: '#4ade80', marginBottom: '8px', letterSpacing: '0.05em' }}>YE PROJECTED REVENUE</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: 'white' }}>{loading ? '-' : formatMoney(projectedRev)}</div>
                    </div>
                    <div style={{ padding: '20px', background: 'rgba(249, 115, 22, 0.05)', borderRadius: '12px', border: '1px solid rgba(249, 115, 22, 0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div className="muted" style={{ fontWeight: 900, fontSize: '10px', color: '#f97316', marginBottom: '8px', letterSpacing: '0.05em' }}>YE PROJECTED EXPENSE</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: 'white' }}>{loading ? '-' : formatMoney(projectedExp)}</div>
                    </div>
                    <div style={{ padding: '20px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <div className="muted" style={{ fontWeight: 900, fontSize: '10px', color: '#38bdf8', marginBottom: '8px', letterSpacing: '0.05em' }}>ESTIMATED NET PROFIT</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: 'white' }}>{loading ? '-' : formatMoney(projectedNet)}</div>
                    </div>
                </div>
            </div>}

            {/* Layer 2 & Layer 3 Container */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                
                {/* Layer 2: Core Performance (Revenue vs Expense vs Net) */}
                {widgets.performance_chart !== false && <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                    <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Monthly Performance</h2>
                            <div className="muted" style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Revenue vs Expense vs Profit</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '180px', gap: '8px', position: 'relative', marginTop: '20px' }}>
                         {/* Minimalist HTML/CSS combo chart implementation */}
                         {metrics?.performance?.map((monthData, i) => {
                             // find max for scaling
                             const max = Math.max(1, ...metrics.performance.map(m => Math.max(m.income, m.spend, m.net)));
                             const incomeHeight = (monthData.income / max) * 100;
                             const spendHeight = (monthData.spend / max) * 100;
                             const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                             return (
                                 <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%', position: 'relative', group: 'true' }}>
                                     {/* Income Bar */}
                                     {monthData.income > 0 && <div style={{ width: '40%', background: 'rgba(74, 222, 128, 0.4)', border: '1px solid #4ade80', position: 'absolute', bottom: '24px', height: `${incomeHeight}%`, left: '10%', borderRadius: '3px 3px 0 0' }} title={`Income: ${formatMoney(monthData.income)}`}></div>}
                                     {/* Spend Bar */}
                                     {monthData.spend > 0 && <div style={{ width: '40%', background: 'rgba(249, 115, 22, 0.4)', border: '1px solid #f97316', position: 'absolute', bottom: '24px', height: `${spendHeight}%`, right: '10%', borderRadius: '3px 3px 0 0' }} title={`Spend: ${formatMoney(monthData.spend)}`}></div>}
                                     
                                     {/* Net profit dot overlay */}
                                     <div style={{ position: 'absolute', bottom: `calc(24px + ${(monthData.net / max) * 100}%)`, left: '50%', transform: 'translate(-50%, 50%)', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', zIndex: 10, boxShadow: '0 0 10px rgba(56, 189, 248, 0.8)' }} title={`Net: ${formatMoney(monthData.net)}`}></div>
                                     
                                     <div className="muted" style={{ fontSize: '10px', fontWeight: 800, marginTop: 'auto' }}>{monthNames[i]}</div>
                                 </div>
                             )
                         })}
                    </div>
                    {/* Empty state — no performance data yet */}
                    {!loading && metrics?.performance?.every(m => m.income === 0 && m.spend === 0) && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 700 }}>
                            No transaction data yet for this year. Import transactions to see performance.
                        </div>
                    )}
                    {/* Financial Insight Strip — Phase 1 + 2 */}
                    {widgets.insights !== false && (() => {
                        const ins = metrics?.insights;
                        const sc = { healthy: '#4ade80', watch: '#fcd34d', risk: '#ef4444' };
                        const bg = { healthy: 'rgba(74,222,128,0.06)', watch: 'rgba(252,211,77,0.06)', risk: 'rgba(239,68,68,0.06)' };
                        const sl = { healthy: '● Healthy', watch: '◐ Watch', risk: '▲ Risk' };
                        const card = (title, primary, secondary, status) => (
                            <div key={title} style={{ background: bg[status] || 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '12px 14px', border: `1px solid ${(sc[status] || '#fff') + '28'}`, textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{title}</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 950, color: sc[status] || 'white', lineHeight: 1.2 }}>{primary}</div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '3px', marginInline: 'auto' }}>{secondary}</div>
                                <div style={{ fontSize: '9px', fontWeight: 900, color: sc[status] || 'rgba(255,255,255,0.3)', marginTop: '5px', letterSpacing: '0.03em', marginInline: 'auto' }}>{sl[status] || ''}</div>
                            </div>
                        );
                        const skeletonCard = (title) => (
                            <div key={title} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{title}</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 950, color: 'rgba(255,255,255,0.15)', marginTop: '4px' }}>—</div>
                            </div>
                        );
                        const titles = ['Margin Quality', 'Cash Reality', 'Expense Pressure', 'Revenue Quality', 'Burn Rate', 'Short-Term Signal'];
                        return (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                {(loading || !ins) ? titles.map(t => skeletonCard(t)) : [
                                    card('Margin Quality',
                                        `${ins.marginQuality.pct}%`,
                                        `${ins.marginQuality.delta >= 0 ? '+' : ''}${ins.marginQuality.delta}% vs last month`,
                                        ins.marginQuality.status),
                                    card('Cash Reality',
                                        `${ins.cashReality.rate}% collected`,
                                        `${formatMoney(ins.cashReality.collected)} in · ${formatMoney(ins.cashReality.open)} open`,
                                        ins.cashReality.status),
                                    card('Expense Pressure',
                                        `${ins.expensePressure.ratio}% fixed`,
                                        `Fixed ${formatMoney(ins.expensePressure.fixed)} · Var ${formatMoney(ins.expensePressure.variable)}`,
                                        ins.expensePressure.status),
                                    card('Revenue Quality',
                                        `${ins.revenueQuality.topPct}%`,
                                        `${ins.revenueQuality.topSource} of revenue`,
                                        ins.revenueQuality.status),
                                    card('Burn Rate',
                                        `${formatMoney(ins.burnRate.avgMonthlySpend)}/mo`,
                                        `${ins.burnRate.monthsRunway} months runway`,
                                        ins.burnRate.monthsRunway > 6 ? 'healthy' : ins.burnRate.monthsRunway > 3 ? 'watch' : 'risk'),
                                    card('Short-Term Signal',
                                        `${ins.shortTermSignal.pctChange >= 0 ? '+' : ''}${ins.shortTermSignal.pctChange}%`,
                                        'vs prior month revenue',
                                        ins.shortTermSignal.pctChange >= 5 ? 'healthy' : ins.shortTermSignal.pctChange >= 0 ? 'watch' : 'risk'),
                                ]}
                            </div>
                        );
                    })()}
                </div>}

                {/* Layer 3: Business Mix (Expense Categories) */}
                {widgets.top_expenses !== false && <div className="card glass" style={{ margin: 0, padding: '30px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Top Expense Drivers</h2>
                            <div className="muted" style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Ranked by spend footprint</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '5px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <select value={topCatFilter} onChange={e => setTopCatFilter(e.target.value)} style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>
                                <option value="year">Full Year</option>
                                <option value="last_year">Last Year</option>
                                <option value="ytd">Year-to-Date</option>
                                <option value="month">Current Month</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                        {(() => {
                            let list = metrics?.analytics?.topCategoriesYear;
                            if (topCatFilter === 'last_year') list = metrics?.analytics?.topCategoriesLastYear;
                            if (topCatFilter === 'ytd') list = metrics?.analytics?.topCategoriesYtd;
                            if (topCatFilter === 'month') list = metrics?.analytics?.topCategoriesMonth;
                            
                            if (!list || list.length === 0) {
                                return !loading ? (
                                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                        <div className="muted" style={{ fontSize: '12px', marginBottom: 8 }}>No expense data yet.</div>
                                        <button onClick={() => navigate('/import')} style={{ fontSize: 12, fontWeight: 800, color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Import transactions →</button>
                                    </div>
                                ) : null;
                            }

                            const maxSpend = list[0]?.cents || 1;
                            return list.map((cat, idx) => {
                                const percent = Math.min(100, Math.max(0, (cat.cents / maxSpend) * 100));
                                const isUncategorized = !cat.category || !String(cat.category).trim();
                                const handleCatClick = () => {
                                    if (isUncategorized) {
                                        navigate('/transactions?needs_category=1');
                                    } else {
                                        navigate('/transactions?category=' + encodeURIComponent(cat.category));
                                    }
                                };
                                return (
                                    <div
                                        key={idx}
                                        onClick={handleCatClick}
                                        title={`View ${isUncategorized ? 'uncategorized' : cat.category} transactions`}
                                        style={{ display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', margin: '0 -8px', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 800 }}>
                                             <span style={{ textTransform: 'uppercase', color: isUncategorized ? '#f97316' : 'rgba(255,255,255,0.8)' }}>{cat.category || 'UNCATEGORIZED'}</span>
                                             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                 <span>{formatMoney(cat.cents)}</span>
                                                 <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>→</span>
                                             </div>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                             <div style={{ height: '100%', width: `${percent}%`, background: isUncategorized ? '#f97316' : (idx === 0 ? '#f97316' : 'rgba(255,255,255,0.2)'), borderRadius: '4px' }}></div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>}
            </div>

            {/* Layer 4: Operational Intelligence (Recurring Subscriptions & Bills) */}
            {widgets.operational_intelligence !== false && (
                <OperationalIntelligenceSection data={metrics?.analytics?.recurringVendors} />
            )}



            {/* Quick Drill-down Strip to prove functionality without charts yet */}
            {!loading && (
                <div style={{ display: 'flex', gap: '15px' }}>
                    <button className="btn outline" onClick={() => navigate('/transactions')} style={{ flex: 1, padding: '16px', fontWeight: 800, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        🔍 View All Transactions
                    </button>
                    <button className="btn outline" onClick={() => navigate('/crm')} style={{ flex: 1, padding: '16px', fontWeight: 800, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        🤝 Check CRM Pipeline
                    </button>
                </div>
            )}
        </section>
    );
}
