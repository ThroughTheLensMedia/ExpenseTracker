import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, fetchAllExpenses, apiDelete } from '../api';
import CategorySelect from '../components/CategorySelect.jsx';

export default function Backup() {
    const [activeTab, setActiveTab] = useState('automation'); // 'automation', 'profile', 'infrastructure'

    // --- Common States ---
    const [stats, setStats] = useState({ expenses: 0, equipment: 0, invoices: 0, clients: 0 });
    const [allExpenses, setAllExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isHealthy, setIsHealthy] = useState(true);
    const [isMailerReady, setIsMailerReady] = useState(false);
    const [storageType, setStorageType] = useState('unknown');

    // --- Automation States ---
    const [rules, setRules] = useState([]);
    const [matchValue, setMatchValue] = useState('');
    const [category, setCategory] = useState('');
    const [ruleStatus, setRuleStatus] = useState({});
    const [applying, setApplying] = useState(false);
    const [applyMsg, setApplyMsg] = useState('');

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
        address: '',
        tax_id: '',
        invoice_notes: '',
        signature_text: '',
        standard_terms: '',
        payment_methods: ''
    });

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [exps, eq, inv, lds, rls, hlth, st] = await Promise.all([
                fetchAllExpenses().catch(() => []),
                apiGet('/assets').catch(() => []),
                apiGet('/invoices').catch(() => []),
                apiGet('/leads').catch(() => ({ leads: [] })),
                apiGet('/rules').catch(() => ({ rules: [] })),
                apiGet('/health').catch(() => ({ ok: false })),
                apiGet('/settings').catch(() => ({}))
            ]);

            setAllExpenses(exps);
            setRules(rls.rules || []);
            // Dual-heartbeat: Check if API is up AND database is reachable
            setIsHealthy(hlth.ok && (hlth.db !== false));
            setIsMailerReady(!!hlth.mailer);
            setStorageType(hlth.storage || 'unknown');

            // Pause settings update if user is actively in the profile tab to prevent jumpy overwrites
            if (activeTab !== 'profile') {
                setSettings(st || {});
            }

            const activeLeads = (lds.leads || []).filter(l => l.status !== 'Lost');
            setStats({
                expenses: exps.length,
                equipment: eq.length,
                invoices: inv.length,
                clients: activeLeads.length
            });
        } catch (e) {
            console.error("Master load failed", e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Safety Lock: Do not start the background sync timer if we are in the Business Profile tab
        if (activeTab === 'profile') return;

        const timer = setInterval(() => {
            loadData(true);
        }, 60000);
        return () => clearInterval(timer);
    }, [activeTab]);

    const discoveryVendors = useMemo(() => {
        const counts = {};
        allExpenses.forEach(e => { if (e.vendor) counts[e.vendor] = (counts[e.vendor] || 0) + 1; });
        return Object.entries(counts)
            .filter(([name, count]) => {
                const hasRule = rules.some(r => r.match_column === 'vendor' && name.toLowerCase().includes(r.match_value.toLowerCase()));
                return !hasRule && count >= 2;
            })
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
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
            setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], applying: false, applyMsg: `Fixed ${res.count} items` } }));
            loadData(true);
        } catch (err) {
            setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], applying: false } }));
            alert(err.message);
        }
    };

    const handleApplyRules = async () => {
        setApplying(true);
        setApplyMsg("Scanning engine...");
        try {
            const res = await apiPost('/rules/apply-all');
            setApplyMsg(`Success! Built ${res.updatedCount} connections.`);
            loadData(true);
            setTimeout(() => { setApplying(false); setApplyMsg(''); }, 3000);
        } catch (err) { alert(err.message); setApplying(false); }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setSettings(prev => ({ ...prev, logo_url: ev.target.result }));
        };
        reader.readAsDataURL(file);
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

    if (loading && !allExpenses.length) return <div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner" /></div>;

    return (
        <section className="dashboard" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 950, letterSpacing: '-0.02em', color: 'var(--accent)' }}>Studio Control Center</h1>
                    <div className="muted" style={{ fontWeight: 600, fontSize: '15px' }}>Infrastructure Management & Intelligence Engine</div>
                </div>

                <nav style={{ display: 'flex', gap: '10px' }}>
                    <button className={`pill ${activeTab === 'automation' ? 'active' : ''}`} onClick={() => setActiveTab('automation')}>⚡ Automation</button>
                    <button className={`pill ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>👤 Business Profile</button>
                    <button className={`pill ${activeTab === 'infrastructure' ? 'active' : ''}`} onClick={() => setActiveTab('infrastructure')}>🔒 Infrastructure</button>
                </nav>
            </div>

            {/* System Health Stats (Elite Centered Aesthetic) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                <div className="card glass" style={{ margin: 0, borderTop: `4px solid var(--accent)`, padding: '50px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '220px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>LIVE TRANSACTIONS</div>
                    <div style={{ fontSize: '3.5rem', fontWeight: 950, marginTop: '8px', lineHeight: 1 }}>{stats.expenses.toLocaleString()}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '20px', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`health-dot ${isHealthy ? 'health-ok' : 'health-bad'}`} />
                            <span className="muted small" style={{ fontWeight: 900, fontSize: '10px' }}>DB: {isHealthy ? 'LIVE' : 'OFFLINE'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`health-dot ${isMailerReady ? 'health-ok' : 'health-bad'}`} />
                            <span className="muted small" style={{ fontWeight: 900, fontSize: '10px' }}>EMAIL: {isMailerReady ? 'READY' : 'KEY MISSING'}</span>
                        </div>
                    </div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '4px solid #38bdf8', padding: '50px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '220px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>GEAR ASSETS</div>
                    <div style={{ fontSize: '3.5rem', fontWeight: 950, marginTop: '8px', lineHeight: 1 }}>{stats.equipment.toLocaleString()}</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '4px solid #f97316', padding: '50px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '220px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>INVOICES</div>
                    <div style={{ fontSize: '3.5rem', fontWeight: 950, marginTop: '8px', lineHeight: 1 }}>{stats.invoices.toLocaleString()}</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '4px solid #818cf8', padding: '50px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '220px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>PIPELINE CRM</div>
                    <div style={{ fontSize: '3.5rem', fontWeight: 950, marginTop: '8px', lineHeight: 1 }}>{stats.clients.toLocaleString()}</div>
                </div>
            </div>

            {/* TAB CONTENT: BUSINESS PROFILE */}
            {activeTab === 'profile' && (
                <div className="card glass glow-blue" style={{ border: 'none', padding: '40px', margin: 0 }}>
                    <div style={{ maxWidth: '850px' }}>
                        <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>Business Profile Branding</h2>
                        <p className="muted" style={{ fontSize: '15px', marginBottom: '32px' }}>
                            Update your studio identity. These details personalize your invoices and global reporting headers.
                        </p>
                        <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '30px', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <small className="muted" style={{ fontWeight: 900 }}>STUDIO LOGO</small>
                                    <label className="btn secondary" style={{ display: 'block', marginTop: '8px', cursor: 'pointer', textAlign: 'center' }}>
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                                        {settings.logo_url ? 'Change Studio Logo' : 'Upload Studio Logo'}
                                    </label>
                                </div>
                                {settings.logo_url && (
                                    <div style={{ width: '120px', height: '80px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <img src={settings.logo_url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    </div>
                                )}
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>OFFICIAL BUSINESS NAME</small>
                                <input value={settings.business_name || ''} onChange={e => setSettings({ ...settings, business_name: e.target.value })} placeholder="Through The Lens Media" style={{ marginTop: '8px', padding: '15px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>CONTACT NAME</small>
                                <input value={settings.contact_name || ''} onChange={e => setSettings({ ...settings, contact_name: e.target.value })} placeholder="Joshua Dewey" style={{ marginTop: '8px', padding: '15px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>JOB TITLE</small>
                                <input value={settings.job_title || ''} onChange={e => setSettings({ ...settings, job_title: e.target.value })} placeholder="Principal Director" style={{ marginTop: '8px', padding: '15px' }} />
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
                                <input value={settings.phone || ''} onChange={e => setSettings({ ...settings, phone: e.target.value })} placeholder="702.236.9023" style={{ marginTop: '8px', padding: '15px' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>OFFICE ADDRESS</small>
                                <textarea value={settings.address || ''} onChange={e => setSettings({ ...settings, address: e.target.value })} placeholder="Studio Address..." style={{ marginTop: '8px', padding: '15px', minHeight: '80px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>STUDIO TAX ID (EIN/VAT)</small>
                                <input value={settings.tax_id || ''} onChange={e => setSettings({ ...settings, tax_id: e.target.value })} placeholder="XX-XXXXXXX" style={{ marginTop: '8px', padding: '15px' }} />
                                <div className="muted small" style={{ marginTop: '8px' }}>Shows up on professional tax invoices.</div>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>GLOBAL INVOICE NOTES</small>
                                <textarea value={settings.invoice_notes || ''} onChange={e => setSettings({ ...settings, invoice_notes: e.target.value })} placeholder="e.g. Thank you for your business!" style={{ marginTop: '8px', padding: '15px', minHeight: '80px' }} />
                                <div className="muted small" style={{ marginTop: '8px' }}>Standard greeting at the top of the invoice notes section.</div>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>STANDARD CONTRACT TERMS</small>
                                <textarea value={settings.standard_terms || ''} onChange={e => setSettings({ ...settings, standard_terms: e.target.value })} placeholder="e.g. Net 15, Late fees apply..." style={{ marginTop: '8px', padding: '15px', minHeight: '100px' }} />
                                <div className="muted small" style={{ marginTop: '8px' }}>General legal or payment terms.</div>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>ACCEPTED METHODS OF PAYMENT</small>
                                <textarea value={settings.payment_methods || ''} onChange={e => setSettings({ ...settings, payment_methods: e.target.value })} placeholder="Zelle: hello@example.com, Bank Transfer info..." style={{ marginTop: '8px', padding: '15px', minHeight: '80px' }} />
                                <div className="muted small" style={{ marginTop: '8px' }}>Payment instructions for the client.</div>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>PERSONALIZED SIGNATURE & SOCIALS</small>
                                <textarea value={settings.signature_text || ''} onChange={e => setSettings({ ...settings, signature_text: e.target.value })} placeholder="Your Name, Website, Instagram..." style={{ marginTop: '8px', padding: '15px', minHeight: '100px' }} />
                                <div className="muted small" style={{ marginTop: '8px' }}>Professional sign-off for the bottom of the invoice.</div>
                            </div>
                            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '20px', alignItems: 'center', marginTop: '10px' }}>
                                <button type="submit" className="btn primary glow-blue" style={{ padding: '15px 45px', fontSize: '16px' }}>Save Global Identity</button>
                                {msg && <span className={`${msg.includes('Error') ? 'tag bad' : 'tag ok'}`} style={{ fontWeight: 900 }}>{msg}</span>}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: AUTOMATION ENGINE */}
            {activeTab === 'automation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                    {/* Compact Rule Creator (Horizontal) */}
                    <div className="card glass glow-blue" style={{ border: 'none', padding: '30px', margin: 0, display: 'flex', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <small className="muted" style={{ fontWeight: 900, marginBottom: '8px', display: 'block' }}>VENDOR KEYWORD</small>
                            <input value={matchValue} onChange={e => setMatchValue(e.target.value)} placeholder="e.g. Adobe, Starlink..." style={{ padding: '12px' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <small className="muted" style={{ fontWeight: 900, marginBottom: '8px', display: 'block' }}>ASSIGN CATEGORY</small>
                            <CategorySelect value={category} onChange={setCategory} />
                        </div>
                        <button className="btn primary" onClick={() => handleCreateRule()} disabled={!matchValue || !category} style={{ height: '48px', padding: '0 30px' }}>SAVE RULE</button>
                        <button className="btn glow-green" onClick={handleApplyRules} disabled={applying} style={{ height: '48px', padding: '0 30px' }}>
                            {applying ? '⏳ SYNCING...' : 'RUN ENGINE NOW'}
                        </button>
                    </div>

                    {applyMsg && <div className="tag ok" style={{ alignSelf: 'center', padding: '12px 30px' }}>{applyMsg}</div>}

                    {/* Discovery Pills */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="muted small" style={{ fontWeight: 900 }}>💡 SUGGESTIONS:</span>
                        {discoveryVendors.map(([name, count]) => (
                            <button key={name} className="pill" style={{ fontSize: '11px', cursor: 'pointer' }} onClick={() => setMatchValue(name)}>
                                {name} <span style={{ opacity: 0.5, marginLeft: '4px' }}>{count}x</span>
                            </button>
                        ))}
                    </div>

                    {/* Wide Table View (No Scroll) */}
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
                                                                    {rs.applyMsg && <span style={{ color: '#4ade80', fontWeight: 900 }}>{rs.applyMsg}</span>}
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
            )}

            {activeTab === 'infrastructure' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div className="grid two">
                        <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                            <h2>Edge Network Purge</h2>
                            <p className="muted">Force-clear stagnant cache on global edge nodes. Useful if UI data feels delayed.</p>
                            <button className="btn secondary" onClick={handlePurge} style={{ width: '100%', marginTop: '20px', height: '50px' }}>{purging ? 'Purging Nodes...' : 'Execute Purge'}</button>
                            {msg && <div className="tag ok" style={{ marginTop: '15px', width: '100%', justifyContent: 'center' }}>{msg}</div>}
                        </div>
                        <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                            <h2>Restore Hub</h2>
                            <p className="muted">Upload your studio archive (.json) to restore historical system state.</p>
                            <label className="btn secondary" style={{ width: '100%', marginTop: '20px', cursor: 'pointer', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <input type="file" accept=".json" onChange={async (e) => {
                                    const file = e.target.files[0]; if (!file) return; setRestoring(true);
                                    const reader = new FileReader(); reader.onload = async (ev) => {
                                        try { const data = JSON.parse(ev.target.result); await apiPost('/admin/import-all', data); alert("Studio state restored!"); loadData(); }
                                        catch (err) { alert(err.message); } finally { setRestoring(false); }
                                    }; reader.readAsText(file);
                                }} style={{ display: 'none' }} />
                                {restoring ? 'Restoring Archive...' : 'Upload & Restore Snapshot'}
                            </label>
                        </div>
                    </div>

                    {/* Cloud Access Row */}
                    <div className="card glass glow-blue" style={{ border: 'none', padding: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '30px' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <h2 style={{ fontSize: '2rem', margin: 0 }}>Cloud Database Portal</h2>
                            <p className="muted" style={{ fontSize: '16px', marginTop: '10px' }}>Access your secure Supabase environment to manage raw data, run SQL, or view infrastructure health.</p>
                        </div>
                        <a href="https://supabase.com/dashboard/projects" target="_blank" rel="noopener noreferrer" className="btn primary" style={{ padding: '20px 50px', fontSize: '18px', fontWeight: 900 }}>OPEN CLOUD CONSOLE</a>
                    </div>

                    <div className="card glass" style={{ border: 'none', padding: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '30px' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Master Business Download</h2>
                            <p className="muted" style={{ fontSize: '16px', marginTop: '10px' }}>Download your entire studio ecosystem (transactions, gear, CRM, invoices) for archival purposes.</p>
                        </div>
                        <a href="/api/admin/export-all" download className="btn secondary" style={{ padding: '20px 50px', fontSize: '16px', fontWeight: 900 }}>DOWNLOAD ARCHIVE</a>
                    </div>

                    <div style={{ marginTop: '20px', padding: '30px', display: 'flex', gap: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                            <small className="muted" style={{ fontWeight: 900, display: 'block', marginBottom: '4px', fontSize: '10px' }}>CORE ARCHITECTURE</small>
                            <span style={{ fontWeight: 950, fontSize: '13px', color: 'var(--accent)', letterSpacing: '0.05em' }}>v3.7-ELITE-SUPABASE</span>
                        </div>
                        <div>
                            <small className="muted" style={{ fontWeight: 900, display: 'block', marginBottom: '4px', fontSize: '10px' }}>LIVE ENDPOINT</small>
                            <span style={{ fontWeight: 950, fontSize: '13px', letterSpacing: '0.05em' }}>{window.location.hostname}</span>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
