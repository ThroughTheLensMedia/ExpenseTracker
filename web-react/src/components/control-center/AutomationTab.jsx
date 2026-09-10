import React, { useState, useMemo } from 'react';
import { apiGet, apiPost, apiDelete } from '../../api';
import { useModal } from '../ModalContext.jsx';
import CategorySelect from '../CategorySelect.jsx';

export default function AutomationTab({ rules, allExpenses, onReload }) {
    const modal = useModal();
    const [matchValue, setMatchValue] = useState('');
    const [category, setCategory] = useState('');
    const [ruleStatus, setRuleStatus] = useState({});
    const [applying, setApplying] = useState(false);
    const [applyMsg, setApplyMsg] = useState('');

    const discoveryVendors = useMemo(() => {
        const counts = {};
        allExpenses.forEach(e => { if (e.vendor) counts[e.vendor] = (counts[e.vendor] || 0) + 1; });
        return Object.entries(counts)
            .filter(([name]) => {
                const hasRule = rules.some(r => r.match_column === 'vendor' && name.toLowerCase().includes(r.match_value.toLowerCase()));
                return !hasRule;
            })
            .filter(([, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }, [allExpenses, rules]);

    const handleCreateRule = async () => {
        try {
            await apiPost('/rules', {
                match_column: 'vendor', match_type: 'contains',
                match_value: matchValue, assign_category: category,
                assign_tax_deductible: true, assign_business_use_pct: 100
            });
            setMatchValue(''); setCategory('');
            onReload(true);
        } catch (err) { modal.alert(err.message); }
    };

    const handleDeleteRule = async (id) => {
        const ok = await modal.confirm("Delete this automation rule? Existing transactions will keep their current categories.");
        if (!ok) return;
        try { await apiDelete(`/rules/${id}`); onReload(true); } catch (err) { modal.alert(err.message); }
    };

    const handlePreviewRule = async (id) => {
        setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], loading: true } }));
        try {
            const res = await apiGet(`/rules/${id}/preview`);
            setRuleStatus(prev => ({ ...prev, [id]: { loading: false, preview: res } }));
        } catch (err) {
            setRuleStatus(prev => ({ ...prev, [id]: { loading: false } }));
            modal.alert(err.message);
        }
    };

    const handleApplySingleRule = async (id) => {
        setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], applying: true } }));
        try {
            const res = await apiPost(`/rules/${id}/apply`);
            setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], applying: false, applyMsg: `Fixed ${res.count} items` } }));
            onReload(true);
        } catch (err) {
            setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], applying: false } }));
            modal.alert(err.message);
        }
    };

    const handleApplyRules = async () => {
        setApplying(true); setApplyMsg("Reviewing matching transactions…");
        try {
            const res = await apiPost('/rules/apply-all');
            setApplyMsg(`Updated ${res.updatedCount} matching transactions.`);
            onReload(true);
            setTimeout(() => { setApplying(false); setApplyMsg(''); }, 3000);
        } catch (err) { modal.alert(err.message); setApplying(false); }
    };

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="automation-builder-heading">
                <div style={{ maxWidth: 720, marginBottom: 20 }}>
                    <h2 id="automation-builder-heading" style={{ margin: 0, fontSize: 20 }}>Create a categorization rule</h2>
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>
                        Automatically categorize transactions when a vendor name contains the keyword you enter.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, alignItems: 'end' }}>
                    <div>
                        <label htmlFor="automation-vendor" className="muted" style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 900, letterSpacing: '.06em' }}>VENDOR KEYWORD</label>
                        <datalist id="vendor-suggestions">
                            {[...new Set(allExpenses.map(e => e.vendor).filter(Boolean))].sort().map(v => (
                                <option key={v} value={v} />
                            ))}
                        </datalist>
                        <input id="automation-vendor" value={matchValue} onChange={e => setMatchValue(e.target.value)} placeholder="For example: Adobe" list="vendor-suggestions" style={{ minHeight: 48 }} />
                    </div>
                    <div>
                        <span className="muted" style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 900, letterSpacing: '.06em' }}>ASSIGN CATEGORY</span>
                        <CategorySelect value={category} onChange={setCategory} />
                    </div>
                    <button type="button" className="btn primary" onClick={handleCreateRule} disabled={!matchValue || !category} style={{ minHeight: 48 }}>Save rule</button>
                </div>

                {discoveryVendors.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                        <span className="muted" style={{ display: 'block', marginBottom: 10, fontSize: 12, fontWeight: 800 }}>SUGGESTED VENDORS</span>
                        <div className="controls" style={{ alignItems: 'center' }}>
                            {discoveryVendors.map(([name, count]) => (
                                <button key={name} type="button" className="tag secondary" style={{ minHeight: 36, cursor: 'pointer' }} onClick={() => setMatchValue(name)}>
                                    {name} <span style={{ opacity: 0.65 }}>{count} transactions</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="automation-rules-heading">
                <div className="mobile-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                    <div>
                        <h2 id="automation-rules-heading" style={{ margin: 0, fontSize: 20 }}>Saved rules</h2>
                        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>{rules.length} active {rules.length === 1 ? 'rule' : 'rules'}</p>
                    </div>
                    <button type="button" className="btn secondary" onClick={handleApplyRules} disabled={applying} style={{ minHeight: 44 }}>
                        {applying ? 'Applying rules…' : 'Apply all rules to history'}
                    </button>
                </div>

                {applyMsg && <div role="status" aria-live="polite" className="tag ok" style={{ marginBottom: 16, padding: '8px 12px' }}>{applyMsg}</div>}

                {rules.length === 0 ? (
                    <div className="empty-state">
                        <span>No automation rules yet.</span>
                        <span className="muted">Add a vendor keyword above to create your first rule.</span>
                    </div>
                ) : <div className="tableWrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <th style={{ textAlign: 'left', padding: '20px' }}>Vendor contains</th>
                                <th style={{ textAlign: 'left', padding: '20px' }}>Assigned category</th>
                                <th style={{ textAlign: 'center', padding: '20px' }}>Historical matches</th>
                                <th style={{ textAlign: 'right', padding: '20px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map(r => {
                                const rs = ruleStatus[r.id] || {};
                                return (
                                    <React.Fragment key={r.id}>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '16px 20px' }}>
                                                <span style={{ fontWeight: 800, color: '#f97316' }}>"{r.match_value}"</span>
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <span className="tag secondary">{r.assign_category}</span>
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '16px 20px' }}>
                                                <button type="button" className="btn sm secondary" onClick={() => handlePreviewRule(r.id)} disabled={rs.loading}>
                                                    {rs.loading ? 'Checking…' : 'Preview matches'}
                                                </button>
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '16px 20px' }}>
                                                <button type="button" className="btn sm danger" aria-label={`Delete rule for ${r.match_value}`} onClick={() => handleDeleteRule(r.id)}>Delete</button>
                                            </td>
                                        </tr>
                                        {rs.preview && (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '0 20px 10px' }}>
                                                    <div className="mobile-break" style={{ padding: '12px 14px', background: 'rgba(74, 222, 128, 0.05)', border: '1px solid rgba(74, 222, 128, 0.16)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                                        <span style={{ fontSize: '13px', fontWeight: 800 }}>Found {rs.preview.matchCount} historical matches.</span>
                                                        <div className="controls" style={{ alignItems: 'center' }}>
                                                            {rs.applyMsg && <span style={{ color: '#4ade80', fontWeight: 900 }}> {rs.applyMsg}</span>}
                                                            <button type="button" className="btn primary sm" onClick={() => handleApplySingleRule(r.id)} disabled={rs.applying}>
                                                                {rs.applying ? 'Applying…' : 'Apply this rule'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>}
            </section>
        </div>
    );
}
