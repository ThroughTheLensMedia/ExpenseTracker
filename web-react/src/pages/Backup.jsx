import React, { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost, fetchAllExpenses, apiDelete, apiPatch } from '../api';
import { useModal } from '../components/ModalContext.jsx';
import CategorySelect from '../components/CategorySelect.jsx';
import { useAuth } from '../components/AuthContext';

export default function Backup() {
    const modal = useModal();
    const { user, subscription, refreshSubscription } = useAuth();
    const [activeTab, setActiveTab] = useState('automation');
    const [showChangeLog, setShowChangeLog] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        if (t && ['automation', 'profile', 'infrastructure', 'help', 'saas'].includes(t)) {
            setActiveTab(t);
        }
    }, [window.location.search]);
    
    // --- Common States ---
    const [stats, setStats] = useState({ expenses: 0, equipment: 0, invoices: 0, clients: 0 });
// ...
    // --- Subscription States ---
    const [betaCode, setBetaCode] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    const [allSubscriptions, setAllSubscriptions] = useState([]);
    const [betaCodes, setBetaCodes] = useState([]);
    const [genCodeLoading, setGenCodeLoading] = useState(false);
    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [allExpenses, setAllExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isHealthy, setIsHealthy] = useState(true);
    const [isMailerReady, setIsMailerReady] = useState(false);
    const [storageType, setStorageType] = useState('unknown');
    const [statusMsg, setStatusMsg] = useState(null); // System health status
    
    // --- SaaS Admin Expansion ---
    const [dailyStats, setDailyStats] = useState([]);
    const [invitePlan, setInvitePlan] = useState('beta_tester');
    const [editingInvite, setEditingInvite] = useState(null);
    const [editInviteData, setEditInviteData] = useState({ name: '', email: '', plan: '' });
    const [editingSession, setEditingSession] = useState(null);
    const [editSessionData, setEditSessionData] = useState({ name: '', plan: '' });

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
        payment_methods: '',
        entity_type: 'Sole Proprietorship',
        naics_code: '711510',
        business_category: 'Photography Studio',
        job_title: ''
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

            // Admin Logic: If you are Joshua, load the SaaS management data
            if (user?.email?.toLowerCase() === 'joshua.deuermeyer@gmail.com') {
                try {
                    const [subs, codes, adminStatus, dStats] = await Promise.all([
                        apiGet('/admin/subscriptions'),
                        apiGet('/admin/beta-codes'),
                        apiGet('/admin/check-status').catch(err => {
                            console.error("Admin status check failed", err);
                            return { error: err.message, type: 'bad' };
                        }),
                        apiGet('/admin/daily-report').catch(() => ({ data: [] }))
                    ]);
                    setAllSubscriptions(subs || []);
                    setBetaCodes(codes || []);
                    setDailyStats(dStats.data || []);
                    if (adminStatus.error) {
                        setStatusMsg({ type: 'bad', text: "Admin Data Fetch Failed: " + adminStatus.error });
                    } else if (adminStatus.diagnostics?.service_key_degraded) {
                        setStatusMsg({ type: 'bad', text: "Admin Service Key is degraded or missing. Some admin functions may not work correctly." });
                    } else if (adminStatus.tables?.user_daily_activity?.error) {
                        setStatusMsg({ type: 'bad', text: "Activity Tracking Table Error: " + adminStatus.tables.user_daily_activity.error });
                    } else {
                        setStatusMsg(null); // Clear any previous error messages
                    }
                } catch (err) {
                    console.error("Admin data fetch failed", err);
                    if (!silent) setStatusMsg({ type: 'bad', text: "Admin Data Fetch Failed: " + err.message });
                }
            }
        } catch (e) {
            console.error("Master load failed", e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleRedeemCode = async () => {
        if (!betaCode) return;
        setRedeeming(true);
        try {
            const res = await apiPost('/subscription/redeem', { code: betaCode });
            modal.alert(res.message);
            setBetaCode('');
            refreshSubscription();
            loadData(true);
        } catch (err) {
            modal.alert(err.message);
        } finally {
            setRedeeming(false);
        }
    };

    const handleGenerateBetaCode = async () => {
        setGenCodeLoading(true);
        try {
            await apiPost('/admin/beta-codes', { 
                daysValid: 90,
                assigned_to_name: inviteName,
                assigned_to_email: inviteEmail,
                plan_type: invitePlan
            });
            if (inviteEmail) {
                modal.alert(`Success! 90-day invite created and emailed to ${inviteEmail}.`);
            } else {
                modal.alert(`Success! Invite code ${inviteName ? 'for ' + inviteName : ''} created.`);
            }
            setInviteName('');
            setInviteEmail('');
            setInvitePlan('beta_tester');
            loadData(true);
        } catch (err) {
            modal.alert(err.message);
        } finally {
            setGenCodeLoading(false);
        }
    };

    const handleUpdateInvite = async (code) => {
        try {
            await apiPatch(`/admin/beta-codes/${code}`, {
                assigned_to_name: editInviteData.name,
                assigned_to_email: editInviteData.email,
                plan_type: editInviteData.plan
            });
            setEditingInvite(null);
            loadData(true);
        } catch (err) {
            modal.alert(err.message);
        }
    };

    const handleUpdateSession = async (userId) => {
        try {
            await apiPatch(`/admin/subscriptions/${userId}`, {
                display_name: editSessionData.name,
                plan_type: editSessionData.plan
            });
            setEditingSession(null);
            loadData(true);
        } catch (err) {
            modal.alert(err.message);
        }
    };

    const handleDeleteBetaCode = async (code) => {
        const ok = await modal.confirm(`Are you sure you want to delete code ${code}?`);
        if (!ok) return;
        try {
            await apiDelete(`/admin/beta-codes/${code}`);
            loadData(true);
        } catch (err) {
            modal.alert(err.message);
        }
    };

    const handleRevokeSubscription = async (userId, email) => {
        const ok = await modal.confirm(`Revoke access for ${email}? This will suspend their studio immediately.`);
        if (!ok) return;
        try {
            await apiPost(`/admin/subscriptions/${userId}/suspend`);
            loadData(true);
        } catch (err) {
            modal.alert(err.message);
        }
    };

    const handleResendInvite = async (code) => {
        try {
            await apiPost(`/admin/beta-codes/${code}/resend`);
            modal.alert(`Invite resent for code ${code}!`);
        } catch (err) {
            modal.alert(err.message);
        }
    };

    const handleExtendSubscription = async (userId, email) => {
        const ok = await modal.confirm(`Extend ${email}'s access by 90 days?`);
        if (!ok) return;
        try {
            await apiPost(`/admin/subscriptions/${userId}/extend`);
            modal.alert(`Success! 90 days added to ${email}.`);
            loadData(true);
        } catch (err) {
            modal.alert(err.message);
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
    }, [activeTab, user]);

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
        } catch (err) { modal.alert(err.message); }
    };

    const handleDeleteRule = async (id) => {
        const ok = await modal.confirm("Are you sure?");
        if (!ok) return;
        try { await apiDelete(`/rules/${id}`); loadData(true); } catch (err) { modal.alert(err.message); }
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
            loadData(true);
        } catch (err) {
            setRuleStatus(prev => ({ ...prev, [id]: { ...prev[id], applying: false } }));
            modal.alert(err.message);
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
        } catch (err) { modal.alert(err.message); setApplying(false); }
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
        } catch (err) { modal.alert(err.message); } finally { setPurging(false); }
    };

    if (loading && !allExpenses.length) return <div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner" /></div>;

    return (
        <section className="dashboard" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header Block */}
            <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2.4rem', fontWeight: 950, marginBottom: '6px', color: '#38bdf8' }}>Studio Control Center</h1>
                    <div className="muted" style={{ fontWeight: 600, fontSize: '15px' }}>Infrastructure Management & Intelligence Engine</div>
                </div>

                <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className={`pill ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>👤 Business Profile</button>
                    <button className={`pill ${activeTab === 'automation' ? 'active' : ''}`} onClick={() => setActiveTab('automation')}>⚡ Automation</button>
                    <button className={`pill ${activeTab === 'intelligence' ? 'active' : ''}`} onClick={() => setActiveTab('intelligence')}>🧠 AI Intelligence</button>
                    {(user?.email === 'joshua.deuermeyer@gmail.com' || user?.email === 'info@throughthelens.media') && (
                        <button className={`pill ${activeTab === 'infrastructure' ? 'active' : ''}`} onClick={() => setActiveTab('infrastructure')}>🔒 Infrastructure</button>
                    )}
                    <button className={`pill ${activeTab === 'help' ? 'active' : ''}`} onClick={() => setActiveTab('help')}>❓ Documentation</button>
                    {(user?.email === 'joshua.deuermeyer@gmail.com' || user?.email === 'info@throughthelens.media') && (
                        <button className={`pill ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}>💎 SaaS Studio Mgmt</button>
                    )}
                </nav>
            </div>

            {/* System Health Stats (Studio Compact HUD) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'start', marginBottom: '40px' }}>
                <div className="card glass" style={{ margin: 0, borderTop: `3px solid var(--accent)`, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '160px' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.05em' }}>LIVE TRANSACTIONS</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '6px', lineHeight: 1 }}>{stats.expenses.toLocaleString()}</div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' }}>
                        <span className={`health-dot ${isHealthy ? 'health-ok' : 'health-bad'}`} title={isHealthy ? 'DB Connected' : 'DB Link Offline'} />
                        <span className={`health-dot ${isMailerReady ? 'health-ok' : 'health-bad'}`} title={isMailerReady ? 'SMTP Ready' : 'SMTP Missing'} />
                    </div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '3px solid #38bdf8', padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '160px' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.05em' }}>GEAR ASSETS</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '6px', lineHeight: 1 }}>{stats.equipment.toLocaleString()}</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '3px solid #f97316', padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '160px' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.05em' }}>INVOICES</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '6px', lineHeight: 1 }}>{stats.invoices.toLocaleString()}</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '3px solid #818cf8', padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '160px' }}>
                    <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.05em' }}>PIPELINE CRM</div>
                    <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '6px', lineHeight: 1 }}>{stats.clients.toLocaleString()}</div>
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
                                <input value={settings.business_name || ''} onChange={e => setSettings({ ...settings, business_name: e.target.value })} placeholder="Studio Tracker" style={{ marginTop: '8px', padding: '15px' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <small className="muted" style={{ fontWeight: 900 }}>BUSINESS CATEGORY</small>
                                <input value={settings.business_category || ''} onChange={e => setSettings({ ...settings, business_category: e.target.value })} placeholder="Photography Studio" style={{ marginTop: '8px', padding: '15px' }} />
                                <div className="muted small" style={{ marginTop: '8px' }}>Your primary line of work (e.g. Wedding Photography, Media Production).</div>
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
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>IRS ENTITY TYPE</small>
                                <select value={settings.entity_type || 'Sole Proprietorship'} onChange={e => setSettings({ ...settings, entity_type: e.target.value })} style={{ marginTop: '8px', padding: '15px', color: 'white', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }}>
                                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                                    <option value="LLC (Single Member)">LLC (Single Member)</option>
                                    <option value="LLC (Multi Member)">LLC (Multi Member)</option>
                                    <option value="S-Corp">S-Corp</option>
                                    <option value="C-Corp">C-Corp</option>
                                    <option value="Partnership">Partnership</option>
                                </select>
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>IRS BUSINESS CODE (NAICS)</small>
                                <input value={settings.naics_code || '711510'} onChange={e => setSettings({ ...settings, naics_code: e.target.value })} placeholder="711510" style={{ marginTop: '8px', padding: '15px' }} />
                                <div className="muted small" style={{ marginTop: '8px' }}>Standard code for photographers is 711510.</div>
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

            {/* TAB CONTENT: AI INTELLIGENCE */}
            {activeTab === 'intelligence' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div className="card glass glow-blue" style={{ border: 'none', padding: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <div>
                                <h2 style={{ fontSize: '2rem', margin: 0 }}>Brain Connectivity & AI Engine</h2>
                                <p className="muted" style={{ fontSize: '16px', marginTop: '6px' }}>Power your studio with Google Gemini 2.5 Flash intelligence.</p>
                            </div>
                            <div className="tag ok" style={{ fontWeight: 800 }}>⚡ Gemini 2.5 Flash</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                            <div>
                                <small className="muted" style={{ fontWeight: 900 }}>GEMINI AI API KEY</small>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
                                    <input 
                                        type="password"
                                        value={settings.gemini_api_key || ''} 
                                        onChange={e => setSettings({ ...settings, gemini_api_key: e.target.value })} 
                                        placeholder="AI_..." 
                                        style={{ padding: '15px', flex: 1 }} 
                                    />
                                    <button className="btn primary" onClick={(e) => handleSaveSettings(e)} style={{ height: '54px' }}>Save Key</button>
                                </div>
                                <div style={{ marginTop: '10px', height: '20px' }}>
                                    {msg && <span className={`${msg.includes('Error') ? 'tag bad' : 'tag ok'}`} style={{ fontWeight: 900, fontSize: '12px' }}>{msg}</span>}
                                </div>
                                <div className="muted extra-small" style={{ marginTop: '10px' }}>
                                    Your key is stored securely in your private studio database and is only used to process your transactions.
                                </div>
                                <div style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" className="btn sm secondary" style={{ fontSize: '11px', fontWeight: 900 }}>
                                        🗝️ ROTATE KEY
                                    </a>
                                    <a href="https://aistudio.google.com/app/plan" target="_blank" className="btn sm secondary" style={{ fontSize: '11px', fontWeight: 900 }}>
                                        📊 MONITOR QUOTA
                                    </a>
                                </div>
                                <p className="muted small" style={{ marginTop: '15px', color: '#f59e0b', fontSize: '11px', lineHeight: '1.5' }}>
                                    <strong>TIP:</strong> If you see a "Rate Limit" or "Limit: 0" error, ensure your Google Cloud project has enabled the <strong>Gemini API</strong> and that your region supports the Free Tier. Linking a billing account (even if not used) often resolves "Limit: 0" issues.
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '10px' }}>
                                <div className="card glass" style={{ margin: 0, padding: '24px', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: 800 }}>🤫 Silent Background Optimizer</div>
                                        <label className="switch">
                                            <input 
                                                type="checkbox" 
                                                checked={!!settings.ai_silent_mode} 
                                                onChange={e => {
                                                    const val = e.target.checked;
                                                    setSettings({ ...settings, ai_silent_mode: val });
                                                    apiPost('/settings', { ...settings, ai_silent_mode: val });
                                                }}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                    <p className="muted extra-small" style={{ marginTop: '10px' }}>The Brain works quietly in the background to clean up vendor names and fix missing accounts.</p>
                                </div>

                                <div className="card glass" style={{ margin: 0, padding: '24px', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: 800 }}>🗣️ Active Coaching Mode</div>
                                        <label className="switch">
                                            <input 
                                                type="checkbox" 
                                                checked={!!settings.ai_coaching_mode} 
                                                onChange={e => {
                                                    const val = e.target.checked;
                                                    setSettings({ ...settings, ai_coaching_mode: val });
                                                    apiPost('/settings', { ...settings, ai_coaching_mode: val });
                                                }}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    </div>
                                    <p className="muted extra-small" style={{ marginTop: '10px' }}>The Brain will proactively alert you to over-spending, tax risks, and subscription savings.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card glass" style={{ border: 'none', padding: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                            <div style={{ flex: 1 }}>
                                <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Retroactive Ledger Repair</h2>
                                <p className="muted" style={{ fontSize: '15px', marginTop: '10px' }}>
                                    Have messy data from older imports? This tool scans your entire history and uses AI to fix incorrect vendor names and missing accounts.
                                </p>
                                <div className="tag extra-small warning" style={{ marginTop: '12px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                                    ⚠️ Runs through Gemini 2.0 Flash in batches. May take 10-20 seconds.
                                </div>
                            </div>
                            <button 
                                className="btn primary glow-blue" 
                                onClick={async () => {
                                    if (!settings.gemini_api_key) return modal.alert("Please save your Gemini API Key first.");
                                    const ok = await modal.confirm("This will process your historical ledger through the AI Brain to fix old 'Rocket Money' entries. Proceed?");
                                    if (!ok) return;
                                    setLoading(true);
                                    try {
                                        const res = await apiPost('/brain/repair-ledger');
                                        modal.alert(`Success! The Brain repaired ${res.updated} transactions.`);
                                        loadData(true);
                                    } catch (err) {
                                        modal.alert(err.message);
                                    } finally {
                                        setLoading(false);
                                    }
                                }} 
                                disabled={loading}
                                style={{ padding: '16px 40px', fontWeight: 950 }}
                            >
                                {loading ? '📸 BRAIN SCANNING...' : '🧼 START RETROACTIVE REPAIR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
            )}

            {activeTab === 'infrastructure' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div className="grid two">
                        <div className="card glass glow-blue" style={{ margin: 0, padding: '30px', border: 'none' }} id="redeem">
                            <h2>Studio License Lock</h2>
                            <p className="muted">Enter your Beta Studio Key or Pro Key to extend your access.</p>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <input 
                                    value={betaCode} 
                                    onChange={e => setBetaCode(e.target.value.toUpperCase())} 
                                    placeholder="XXXX-XXXX-XXXX" 
                                    style={{ padding: '12px' }} 
                                />
                                <button className="btn primary" onClick={handleRedeemCode} disabled={redeeming || !betaCode}>
                                    {redeeming ? 'Unlocking...' : 'Redeem Key'}
                                </button>
                            </div>
                            <div className="muted small" style={{ marginTop: '10px' }}>
                                Current Plan: <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{subscription?.plan_type?.toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                            <h2>Edge Network Purge</h2>
                            <p className="muted">Force-clear stagnant cache on global edge nodes. Useful if UI data feels delayed.</p>
                            <button className="btn secondary" onClick={handlePurge} style={{ width: '100%', marginTop: '20px', height: '50px' }}>{purging ? 'Purging Nodes...' : 'Execute Purge'}</button>
                            {msg && <div className="tag ok" style={{ marginTop: '15px', width: '100%', justifyContent: 'center' }}>{msg}</div>}
                        </div>
                    </div>
                    <div className="card glass" style={{ margin: 0, padding: '30px' }}>
                        <h2>Restore Hub</h2>
                        <p className="muted">Upload your studio archive (.json) to restore historical system state.</p>
                        <label className="btn secondary" style={{ width: '100%', marginTop: '20px', cursor: 'pointer', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input type="file" accept=".json" onChange={async (e) => {
                                const file = e.target.files[0]; if (!file) return; setRestoring(true);
                                const reader = new FileReader(); reader.onload = async (ev) => {
                                    try { 
                                        const data = JSON.parse(ev.target.result); 
                                        await apiPost('/admin/import-all', data); 
                                        await modal.alert("Studio state restored!"); 
                                        loadData(); 
                                    }
                                    catch (err) { modal.alert(err.message); } finally { setRestoring(false); }
                                }; reader.readAsText(file);
                            }} style={{ display: 'none' }} />
                            {restoring ? 'Restoring Archive...' : 'Upload & Restore Snapshot'}
                        </label>
                    </div>
{/* ... rest of original infrastructure content ... */}

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
                            <span style={{ fontWeight: 950, fontSize: '13px', color: 'var(--accent)', letterSpacing: '0.05em' }}>3.9.2-SAAS</span>
                        </div>
                        <div>
                            <small className="muted" style={{ fontWeight: 900, display: 'block', marginBottom: '4px', fontSize: '10px' }}>LIVE ENDPOINT</small>
                            <span style={{ fontWeight: 950, fontSize: '13px', letterSpacing: '0.05em' }}>{window.location.hostname}</span>
                        </div>
                    </div>
                </div>
            )}

             {activeTab === 'help' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '1400px' }}>
                    <div className="card glass glow-blue" style={{ border: 'none', padding: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '10px' }}>
                            <div>
                                <h2 style={{ fontSize: '2.2rem', margin: 0 }}>Studio Onboarding Guide</h2>
                                <p className="muted" style={{ fontSize: '18px' }}>Follow these steps to transition your studio into full automation.</p>
                            </div>
                            <button className="pill" onClick={() => setShowChangeLog(true)} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>💎 CHANGE LOG</button>
                        </div>
                        
                        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
                            <section>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '950' }}>1</div>
                                    <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Claim Your Identity</h3>
                                </div>
                                <p className="muted" style={{ lineHeight: '1.6' }}>
                                    Navigate to the <strong>Business Profile</strong> tab. Upload your studio logo and fill out your business details. 
                                    This information is used to professionally brand your invoices and set your tax jurisdiction.
                                </p>
                            </section>

                            <section>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '950' }}>2</div>
                                    <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Initialize the Ledger</h3>
                                </div>
                                <p className="muted" style={{ lineHeight: '1.6' }}>
                                    Go to the <strong>Import</strong> page. Download your transaction history from Rocket Money or your bank as a "Generic CSV". 
                                    Upload it here to seed your studio with data. The system will handle duplicate detection automatically.
                                </p>
                            </section>

                            <section>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '950' }}>3</div>
                                    <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Train the Brain (Automation)</h3>
                                </div>
                                <p className="muted" style={{ lineHeight: '1.6' }}>
                                    Visit the <strong>Automation</strong> tab. Here you can create "Rules". For example, if a vendor contains "Adobe", 
                                    always assign it to "Software & Subscriptions". Once saved, click <strong>"Run Engine"</strong> to apply these rules to your entire history.
                                </p>
                            </section>

                            <section>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '950' }}>4</div>
                                    <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Audit Your Infrastructure</h3>
                                </div>
                                <p className="muted" style={{ lineHeight: '1.6' }}>
                                    Log your gear in the <strong>Equipment</strong> section. This tracks your Section 179 depreciation and serial numbers for insurance purposes. 
                                    A healthy studio is a documented studio.
                                </p>
                            </section>

                            <section>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '950' }}>5</div>
                                    <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Manage the Pipeline</h3>
                                </div>
                                <p className="muted" style={{ lineHeight: '1.6' }}>
                                    Use the <strong>CRM</strong> to track new leads. When a project is booked, create an <strong>Invoice</strong> directly from the lead. 
                                    The system will use your Business Profile to generate a professional PDF and track the payment status.
                                </p>
                            </section>
                        </div>
                    </div>

                    <div className="card glass" style={{ border: 'none', padding: '40px' }}>
                        <h2 style={{ fontSize: '1.8rem', margin: '0 0 20px 0' }}>Frequently Asked Questions</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            <div>
                                <div style={{ fontWeight: 800, color: 'white', marginBottom: '8px' }}>How do I extend my studio access?</div>
                                <div className="muted" style={{ fontSize: '14px' }}>In the <strong>Infrastructure</strong> tab, you can redeem a 12-digit Beta or Pro key. This will instantly update your expiration date in the header.</div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, color: 'white', marginBottom: '8px' }}>Is my data shared with other studios?</div>
                                <div className="muted" style={{ fontSize: '14px' }}>Absolutely not. The platform uses Row Level Security (RLS) within our cloud database, meaning your data is cryptographically isolated to your unique User ID.</div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, color: 'white', marginBottom: '8px' }}>What does the color-coded Import status mean?</div>
                                <div className="muted" style={{ fontSize: '14px' }}>
                                    The "Import Age" pill in your dashboard header tracks how long it's been since you last synced your bank data:
                                    <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                                        <li><span style={{ color: '#4ade80', fontWeight: 900 }}>Green:</span> Fresh (Less than 5 days old).</li>
                                        <li><span style={{ color: '#f59e0b', fontWeight: 900 }}>Yellow:</span> Stale (5-6 days old).</li>
                                        <li><span style={{ color: '#ff4d4d', fontWeight: 900 }}>Red:</span> Critical (7+ days old). Keep your data synced for accurate tax forecasting!</li>
                                    </ul>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, color: 'white', marginBottom: '8px' }}>How does the AI Brain scale?</div>
                                <div className="muted" style={{ fontSize: '14px' }}>
                                    The "Brain" architecture is built for infinite scale—whether for 1 user or 10,000. 
                                    By using a "Bring Your Own Key" model, every studio owner has their own private intelligence instance. 
                                    This ensures your financial data is never trained on by others and your processing costs are zero for the platform.
                                </div>
                            </div>
                            <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                                <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '12px' }}>🚀 4-Step AI Setup Guide</div>
                                <ol className="muted" style={{ fontSize: '14px', paddingLeft: '20px', lineHeight: '1.8' }}>
                                    <li><strong>Get a Key:</strong> Visit the <a href="https://aistudio.google.com/app/apikey" target="_blank" style={{ color: 'var(--accent)' }}>Google AI Studio</a> and generate a free API Key.</li>
                                    <li><strong>Provision DB (Admin):</strong> You as the studio owner run the SQL snippet once in Supabase. It is then live for <strong>all</strong> users.</li>
                                    <li><strong>Connect (User):</strong> Every user simply pastes their own key into the <strong>AI Intelligence</strong> tab and hits <strong>Save Key</strong>.</li>
                                    <li><strong>Repair:</strong> Use the <strong>Retroactive Ledger Repair</strong> to scrub your history and clean up "Rocket Money" entries.</li>
                                </ol>
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, color: 'white', marginBottom: '8px' }}>Can I export my data if I leave?</div>
                                <div className="muted" style={{ fontSize: '14px' }}>Yes. You can download a "Master Business Archive" (.json) at any time from the Infrastructure tab to keep your own backups.</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'saas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {user?.email?.toLowerCase() !== 'joshua.deuermeyer@gmail.com' ? (
                        <div className="card glass" style={{ textAlign: 'center', padding: '100px 40px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔒</div>
                            <h2 style={{ fontSize: '2rem' }}>Administrative Hub</h2>
                            <p className="muted" style={{ maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
                                The SaaS Studio Management suite is restricted to the administrator account (<strong>Joshua Deuermeyer</strong>). 
                                Users with <strong>Beta</strong> or <strong>Professional</strong> access can manage their own studio settings in the <strong>Business Profile</strong> tab.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '100%', boxSizing: 'border-box' }}>
                            {statusMsg && statusMsg.type === 'bad' && (
                                <div className="card glass" style={{ border: '1px solid #ff4d4d', padding: '15px 20px', background: 'rgba(255, 77, 77, 0.05)', fontSize: '12px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ color: '#ff4d4d', fontWeight: 900 }}>⚠️ ADMIN DATA ACCESS PARTIAL FAILURE: {statusMsg.text}</div>
                                    <button className="btn sm secondary" onClick={() => loadData()}>RETRY SYNC</button>
                                </div>
                            )}

                            {/* Block 1: Studio Access Keys (Full Width) */}
                            <div className="card glass glow-blue" style={{ margin: 0, padding: '20px' }}>
                                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem' }}>Studio Access Keys</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', alignItems: 'flex-end' }}>
                                    <div>
                                        <small className="muted" style={{ fontWeight: 900, marginBottom: '6px', display: 'block', fontSize: '10px' }}>NAME</small>
                                        <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Photographer Name" style={{ padding: '12px', fontSize: '14px', height: '44px' }} />
                                    </div>
                                    <div>
                                        <small className="muted" style={{ fontWeight: 900, marginBottom: '6px', display: 'block', fontSize: '10px' }}>EMAIL</small>
                                        <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="hello@studio.com" style={{ padding: '12px', fontSize: '14px', height: '44px' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{ flex: 1 }}>
                                            <small className="muted" style={{ fontWeight: 900, marginBottom: '6px', display: 'block', fontSize: '10px' }}>PLAN TYPE</small>
                                            <select value={invitePlan} onChange={e => setInvitePlan(e.target.value)} style={{ padding: '0 12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', width: '100%', height: '44px', fontSize: '13px' }}>
                                                <option value="beta_tester">BETA TESTER</option>
                                                <option value="pro">PRO ACCESS</option>
                                                <option value="lifetime">LIFETIME</option>
                                                <option value="annual">ANNUAL</option>
                                                <option value="monthly">MONTHLY</option>
                                            </select>
                                        </div>
                                        <button className="btn primary" onClick={handleGenerateBetaCode} disabled={genCodeLoading} style={{ height: '44px', padding: '0 25px', fontSize: '13px', fontWeight: 900, borderRadius: '12px' }}>
                                            {genCodeLoading ? '...' : 'GENERATE KEY'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Block 2: Access Inventory (Full Width) */}
                            <div className="card glass" style={{ margin: 0, padding: '20px' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Access Inventory</h3>
                                <div className="tableWrap" style={{ border: 'none', maxHeight: '300px', overflowY: 'auto' }}>
                                    <table style={{ width: '100%' }}>
                                        <thead>
                                            <tr style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                                                <th style={{ width: '150px' }}>CODE</th>
                                                <th>RECIPIENT IDENTITY</th>
                                                <th>PLAN</th>
                                                <th style={{ textAlign: 'right' }}>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody style={{ fontSize: '13px' }}>
                                            {betaCodes.map(c => (
                                                <tr key={c.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                    <td style={{ fontWeight: 900, color: 'var(--accent)', padding: '12px 0' }}>{c.code}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 800 }}>{c.assigned_to_name || '—'}</div>
                                                        <div className="muted" style={{ fontSize: '11px' }}>{c.assigned_to_email || 'General Invite'}</div>
                                                    </td>
                                                    <td><span className="tag secondary" style={{ fontSize: '10px' }}>{c.plan_type?.toUpperCase() || 'BETA'}</span></td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                            {!c.is_used ? (
                                                                <>
                                                                    <button onClick={() => {
                                                                        setEditingInvite(c.code);
                                                                        setEditInviteData({ name: c.assigned_to_name || '', email: c.assigned_to_email || '', plan: c.plan_type || 'beta_tester' });
                                                                    }} className="btn sm secondary" style={{ fontSize: '11px', padding: '6px 12px' }}>EDIT</button>
                                                                    <button onClick={() => handleResendInvite(c.code)} className="btn sm secondary" style={{ fontSize: '11px', padding: '6px 12px' }}>RESEND</button>
                                                                </>
                                                            ) : <span className="tag bad" style={{ fontSize: '11px' }}>REDEEMED</span>}
                                                            <button onClick={() => handleDeleteBetaCode(c.code)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}>✕</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Block 3: Active Studio Members (Full Width & Expanded) */}
                            <div className="card glass" style={{ margin: 0, padding: '20px' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Active Studio Members</h3>
                                <div className="tableWrap" style={{ border: 'none', maxHeight: '500px', overflowY: 'auto' }}>
                                    <table style={{ width: '100%', minWidth: '1000px' }}>
                                        <thead>
                                            <tr style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                                                <th>IDENTITY</th>
                                                <th>LICENSE TYPE</th>
                                                <th>ACCESS EXPIRATION</th>
                                                <th style={{ textAlign: 'right' }}>MANAGEMENT CONTROL</th>
                                            </tr>
                                        </thead>
                                        <tbody style={{ fontSize: '13px' }}>
                                            {allSubscriptions.map(s => {
                                                const daysUntilExpiry = Math.ceil((new Date(s.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                                                const isExpired = daysUntilExpiry <= 0;
                                                const expiryColor = (isExpired || s.status === 'suspended') ? 'bad' : (daysUntilExpiry <= 3 ? 'bad glow-red' : (daysUntilExpiry <= 7 ? 'warn glow-yellow' : 'ok'));
                                                
                                                return (
                                                    <tr key={s.user_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                        <td style={{ padding: '15px 0' }}>
                                                            <div style={{ fontWeight: 800, color: 'white', fontSize: '14px' }}>{s.display_name || s.email.split('@')[0]}</div>
                                                            <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>{s.email}</div>
                                                        </td>
                                                        <td><span className="tag secondary" style={{ fontSize: '11px', fontWeight: 800 }}>{s.plan_type.toUpperCase()}</span></td>
                                                        <td>
                                                            <span className={`tag ${expiryColor}`} style={{ fontSize: '11px', fontWeight: 900, padding: '6px 12px' }}>
                                                                {isExpired ? 'EXPIRED' : `${daysUntilExpiry}D REMAINING`}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                <button onClick={() => {
                                                                    setEditingSession(s.user_id);
                                                                    setEditSessionData({ name: s.display_name || '', plan: s.plan_type || 'beta_tester' });
                                                                }} className="btn sm secondary" style={{ fontSize: '11px', padding: '8px 16px' }}>EDIT</button>
                                                                <button onClick={() => handleExtendSubscription(s.user_id, s.email)} className="btn sm primary" style={{ fontSize: '11px', padding: '8px 16px' }}>+90D EXTEND</button>
                                                                <button onClick={() => handleRevokeSubscription(s.user_id, s.email)} className="btn sm danger" style={{ fontSize: '11px', padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>BLOCK ACCESS</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Block 4 & 5: Activity & Performance (Stacked for Density) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Engagement Pulse */}
                                <div className="card glass" style={{ margin: 0, padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Engagement Pulse</h3>
                                        <span className="tag secondary" style={{ fontSize: '10px', padding: '4px 10px' }}>REAL-TIME 24H</span>
                                    </div>
                                    <div className="tableWrap" style={{ border: 'none', maxHeight: '300px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%' }}>
                                            <tbody>
                                                {dailyStats.length > 0 ? dailyStats.map(s => {
                                                    const formatDuration = (min) => {
                                                        const d = Math.floor(min / 1440);
                                                        const h = Math.floor((min % 1440) / 60);
                                                        const m = min % 60;
                                                        return [d > 0 ? `${d}d` : '', h > 0 ? `${h}h` : '', `${m}m`].filter(Boolean).join(' ');
                                                    };
                                                    return (
                                                        <tr key={s.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                            <td style={{ padding: '8px 0' }}>
                                                                <div style={{ fontWeight: 800, fontSize: '14px' }}>{s.name || s.email?.split('@')[0]}</div>
                                                                <div className="muted" style={{ fontSize: '10px' }}>{s.email}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'right', fontWeight: 900, color: '#4ade80', fontSize: '13px' }}>
                                                                {formatDuration(s.minutes_today)}
                                                            </td>
                                                        </tr>
                                                    );
                                                }) : (
                                                    <tr><td className="muted center" style={{ padding: '20px', fontSize: '12px' }}>No active studio sessions captured yet today.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Block 6: Minor Info (Footer) */}
                            <div className="card glass" style={{ border: 'none', padding: '15px 30px', background: 'rgba(99, 102, 241, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <span style={{ padding: '4px 8px', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', borderRadius: '4px', fontSize: '9px', fontWeight: 900 }}>AI BRAIN</span>
                                    <span style={{ fontSize: '13px', fontWeight: 800 }}>Predictive forensics and automated tax strategy engine active.</span>
                                </div>
                                    <div style={{ fontSize: '12px', opacity: 0.5, fontWeight: 900 }}>4.0.1-PRO</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* Edit Invite Modal */}
            {editingInvite && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card glass glow-blue" style={{ width: '100%', maxWidth: '400px', padding: '30px' }}>
                        <h3 style={{ marginBottom: '20px' }}>Edit Access Key</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>NAME</small>
                                <input value={editInviteData.name} onChange={e => setEditInviteData({ ...editInviteData, name: e.target.value })} style={{ padding: '12px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>EMAIL</small>
                                <input value={editInviteData.email} onChange={e => setEditInviteData({ ...editInviteData, email: e.target.value })} style={{ padding: '12px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>PLAN</small>
                                <select value={editInviteData.plan} onChange={e => setEditInviteData({ ...editInviteData, plan: e.target.value })} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }}>
                                    <option value="beta_tester">BETA TESTER</option>
                                    <option value="pro">PRO ACCESS</option>
                                    <option value="lifetime">LIFETIME</option>
                                    <option value="annual">ANNUAL</option>
                                    <option value="monthly">MONTHLY</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button className="btn primary" onClick={() => handleUpdateInvite(editingInvite)} style={{ flex: 1 }}>SAVE CHANGES</button>
                                <button className="btn secondary" onClick={() => setEditingInvite(null)} style={{ flex: 1 }}>CANCEL</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Session Modal */}
            {editingSession && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card glass glow-blue" style={{ width: '100%', maxWidth: '400px', padding: '30px' }}>
                        <h3 style={{ marginBottom: '20px' }}>Edit Studio Member</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>DISPLAY NAME</small>
                                <input value={editSessionData.name} onChange={e => setEditSessionData({ ...editSessionData, name: e.target.value })} style={{ padding: '12px' }} />
                            </div>
                            <div>
                                <small className="muted" style={{ fontWeight: 900, marginBottom: '5px', display: 'block' }}>PLAN TYPE</small>
                                <select value={editSessionData.plan} onChange={e => setEditSessionData({ ...editSessionData, plan: e.target.value })} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '100%' }}>
                                    <option value="beta_tester">BETA TESTER</option>
                                    <option value="pro">PRO ACCESS</option>
                                    <option value="lifetime">LIFETIME</option>
                                    <option value="annual">ANNUAL</option>
                                    <option value="monthly">MONTHLY</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button className="btn primary" onClick={() => handleUpdateSession(editingSession)} style={{ flex: 1 }}>UPDATE MEMBER</button>
                                <button className="btn secondary" onClick={() => setEditingSession(null)} style={{ flex: 1 }}>CANCEL</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Log Modal */}
            {showChangeLog && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div className="card glass glow-blue" style={{ width: '100%', maxWidth: '700px', padding: '40px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <h2 style={{ fontSize: '1.8rem', margin: 0 }}>System Intelligence Update Log</h2>
                            <button onClick={() => setShowChangeLog(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>✕</button>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '35px' }}>
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                        <div style={{ fontWeight: 950, fontSize: '1.4rem', color: 'var(--accent)' }}>4.0.0-PRO</div>
                                        <div style={{ fontWeight: 800, opacity: 0.6, fontSize: '12px' }}>MARCH 18, 2026</div>
                                    </div>
                                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '15px' }}>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Your Assistant:</strong> Initial release of the floating AI assistant for real-time financial consultation.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Gemini 1.5 Flash:</strong> Migrated whole-studio intelligence to the latest Google Flash model for 2x speed.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Privacy Lockdown:</strong> Implemented Row Level Security (RLS) for AI settings; bringing "your own key" now isolates data.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Dashboard Grid:</strong> Precision calibration for Intelligence cards (9-card desktop grid).</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Smart Recurring:</strong> Improved detection patterns for operational burn that ignores one-off equipment transfers.</li>
                                    </ul>
                                </section>

                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                        <div style={{ fontWeight: 950, fontSize: '1.4rem', color: 'var(--accent)' }}>3.9.3-SAAS</div>
                                        <div style={{ fontWeight: 800, opacity: 0.6, fontSize: '12px' }}>MARCH 16, 2026</div>
                                    </div>
                                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '15px' }}>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Pro Entry Integrated:</strong> Released Google OAuth (One-Tap login) as the primary studio entry method.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Automated Expiration Logic:</strong> Studio licenses now auto-recalculate (Annual 365D, Pro 999D) upon plan change.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Identity Fix:</strong> Resolved sync issue between License Records and Profiles; display names now persist correctly.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Pulse Resilience:</strong> Switched engagement telemetry to Service Layer to ensure 100% visibility in SaaS Dashboard regardless of RLS.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Smarter Bills:</strong> Improved detection patterns for operational overhead (Fitness, Software, Licenses).</li>
                                    </ul>
                                </section>

                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                        <div style={{ fontWeight: 950, fontSize: '1.4rem', color: 'var(--accent)' }}>3.8-SAAS</div>
                                        <div style={{ fontWeight: 800, opacity: 0.6, fontSize: '12px' }}>MARCH 14, 2026</div>
                                    </div>
                                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '15px' }}>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>SaaS Control Center:</strong> Integrated real-time engagement pulse and user activity reporting.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Enhanced User Mgmt:</strong> Added ability to edit invites and active session details (name, plan type).</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>License Health:</strong> Visual color-coded alerts (Green/Yellow/Red) for expiring access sessions.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Auto-Update Core:</strong> Aggressive cache-busting and version synchronization for all users.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Cloud Parity:</strong> Fully decommissioned NAS modules in favor of Supabase/Vercel resilience.</li>
                                    </ul>
                                </section>

                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                        <div style={{ fontWeight: 950, fontSize: '1.4rem', color: '#fff' }}>3.7-ELITE</div>
                                        <div style={{ fontWeight: 800, opacity: 0.6, fontSize: '12px' }}>MARCH 13, 2026</div>
                                    </div>
                                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '15px' }}>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Documentation Refresh:</strong> Integrated the "Change Log" repository for real-time feature tracking.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Widescreen Optimization:</strong> Expanded Onboarding and FAQ containers to 1400px for better data density on high-res displays.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Branding Evolution:</strong> Increased <strong>"STUDIO TRACKER"</strong> brand presence in the primary command bar.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Executive Symmetry:</strong> Precision grid calibration for dashboard controls (CHARTS, YEAR, SYNC).</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Dual Trajectory:</strong> Split profitability tracking into dual modules for "Margin %" and "Net Income Pulse".</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Inventory Density:</strong> Optimized Equipment Locker for 40% higher visibility per scroll.</li>
                                    </ul>
                                </section>

                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                        <div style={{ fontWeight: 950, fontSize: '1.4rem', color: '#fff' }}>3.6.1-PWA</div>
                                        <div style={{ fontWeight: 800, opacity: 0.6, fontSize: '12px' }}>MARCH 12, 2026</div>
                                    </div>
                                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '15px' }}>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Mobile Command Bar:</strong> Initial release of the PWA bottom navigation for field usage.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Visual Pulse:</strong> Added color-coded "Data Age" indicators to ensure sync health.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Performance:</strong> Global implementation of <code>fadeIn</code> page transitions.</li>
                                    </ul>
                                </section>

                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                        <div style={{ fontWeight: 950, fontSize: '1.4rem', color: '#fff' }}>3.5</div>
                                        <div style={{ fontWeight: 800, opacity: 0.6, fontSize: '12px' }}>MARCH 11, 2026</div>
                                    </div>
                                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '15px' }}>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Pipeline-to-Invoice:</strong> Direct lead conversion engine for rapid billing.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Receipt Forensics:</strong> Integrated file storage for equipment serialized assets.</li>
                                        <li style={{ fontSize: '14px', lineHeight: '1.5' }}><strong>Security Core:</strong> Role-based restriction for administrator-only studio management.</li>
                                    </ul>
                                </section>
                            </div>
                        </div>
                        
                        <button className="btn primary glow-blue" onClick={() => setShowChangeLog(false)} style={{ marginTop: '30px', width: '100%', padding: '15px' }}>CLOSE UPDATES</button>
                    </div>
                </div>
            )}
        </section>
    );
}
