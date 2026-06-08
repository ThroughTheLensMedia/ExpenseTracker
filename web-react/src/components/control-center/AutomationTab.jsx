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
        const ok = await modal.confirm("Are you sure?");
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
        setApplying(true); setApplyMsg("Scanning engine...");
        try {
            const res = await apiPost('/rules/apply-all');
            setApplyMsg(`Success! Built ${res.updatedCount} connections.`);
            onReload(true);
            setTimeout(() => { setApplying(false); setApplyMsg(''); }, 3000);
        } catch (err) { modal.alert(err.message); setApplying(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="card glass glow-blue" style={{ border: 'none', padding: '30px', margin: 0, display: 'flex', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <small className="muted" style={{ fontWeight: 900, marginBottom: '8px', display: 'block' }}>VENDOR KEYWORD</small>
                    <datalist id="vendor-suggestions">
                        {[...new Set(allExpenses.map(e => e.vendor).filter(Boolean))].sort().map(v => (
                            <option key={v} value={v} />
                        ))}
                    </datalist>
                    <input value={matchValue} onChange={e => setMatchValue(e.target.value)} placeholder="e.g. Adobe, Starlink..." style={{ padding: '12px' }} list="vendor-suggestions" />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <small className="muted" style={{ fontWeight: 900, marginBottom: '8px', display: 'block' }}>ASSIGN CATEGORY</small>
                    <CategorySelect value={category} onChange={setCategory} />
                </div>
                <button className="btn primary" onClick={handleCreateRule} disabled={!matchValue || !category} style={{ height: '48px', padding: '0 30px' }}>SAVE RULE</button>
                <button className="btn glow-green" onClick={handleApplyRules} disabled={applying} style={{ height: '48px', padding: '0 30px' }}>
                    {applying ? '⏳ SYNCING...' : 'RUN ENGINE NOW'}
                </button>
            </div>

            {applyMsg && <div className="tag ok" style={{ alignSelf: 'center', padding: '12px 30px' }}>{applyMsg}</div>}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="muted small" style={{ fontWeight: 900 }}>💡 SUGGESTIONS:</span>
                {discoveryVendors.map(([name, count]) => (
                    <button key={name} className="pill" style={{ fontSize: '11px', cursor: 'pointer' }} onClick={() => setMatchValue(name)}>
                        {name} <span style={{ opacity: 0.5, marginLeft: '4px' }}>{count}x</span>
                    </button>
                ))}
            </div>

            <div className="card glass" style={{ padding: '0', margin: 0, border: 'none', overflow: 'hidden' }}>
                <div className="tableWrap" style={{ border: 'none' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <th style={{ textAlign: 'left', padding: '20px' }}>Rule Criterion</th>
                                <th style={{ textAlign: 'left', padding: '20px' }}>Target Assignment</th>
                                <th style={{ textAlign: 'center', padding: '20px' }}>Optimization</th>
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
                                                <button className="btn sm secondary" onClick={() => handlePreviewRule(r.id)} disabled={rs.loading}>
                                                    {rs.loading ? 'Scanning...' : 'Audit Impact'}
                                                </button>
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '16px 20px' }}>
                                                <button className="btn sm danger" onClick={() => handleDeleteRule(r.id)}>✕</button>
                                            </td>
                                        </tr>
                                        {rs.preview && (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '0 20px 10px' }}>
                                                    <div className="card glass" style={{ margin: 0, padding: '12px 20px', background: 'rgba(74, 222, 128, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '13px', fontWeight: 800 }}>Found {rs.preview.matchCount} historical matches.</span>
                                                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                                            {rs.applyMsg && <span style={{ color: '#4ade80', fontWeight: 900 }}> {rs.applyMsg}</span>}
                                                            <button className="btn primary sm" onClick={() => handleApplySingleRule(r.id)} disabled={rs.applying}>
                                                                {rs.applying ? 'Applying...' : 'Apply Correction Now'}
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
                </div>
            </div>
        </div>
    );
}
