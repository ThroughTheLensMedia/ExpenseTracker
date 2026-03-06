import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

export default function Rules() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);

    // New Rule State
    const [matchColumn, setMatchColumn] = useState('vendor');
    const [matchType, setMatchType] = useState('contains');
    const [matchValue, setMatchValue] = useState('');
    const [category, setCategory] = useState('');
    const [taxBucket, setTaxBucket] = useState('');
    const [deductible, setDeductible] = useState(true);
    const [bizPct, setBizPct] = useState(100);
    const [msg, setMsg] = useState('');

    const loadRules = async () => {
        setLoading(true);
        try {
            const data = await apiGet('/rules');
            setRules(data.rules || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRules();
    }, []);

    const handleCreate = async () => {
        setMsg("Saving rule...");
        try {
            await apiPost('/rules', {
                match_column: matchColumn,
                match_type: matchType,
                match_value: matchValue,
                assign_category: category,
                assign_tax_bucket: taxBucket,
                assign_tax_deductible: deductible,
                assign_business_use_pct: Number(bizPct) || 100
            });
            setMsg("Rule created successfully.");
            setMatchValue('');
            setCategory('');
            setTaxBucket('');
            loadRules();
        } catch (err) {
            setMsg(`Failed: ${err.message}`);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this rule?")) return;
        try {
            await fetch(`/api/rules/${id}`, { method: 'DELETE', credentials: 'include' });
            loadRules();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <section className="card">
            <h2>Tax Automation Engine (Rules)</h2>
            <div className="muted" style={{ marginBottom: '12px' }}>
                Create rules here. When you import a Rocket Money CSV, these rules run sequentially from top to bottom.
                If a transaction matches, the configured category and tax rules are instantly applied!
            </div>

            <div className="card" style={{ margin: 0, marginBottom: '16px' }}>
                <h2 style={{ marginBottom: '6px' }}>Create New Rule</h2>

                <div className="grid two" style={{ gap: '16px' }}>
                    <div>
                        <div className="row two" style={{ marginBottom: '10px' }}>
                            <div>
                                <small className="muted">Match Column</small>
                                <select value={matchColumn} onChange={e => setMatchColumn(e.target.value)}>
                                    <option value="vendor">Vendor</option>
                                    <option value="notes">Notes / Memo</option>
                                </select>
                            </div>
                            <div>
                                <small className="muted">Match Type</small>
                                <select value={matchType} onChange={e => setMatchType(e.target.value)}>
                                    <option value="contains">Contains</option>
                                    <option value="exact">Exact Match</option>
                                </select>
                            </div>
                        </div>
                        <div className="row">
                            <small className="muted">Match Value (e.g. 'Adobe')</small>
                            <input value={matchValue} onChange={e => setMatchValue(e.target.value)} placeholder="Text to look for..." />
                        </div>
                    </div>

                    <div style={{ paddingLeft: '16px', borderLeft: '1px solid var(--line)' }}>
                        <div className="row two" style={{ marginBottom: '10px' }}>
                            <div>
                                <small className="muted">Assign Category</small>
                                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Software" />
                            </div>
                            <div>
                                <small className="muted">Assign Tax Bucket (Sch. C)</small>
                                <input value={taxBucket} onChange={e => setTaxBucket(e.target.value)} placeholder="e.g. Office Expense" />
                            </div>
                        </div>

                        <div className="controls" style={{ marginTop: '20px' }}>
                            <label className="tag" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input type="checkbox" checked={deductible} onChange={e => setDeductible(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                                Deductible
                            </label>

                            <label className="tag" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                Biz %
                                <input type="number" min="0" max="100" value={bizPct} onChange={e => setBizPct(e.target.value)} style={{ width: '70px', padding: '4px' }} />
                            </label>

                            <button className="btn" onClick={handleCreate} disabled={!matchValue || (!category && !taxBucket)}>
                                Save Rule
                            </button>
                        </div>
                        <div className="muted" style={{ marginTop: '6px', minHeight: '18px' }}>{msg}</div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
                <h2>Active Rules</h2>
                <div className="tableWrap">
                    <table style={{ minWidth: '800px' }}>
                        <thead>
                            <tr>
                                <th>If (Column)</th>
                                <th>Condition</th>
                                <th>Value</th>
                                <th>Then: Category</th>
                                <th>Tax Bucket</th>
                                <th>Deductible (Biz %)</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map(r => (
                                <tr key={r.id}>
                                    <td><strong>{r.match_column}</strong></td>
                                    <td>{r.match_type}</td>
                                    <td style={{ color: '#f7b955' }}>"{r.match_value}"</td>
                                    <td>{r.assign_category || <span className="muted">—</span>}</td>
                                    <td>{r.assign_tax_bucket || <span className="muted">—</span>}</td>
                                    <td>
                                        {r.assign_tax_deductible ? <span className="tag ok">Yes ({r.assign_business_use_pct}%)</span> : <span className="tag">No</span>}
                                    </td>
                                    <td>
                                        <button className="btn secondary" onClick={() => handleDelete(r.id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {rules.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="muted" style={{ textAlign: 'center' }}>
                                        No rules built yet. Create one above to automatically classify imports!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </section>
    );
}
