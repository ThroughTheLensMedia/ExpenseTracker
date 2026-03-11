import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, fetchAllExpenses, apiDelete } from '../api';
import CategorySelect from '../components/CategorySelect.jsx';

const QUICK_SUBS = [
    { name: 'Starlink', cat: 'Bills & Utilities', bucket: 'Utilities', bizPct: 100 },
    { name: 'Adobe', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 },
    { name: 'Pixieset', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 },
    { name: 'Google', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 },
    { name: 'Cloudflare', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 },
    { name: 'Apple.com', cat: 'Software & Tech', bucket: 'Other', bizPct: 100 }
];

export default function Backup() {
    const [activeTab, setActiveTab] = useState('automation'); // 'automation', 'profile', 'infrastructure'

    // --- Common States ---
    const [stats, setStats] = useState({ expenses: 0, equipment: 0, invoices: 0, clients: 0 });
    const [allExpenses, setAllExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isHealthy, setIsHealthy] = useState(true);
    const [storageType, setStorageType] = useState('unknown');

    // --- Automation States ---
    const [rules, setRules] = useState([]);
    const [matchColumn, setMatchColumn] = useState('vendor');
    const [matchValue, setMatchValue] = useState('');
    const [category, setCategory] = useState('');
    const [ruleStatus, setRuleStatus] = useState({});
    const [applying, setApplying] = useState(false);
    const [applyMsg, setApplyMsg] = useState('');
    const [progress, setProgress] = useState(0);

    // --- Infrastructure States ---
    const [purging, setPurging] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [msg, setMsg] = useState('');

    // --- Profile States ---
    const [settings, setSettings] = useState({
        business_name: '',
        contact_name: '',
        website: '',
        email: '',
        phone: '',
        address: ''
    });

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const results = await Promise.allSettled([
                fetchAllExpenses(),
                apiGet('/assets'),
                apiGet('/invoices'),
                apiGet('/leads'),
                apiGet('/rules'),
                apiGet('/health'),
                apiGet('/settings')
            ]);

            const exps = results[0].status === 'fulfilled' ? results[0].value : [];
            const eq = results[1].status === 'fulfilled' ? results[1].value : [];
            const inv = results[2].status === 'fulfilled' ? results[2].value : [];
            const leadsRes = results[3].status === 'fulfilled' ? results[3].value : { leads: [] };
            const rulesData = results[4].status === 'fulfilled' ? results[4].value : { rules: [] };
            const health = results[5].status === 'fulfilled' ? results[5].value : { ok: false };
            const profile = results[6].status === 'fulfilled' ? results[6].value : {};

            const leads = leadsRes.leads || [];
            const activeLeads = leads.filter(l => l.status !== 'Lost');

            setAllExpenses(exps || []);
            setRules(rulesData.rules || []);
            setIsHealthy(health.ok);
            setStorageType(health.storage || 'unknown');
            setSettings(profile || {});
            setStats({
                expenses: (exps || []).length,
                equipment: (eq || []).length,
                invoices: (inv || []).length,
                clients: activeLeads.length
            });
        } catch (e) {
            console.error("Data load failed critically", e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const timer = setInterval(() => loadData(true), 60000);
        return () => clearInterval(timer);
    }, []);

    const discoveryVendors = useMemo(() => {
        const counts = {};
        allExpenses.forEach(e => { if (e.vendor) counts[e.vendor] = (counts[e.vendor] || 0) + 1; });
        return Object.entries(counts)
            .filter(([name, count]) => {
                const hasRule = rules.some(r => r.match_column === 'vendor' && name.toLowerCase().includes(r.match_value.toLowerCase()));
                return !hasRule && count >= 2;
            })
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12);
    }, [allExpenses, rules]);

    const handleCreateRule = async (customPayload = null) => {
        const payload = customPayload || {
            match_column: 'vendor',
            match_type: 'contains',
            match_value: matchValue,
            assign_category: category,
            assign_tax_deductible: true,
            assign_business_use_pct: 100
        };
        try {
            await apiPost('/rules', payload);
            setMatchValue('');
            setCategory('');
            loadData(true);
        } catch (err) { alert(err.message); }
    };

    const handleDeleteRule = async (id) => {
        if (!confirm("Are you sure?")) return;
        try { await apiDelete(`/rules/${id}`); loadData(true); } catch (err) { alert(err.message); }
    };

    const handlePreviewRule = async (id) => {
        setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], loading: true } }));
        try {
            const res = await apiGet(`/rules/${id}/preview`);
            setRuleStatus(prev => ({ ...prev, [id]: { loading: false, preview: res } }));
        } catch (err) {
            setRuleStatus(prev => ({ ...prev, [id]: { loading: false } }));
            alert(err.message);
        }
    };

    const handleApplySingleRule = async (id) => {
        setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], applying: true } }));
        try {
            const res = await apiPost(`/rules/${id}/apply`);
            setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], applying: false, applyMsg: `Done! ${res.count} updated.` } }));
            loadData(true);
        } catch (err) {
            setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], applying: false } }));
            alert(err.message);
        }
    };

    const handleApplyRules = async () => {
        setApplying(true);
        setApplyMsg("Calculating scope...");
        setProgress(5);
        try {
            const res = await apiPost('/rules/apply-all');
            setApplyMsg(`Success! ${res.updatedCount} transactions categorized.`);
            setProgress(100);
            loadData(true);
            setTimeout(() => { setApplying(false); setApplyMsg(''); setProgress(0); }, 3000);
        } catch (err) { alert(err.message); setApplying(false); }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setMsg("Saving profile...");
        try {
            await apiPost('/settings', settings);
            setMsg("Profile saved successfully!");
            setTimeout(() => setMsg(''), 3000);
            loadData(true);
        } catch (err) { setMsg(`Error: ${err.message}`); }
    };

    const handlePurge = async () => {
        setPurging(true);
        setMsg('');
        try {
            await new Promise(r => setTimeout(r, 1000));
            setMsg('GLOBAL CACHE PURGED');
            setTimeout(() => setMsg(''), 3000);
        } catch (err) { alert(err.message); } finally { setPurging(false); }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setRestoring(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                await apiPost('/admin/import-all', data);
                alert("Studio context restored successfully!");
                loadData();
            } catch (err) { alert("Import failed: " + err.message); } finally { setRestoring(false); }
        };
        reader.readAsText(file);
    };

    if (loading && !allExpenses.length) return <div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner" /></div>;

    return (
        <section className="dashboard" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 950, letterSpacing: '-0.02em' }}>Studio Control Center</h1>
                    <div className="muted" style={{ fontWeight: 600, fontSize: '15px' }}>Infrastructure Management & Intelligence Engine</div>

                    <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                        <div className="muted small">
                            Status: <span className={`health-dot ${isHealthy ? 'health-ok' : 'health-bad'}`} /> {isHealthy ? 'Operational' : 'API Connection Issues'}
                        </div>
                        <span className="tag" style={{
                            fontSize: '10px',
                            background: storageType === 'supabase' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 191, 36, 0.1)',
                            color: storageType === 'supabase' ? '#4ade80' : '#fbbf24',
                            border: `1px solid ${storageType === 'supabase' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 191, 36, 0.3)'}`,
                            fontWeight: 900
                        }}>
                            {storageType === 'supabase' ? '🛡️ CLOUD SECURE' : '⚠️ LOCAL EPHEMERAL'}
                        </span>
                    </div>
                </div>

                <nav style={{ display: 'flex', gap: '10px' }}>
                    <button className={`pill ${activeTab === 'automation' ? 'active' : ''}`} onClick={() => setActiveTab('automation')}>⚡ Automation</button>
                    <button className={`pill ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>👤 Business Profile</button>
                    <button className={`pill ${activeTab === 'infrastructure' ? 'active' : ''}`} onClick={() => setActiveTab('infrastructure')}>🔒 Infrastructure</button>
                </nav>
            </div>

            {/* Live System Health Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                <div className="card glass" style={{ margin: 0, borderTop: '4px solid var(--accent)', padding: '24px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>LIVE TRANSACTIONS</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '8px' }}>{stats.expenses.toLocaleString()}</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '4px solid #38bdf8', padding: '24px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>GEAR ASSETS</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '8px' }}>{stats.equipment.toLocaleString()}</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '4px solid #f97316', padding: '24px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>INVOICES</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '8px' }}>{stats.invoices.toLocaleString()}</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '4px solid #818cf8', padding: '24px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>PIPELINE CRM</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '8px' }}>{stats.clients.toLocaleString()}</div>
                </div>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'profile' && (
                <div className="card glass glow-blue" style={{ border: 'none', padding: '40px', margin: 0 }}>
                    <div style={{ maxWidth: '800px' }}>
                        <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>Business Profile Branding</h2>
                        <p className="muted" style={{ fontSize: '15px', marginBottom: '32px' }}>Personalize your invoices and export headers.</p>
                        <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>OFFICIAL BUSINESS NAME</small>
                                <input value={settings.business_name || ''} onChange={e => setSettings({ ...settings, business_name: e.target.value })} placeholder="Through The Lens Media" style={{ marginTop: '8px', padding: '15px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>CONTACT NAME</small>
                                <input value={settings.contact_name || ''} onChange={e => setSettings({ ...settings, contact_name: e.target.value })} placeholder="Owner Name" style={{ marginTop: '8px', padding: '15px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>BUSINESS WEBSITE</small>
                                <input value={settings.website || ''} onChange={e => setSettings({ ...settings, website: e.target.value })} placeholder="throughthelens.media" style={{ marginTop: '8px', padding: '15px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>BUSINESS EMAIL</small>
                                <input type="email" value={settings.email || ''} onChange={e => setSettings({ ...settings, email: e.target.value })} placeholder="hello@example.com" style={{ marginTop: '8px', padding: '15px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>BUSINESS PHONE</small>
                                <input value={settings.phone || ''} onChange={e => setSettings({ ...settings, phone: e.target.value })} placeholder="555-555-5555" style={{ marginTop: '8px', padding: '15px' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>OFFICE ADDRESS</small>
                                <textarea value={settings.address || ''} onChange={e => setSettings({ ...settings, address: e.target.value })} placeholder="123 Studio Way..." style={{ marginTop: '8px', padding: '15px', minHeight: '80px' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <button type="submit" className="btn primary glow-blue" style={{ padding: '15px 40px', fontSize: '16px' }}>Save Profile</button>
                                {msg && <span className="tag ok">{msg}</span>}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'automation' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '20px' }}>
                    <div className="card glass" style={{ margin: 0, padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Active Engine Rules</h2>
                            <button className="btn primary sm" onClick={handleApplyRules} disabled={applying}>{applying ? '⏳ Applying...' : 'Apply All Rules'}</button>
                        </div>
                        {applyMsg && <div style={{ color: '#4ade80', fontSize: '12px', marginBottom: '10px' }}>{applyMsg}</div>}
                        <div className="tableWrap" style={{ border: 'none' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                <tbody>
                                    {rules.map(r => {
                                        const rs = ruleStatus[r.id] || {};
                                        return (
                                            <React.Fragment key={r.id}>
                                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                    <td style={{ padding: '12px 16px', borderRadius: '8px 0 0 8px' }}><strong>"{r.match_value}"</strong></td>
                                                    <td style={{ padding: '12px 16px' }}>{r.assign_category}</td>
                                                    <td style={{ textAlign: 'right', padding: '12px 16px', borderRadius: '0 8px 8px 0' }}>
                                                        <button className="btn sm secondary" onClick={() => handlePreviewRule(r.id)} style={{ marginRight: '5px' }}>Audit</button>
                                                        <button className="btn sm danger" onClick={() => handleDeleteRule(r.id)}>✕</button>
                                                    </td>
                                                </tr>
                                                {rs.preview && (
                                                    <tr>
                                                        <td colSpan="3" style={{ padding: '4px 0 12px 0' }}>
                                                            <div className="glass" style={{ padding: '12px', background: 'rgba(74, 222, 128, 0.05)', borderRadius: '8px', fontSize: '12px' }}>
                                                                Found {rs.preview.matchCount} records. <button className="btn sm ok" onClick={() => handleApplySingleRule(r.id)} style={{ marginLeft: '10px' }}>Apply Now</button>
                                                                {rs.applyMsg && <span style={{ marginLeft: '10px', color: '#4ade80' }}>{rs.applyMsg}</span>}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="card glass glow-blue" style={{ margin: 0, padding: '20px' }}>
                            <h3 style={{ margin: '0 0 15px 0' }}>➕ Add Rule</h3>
                            <small className="muted">KEYWORD</small>
                            <input value={matchValue} onChange={e => setMatchValue(e.target.value)} placeholder="Adobe" style={{ marginBottom: '15px' }} />
                            <small className="muted">CATEGORY</small>
                            <CategorySelect value={category} onChange={setCategory} />
                            <button className="btn primary" onClick={() => handleCreateRule()} style={{ width: '100%', marginTop: '15px' }}>SAVE RULE</button>
                        </div>
                        <div className="card glass" style={{ margin: 0, padding: '20px' }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>💡 SUGGESTIONS</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {discoveryVendors.map(([name, count]) => (
                                    <button key={name} className="pill" style={{ textAlign: 'left', justifyContent: 'space-between', width: '100%' }} onClick={() => setMatchValue(name)}>
                                        {name} <span style={{ opacity: 0.5 }}>{count}x</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'infrastructure' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                        <h2>Edge Cache Purge</h2>
                        <p className="muted">Clear Cloudflare edge nodes if data feels stale.</p>
                        <button className="btn secondary" onClick={handlePurge} style={{ width: '100%', marginTop: '20px' }}>{purging ? 'Purging...' : 'Execute Purge'}</button>
                        {msg && <div className="tag ok" style={{ marginTop: '10px' }}>{msg}</div>}
                    </div>
                    <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                        <h2>Restore Archive</h2>
                        <p className="muted">Upload .json snapshot to recover studio state.</p>
                        <label className="btn secondary" style={{ width: '100%', marginTop: '20px', cursor: 'pointer' }}>
                            <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                            {restoring ? 'Restoring...' : 'Upload & Restore'}
                        </label>
                    </div>
                    <div className="card glass glow-blue" style={{ gridColumn: 'span 2', padding: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.8rem' }}>Master Infrastructure Backup</h2>
                                <p className="muted">Download a complete snapshot of all business data.</p>
                            </div>
                            <a href="/api/admin/export-all" download className="btn primary" style={{ padding: '20px 40px' }}>DOWNLOAD BACKUP</a>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
