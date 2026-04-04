import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../utils/api';

export default function DashboardV2({ apiStatus }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metrics, setMetrics] = useState(null);

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
        const loadMetrics = async () => {
            try {
                setLoading(true);
                const data = await apiGet(`/metrics/summary?year=${targetYear}`);
                setMetrics(data);
                setError(null);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        loadMetrics();
    }, [targetYear]);

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
            <div className="card glass glow-blue" style={{ border: 'none', margin: 0, padding: '40px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 1 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 950, letterSpacing: '-0.03em', lineHeight: 1 }}>Executive Analytics V2</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                            <span className="muted" style={{ fontWeight: 700, fontSize: '14px' }}>Financial Command Center</span>
                            {apiStatus && <span style={{ fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: apiStatus.includes('OK') ? 'rgba(74, 222, 128, 0.1)' : 'rgba(2ef, 68, 68, 0.1)', color: apiStatus.includes('OK') ? '#4ade80' : '#ef4444' }}>{apiStatus}</span>}
                            {loading && <span className="spinner-small" style={{ marginLeft: '10px' }}></span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                         <button className="btn secondary" onClick={() => navigate('/legacy')} style={{ fontSize: '12px', fontWeight: 800, padding: '10px 20px', borderRadius: '12px' }}>
                            VIEW LEGACY
                        </button>
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
                <div className="card glass" style={{ margin: 0, padding: '24px', position: 'relative', borderTop: '4px solid #4ade80' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em', marginBottom: '8px' }}>GROSS REVENUE (MTD)</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#4ade80' }}>
                        {loading ? '---' : formatMoney(metrics?.snapshot?.mtdIncome)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                        YTD: {loading ? '---' : formatMoney(metrics?.snapshot?.ytdIncome)}
                    </div>
                </div>

                <div className="card glass" style={{ margin: 0, padding: '24px', position: 'relative', borderTop: '4px solid #f97316' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em', marginBottom: '8px' }}>OPERATING EXPENSE (MTD)</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#f97316' }}>
                        {loading ? '---' : formatMoney(metrics?.snapshot?.mtdSpend)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                        YTD: {loading ? '---' : formatMoney(metrics?.snapshot?.ytdSpend)}
                    </div>
                </div>

                <div className="card glass" style={{ margin: 0, padding: '24px', position: 'relative', borderTop: '4px solid #38bdf8' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em', marginBottom: '8px' }}>NET PROFIT (MTD)</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#38bdf8' }}>
                        {loading ? '---' : formatMoney(metrics?.snapshot?.mtdNet)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                        YTD: {loading ? '---' : formatMoney(metrics?.snapshot?.ytdNet)}
                    </div>
                </div>

                <div className="card glass" style={{ margin: 0, padding: '24px', position: 'relative', borderTop: '4px solid #fcd34d' }}>
                    <div className="muted" style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em', marginBottom: '8px' }}>OPEN RECEIVABLES</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#fcd34d' }}>
                        {loading ? '---' : formatMoney(metrics?.snapshot?.openReceivablesCents)}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                        AWAITING PAYMENT
                    </div>
                </div>
            </div>

            {/* Layer 2 & Layer 3 Container */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                
                {/* Layer 2: Core Performance (Revenue vs Expense vs Net) */}
                <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                    <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Monthly Performance</h2>
                            <div className="muted" style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Revenue vs Expense vs Profit</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '240px', gap: '8px', position: 'relative', marginTop: '20px' }}>
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
                    <div style={{ display: 'flex', gap: '15px', marginTop: '20px', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', background: 'rgba(74, 222, 128, 0.8)', borderRadius: '2px' }}></div> Revenue</div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', background: 'rgba(249, 115, 22, 0.8)', borderRadius: '2px' }}></div> Expense</div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '50%' }}></div> Net Profit</div>
                    </div>
                </div>

                {/* Layer 3: Business Mix (Expense Categories) */}
                <div className="card glass" style={{ margin: 0, padding: '30px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Top Expense Drivers</h2>
                            <div className="muted" style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Ranked by annual spend</div>
                        </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                        {metrics?.analytics?.topCategories?.map((cat, idx) => {
                            const maxSpend = metrics.analytics.topCategories[0].cents || 1;
                            const percent = Math.min(100, Math.max(0, (cat.cents / maxSpend) * 100)); // Scaled against top spender
                            return (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800 }}>
                                         <span style={{ textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>{cat.category || 'UNCATEGORIZED'}</span>
                                         <span>{formatMoney(cat.cents)}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                         <div style={{ height: '100%', width: `${percent}%`, background: idx === 0 ? '#f97316' : 'rgba(255,255,255,0.2)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            );
                        })}
                        {(!metrics?.analytics?.topCategories || metrics.analytics.topCategories.length === 0) && !loading && (
                            <div className="muted" style={{ fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>No categories mapped.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Layer 4: Operational Intelligence (Recurring Subscriptions & Bills) */}
            <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Operational Intelligence</h2>
                        <div className="muted" style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Recurring Vendors & Subscription Leakage</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                    {metrics?.analytics?.recurringVendors?.slice(0, 12).map((sub, idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontWeight: 800, textTransform: 'capitalize', fontSize: '14px' }}>{sub.vendor || 'Unknown Provider'}</div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 950, color: 'white' }}>{formatMoney(sub.avgMonthlyCents)} / mo</div>
                                    <div className="muted" style={{ fontSize: '10px', marginTop: '2px' }}>{formatMoney(sub.annualProjectedCents)} / yr</div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '10px' }}>
                                {sub.flags.isSubscription && <span style={{ padding: '2px 8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '4px', fontSize: '10px', fontWeight: 900 }}>SUBSCRIPTION</span>}
                                {sub.flags.leakageWarning && <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '10px', fontWeight: 900 }}>PERSONAL LEAKAGE</span>}
                                {sub.flags.cancelCandidate && <span style={{ padding: '2px 8px', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', borderRadius: '4px', fontSize: '10px', fontWeight: 900 }}>REVIEW CANDIDATE</span>}
                                {!sub.flags.isSubscription && !sub.flags.leakageWarning && !sub.flags.cancelCandidate && <span style={{ padding: '2px 8px', background: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: '4px', fontSize: '10px', fontWeight: 900 }}>RECURRING VENDOR</span>}
                            </div>
                        </div>
                    ))}
                    {(!metrics?.analytics?.recurringVendors || metrics.analytics.recurringVendors.length === 0) && !loading && (
                        <div className="muted" style={{ fontSize: '13px', fontStyle: 'italic', padding: '20px' }}>No recurring data mapped.</div>
                    )}
                </div>
            </div>

            {/* Layer 5: Cash, Receivables, Obligations */}
            <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Invoice & Obligations Health</h2>
                        <div className="muted" style={{ fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Watch your cash flow liabilities</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '20px', borderRadius: '12px' }}>
                        <div style={{ fontWeight: 900, color: '#ef4444', fontSize: '18px' }}>{loading ? '-' : metrics?.obligations?.overdueInvoices} Overdue</div>
                        <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>Invoices past due date requiring follow-up.</div>
                        <button className="btn sm secondary" onClick={() => navigate('/crm/financials')} style={{ marginTop: '12px', fontSize: '10px' }}>CHASE PAYMENTS</button>
                    </div>
                    
                    <div style={{ flex: 1, minWidth: '200px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px' }}>
                        <div style={{ fontWeight: 900, color: '#fcd34d', fontSize: '18px' }}>{loading ? '-' : metrics?.obligations?.draftInvoices} Drafts</div>
                        <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>Incomplete invoices awaiting signatures or dispatch.</div>
                        <button className="btn sm outline" onClick={() => navigate('/crm/financials')} style={{ marginTop: '12px', fontSize: '10px' }}>FINISH DRAFTS</button>
                    </div>
                </div>
            </div>

            {/* Layer 6: Forecast & Scenario Modeling */}
            <div className="card glass" style={{ margin: 0, padding: '30px', borderTop: '4px solid #a855f7' }}>
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
                            <label style={{ fontSize: '10px', fontWeight: 900, color: '#f97316' }}>EXPECTED MONTHLY EXPENSE CREEP +%</label>
                            <select value={expenseAssump} onChange={e => setExpenseAssump(Number(e.target.value))} style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', fontWeight: 900, fontSize: '14px' }}>
                                <option value={1.00}>Locked (0%)</option>
                                <option value={1.05}>Inflation (5%)</option>
                                <option value={1.15}>Expansion (15%)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    <div style={{ padding: '20px', background: 'rgba(74, 222, 128, 0.05)', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                        <div className="muted" style={{ fontWeight: 900, fontSize: '10px', color: '#4ade80', marginBottom: '8px', letterSpacing: '0.05em' }}>YE PROJECTED REVENUE</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: 'white' }}>{loading ? '-' : formatMoney(projectedRev)}</div>
                    </div>
                    <div style={{ padding: '20px', background: 'rgba(249, 115, 22, 0.05)', borderRadius: '12px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                        <div className="muted" style={{ fontWeight: 900, fontSize: '10px', color: '#f97316', marginBottom: '8px', letterSpacing: '0.05em' }}>YE PROJECTED EXPENSE</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: 'white' }}>{loading ? '-' : formatMoney(projectedExp)}</div>
                    </div>
                    <div style={{ padding: '20px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                        <div className="muted" style={{ fontWeight: 900, fontSize: '10px', color: '#38bdf8', marginBottom: '8px', letterSpacing: '0.05em' }}>ESTIMATED NET PROFIT</div>
                        <div style={{ fontSize: '2rem', fontWeight: 950, color: 'white' }}>{loading ? '-' : formatMoney(projectedNet)}</div>
                    </div>
                </div>
            </div>

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
