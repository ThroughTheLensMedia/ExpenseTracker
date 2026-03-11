import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, fetchAllExpenses, apiDelete } from '../api';
import { useModal } from '../components/ModalContext.jsx';
import CategorySelect from '../components/CategorySelect.jsx';

const QUICK_SUBS = [
    { name: 'Starlink', cat: 'Bills & Utilities', bucket: 'Utilities', bizPct: 100 },
    { name: 'Adobe', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 },
    { name: 'Pixieset', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 },
    { name: 'Google', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 },
    { name: 'Cloudflare', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 },
    { name: 'Apple.com', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 }
];

export default function Rules() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const modal = useModal();

    // New Rule State
    const [matchColumn, setMatchColumn] = useState('vendor');
    const [matchType, setMatchType] = useState('contains');
    const [matchValue, setMatchValue] = useState('');
    const [category, setCategory] = useState('');
    const [taxBucket, setTaxBucket] = useState('');
    const [deductible, setDeductible] = useState(true);
    const [bizPct, setBizPct] = useState(100);
    const [msg, setMsg] = useState('');
    const [applyMsg, setApplyMsg] = useState('');
    const [applying, setApplying] = useState(false);
    const [allExpenses, setAllExpenses] = useState([]);
    const [ruleStatus, setRuleStatus] = useState({});

    const loadRules = async () => {
        setLoading(true);
        try {
            const data = await apiGet('/rules');
            setRules(data.rules || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        loadRules();
        fetchAllExpenses().then(data => setAllExpenses(data || [])).catch(() => { });
    }, []);

    // Discovery: Vendors with 3+ transactions and NO rule
    const discoveryVendors = useMemo(() => {
        const counts = {};
        allExpenses.forEach(e => { if (e.vendor) counts[e.vendor] = (counts[e.vendor] || 0) + 1; });

        return Object.entries(counts)
            .filter(([name, count]) => {
                const hasRule = rules.some(r => r.match_column === 'vendor' && name.toLowerCase().includes(r.match_value.toLowerCase()));
                return !hasRule && count >= 2;
            })
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);
    }, [allExpenses, rules]);

    const handleCreate = async (customPayload = null) => {
        setMsg("Saving rule...");
        try {
            const data = customPayload || {
                match_column: matchColumn,
                match_type: matchType,
                match_value: matchValue,
                assign_category: category,
                assign_tax_bucket: taxBucket,
                assign_tax_deductible: deductible,
                assign_business_use_pct: Number(bizPct) || 100
            };

            await apiPost('/rules', data);
            setMsg("✅ Rule created.");
            setMatchValue(''); setCategory(''); setTaxBucket('');
            loadRules();
        } catch (err) { setMsg(`❌ Failed: ${err.message}`); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete rule?')) return;
        await apiDelete(`/rules/${id}`); loadRules();
    };

    const handleApplyRules = async () => {
        setApplying(true); setApplyMsg('Applying...');
        try {
            const r = await fetch('/api/import/apply-rules', { method: 'POST', credentials: 'include' });
            const data = await r.json();
            setApplyMsg(`✅ Updated ${data.updated} rows.`);
            setTimeout(() => setApplyMsg(''), 5000);
        } catch (e) { setApplyMsg(`❌ ${e.message}`); }
        finally { setApplying(false); }
    };

    const handlePreviewRule = async (id) => {
        // If already showing preview, toggle it OFF
        if (ruleStatus[id]?.preview && !ruleStatus[id]?.loading) {
            setRuleStatus(s => ({ ...s, [id]: { preview: null } }));
            return;
        }

        setRuleStatus(s => ({ ...s, [id]: { loading: true } }));
        try {
            const r = await fetch(`/api/rules/${id}/preview`, { credentials: 'include' });
            const data = await r.json();
            setRuleStatus(s => ({ ...s, [id]: { loading: false, preview: data } }));
        } catch (e) {
            setRuleStatus(s => ({ ...s, [id]: { loading: false, applyMsg: `❌ ${e.message}` } }));
        }
    };

    const handleApplySingleRule = async (id) => {
        setRuleStatus(s => ({ ...s, [id]: { ...s[id], applying: true, applyMsg: '' } }));
        try {
            const r = await fetch(`/api/rules/${id}/apply`, { method: 'POST', credentials: 'include' });
            const data = await r.json();
            setRuleStatus(s => ({ ...s, [id]: { applying: false, applyMsg: `✅ ${data.updated} transactions updated.` } }));
        } catch (e) {
            setRuleStatus(s => ({ ...s, [id]: { applying: false, applyMsg: `❌ ${e.message}` } }));
        }
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1200px', margin: '0 auto' }}>

            {/* Elite Rule Header */}
            <div className="card glass glow-blue" style={{ padding: '24px', border: 'none', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900 }}>⚡ Tax Automation Engine</h2>
                        <div className="muted" style={{ fontSize: '13px' }}>Classify imports automatically via smart matching rules.</div>
                    </div>
                    <button className="btn primary" onClick={handleApplyRules} disabled={applying}>
                        {applying ? '⏳ Syncing...' : 'Apply Rules to Ledger'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', alignItems: 'start' }}>

                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Manual Form (Moved to top of main area) */}
                    <div className="card glass glow-blue" style={{ margin: 0, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>➕ Create Custom Rule</h2>
                            {msg && <div className="tag ok" style={{ fontSize: '11px' }}>{msg}</div>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px', gap: '12px', alignItems: 'flex-end' }}>
                            <div>
                                <small className="muted" style={{ fontSize: '11px', fontWeight: 600 }}>Match Vendor / Keyword</small>
                                <input
                                    value={matchValue}
                                    onChange={e => setMatchValue(e.target.value)}
                                    placeholder="e.g. Vensure"
                                    style={{ fontSize: '13px', marginTop: '4px' }}
                                />
                            </div>
                            <div>
                                <small className="muted" style={{ fontSize: '11px', fontWeight: 600 }}>Assign Category</small>
                                <div style={{ marginTop: '4px' }}>
                                    <CategorySelect value={category} onChange={val => setCategory(val)} />
                                </div>
                            </div>
                            <button className="btn primary" style={{ height: '42px', fontWeight: 900 }} onClick={() => handleCreate()} disabled={!matchValue}>
                                Save Rule
                            </button>
                        </div>
                    </div>

                    <div className="card glass" style={{ margin: 0, padding: '20px' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Active Matching Rules</h2>
                        <div className="tableWrap" style={{ maxHeight: '700px' }}>
                            <table className="glass">
                                <thead>
                                    <tr>
                                        <th>Match Criteria</th>
                                        <th>Target Category</th>
                                        <th>Tax Bucket</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rules.map(r => {
                                        const rs = ruleStatus[r.id] || {};
                                        return (
                                            <React.Fragment key={r.id}>
                                                <tr>
                                                    <td>
                                                        <div style={{ fontWeight: 800, color: '#f7b955' }}>"{r.match_value}"</div>
                                                        <div className="muted small">{r.match_column} · {r.match_type}</div>
                                                    </td>
                                                    <td>
                                                        <div>{r.assign_category || '—'}</div>
                                                        <span className="tag ok" style={{ fontSize: '9px' }}>{r.assign_business_use_pct}% Biz</span>
                                                    </td>
                                                    <td className="muted small">{r.assign_tax_bucket || '—'}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button
                                                                className={`btn sm ${rs.loading ? 'primary' : 'secondary'}`}
                                                                style={{ padding: '4px 12px', minWidth: '60px' }}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handlePreviewRule(r.id);
                                                                }}
                                                                disabled={rs.loading}
                                                            >
                                                                {rs.loading ? '...' : 'Test'}
                                                            </button>
                                                            <button className="btn sm danger" style={{ padding: '4px 8px' }} onClick={() => handleDelete(r.id)}>×</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {rs.preview && (
                                                    <tr>
                                                        <td colSpan="4" className="glass" style={{ background: 'rgba(25, 195, 125, 0.05)', padding: '10px 15px' }}>
                                                            <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 700 }}>
                                                                {rs.preview.matchCount} matches in your database.
                                                            </div>
                                                            <button className="btn primary sm" style={{ marginTop: '8px', fontSize: '11px' }} onClick={() => handleApplySingleRule(r.id)}>
                                                                Apply Changes Now
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar Wizard */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Discovery Wizard */}
                    <div className="card glass glow-green" style={{ margin: 0, padding: '16px', maxHeight: '350px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#4ade80' }}>💡 SMART DISCOVERY</h3>
                        <div className="muted small" style={{ margin: '4px 0 10px' }}>Frequent missing rules.</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                            {discoveryVendors.map(([name, count]) => (
                                <button
                                    key={name}
                                    className="btn secondary sm"
                                    style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '11px', background: 'rgba(255,255,255,0.02)' }}
                                    onClick={() => { setMatchColumn('vendor'); setMatchValue(name); }}
                                >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                    <span className="tag ok" style={{ fontSize: '9px', padding: '2px 4px' }}>{count}x</span>
                                </button>
                            ))}
                            {!discoveryVendors.length && <div className="muted small italic">All clear!</div>}
                        </div>
                    </div>

                    {/* Quick Lib */}
                    <div className="card glass" style={{ margin: 0, padding: '16px', maxHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem' }}>📦 PHOTO LIBRARY</h3>
                        <div className="muted small" style={{ margin: '4px 0 10px' }}>Common photography software.</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', overflowY: 'auto' }}>
                            {QUICK_SUBS.map(sub => (
                                <button
                                    key={sub.name}
                                    className="btn secondary sm"
                                    style={{ fontSize: '10px', padding: '6px 4px' }}
                                    onClick={() => handleCreate({
                                        match_column: 'vendor', match_type: 'contains', match_value: sub.name,
                                        assign_category: sub.cat, assign_tax_bucket: sub.bucket,
                                        assign_tax_deductible: true, assign_business_use_pct: sub.bizPct
                                    })}
                                >+ {sub.name}</button>
                            ))}
                        </div>
                    </div>


                </div>

            </div>
        </section>
    );
}
