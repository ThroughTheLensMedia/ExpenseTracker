import React, { useState, useEffect } from 'react';
import { apiGet, fetchAllExpenses } from '../api';
import { useAuth } from '../components/AuthContext';

// Tab Components
import ProfileTab from '../components/control-center/ProfileTab.jsx';
import IntelligenceTab from '../components/control-center/IntelligenceTab.jsx';
import AutomationTab from '../components/control-center/AutomationTab.jsx';
import InfrastructureTab from '../components/control-center/InfrastructureTab.jsx';
import HelpTab from '../components/control-center/HelpTab.jsx';
import SaasTab from '../components/control-center/SaasTab.jsx';

const DEFAULT_SETTINGS = {
    business_name: '', contact_name: '', website: '', email: '', phone: '', address: '',
    tax_id: '', invoice_notes: '', signature_text: '', standard_terms: '', payment_methods: '',
    entity_type: 'Sole Proprietorship', naics_code: '711510', business_category: 'Photography Studio', job_title: ''
};

export default function Backup() {
    const { user, subscription, refreshSubscription } = useAuth();
    const [activeTab, setActiveTab] = useState('automation');

    // Shared state
    const [stats, setStats] = useState({ expenses: 0, equipment: 0, invoices: 0, clients: 0 });
    const [allExpenses, setAllExpenses] = useState([]);
    const [rules, setRules] = useState([]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(false);
    const [isHealthy, setIsHealthy] = useState(true);
    const [isMailerReady, setIsMailerReady] = useState(false);

    // Admin state
    const [allSubscriptions, setAllSubscriptions] = useState([]);
    const [betaCodes, setBetaCodes] = useState([]);
    const [dailyStats, setDailyStats] = useState([]);
    const [statusMsg, setStatusMsg] = useState(null);

    const isAdmin = user?.email === 'joshua.deuermeyer@gmail.com' || user?.email === 'info@throughthelens.media';

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        if (t && ['automation', 'profile', 'infrastructure', 'help', 'saas', 'intelligence'].includes(t)) {
            setActiveTab(t);
        }
    }, [window.location.search]);

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
            setIsHealthy(hlth.ok && (hlth.db !== false));
            setIsMailerReady(!!hlth.mailer);

            if (activeTab !== 'profile') setSettings(st || {});

            const activeLeads = (lds.leads || []).filter(l => l.status !== 'Lost');
            setStats({ expenses: exps.length, equipment: eq.length, invoices: inv.length, clients: activeLeads.length });

            if (isAdmin) {
                try {
                    const [subs, codes, adminStatus, dStats] = await Promise.all([
                        apiGet('/admin/subscriptions'),
                        apiGet('/admin/beta-codes'),
                        apiGet('/admin/check-status').catch(err => ({ error: err.message, type: 'bad' })),
                        apiGet('/admin/daily-report').catch(() => ({ data: [] }))
                    ]);
                    setAllSubscriptions(subs || []);
                    setBetaCodes(codes || []);
                    setDailyStats(dStats.data || []);
                    if (adminStatus.error) setStatusMsg({ type: 'bad', text: "Admin Data Fetch Failed: " + adminStatus.error });
                    else if (adminStatus.diagnostics?.service_key_degraded && !adminStatus.diagnostics?.queries_ok) setStatusMsg({ type: 'bad', text: "Admin Service Key is degraded or missing. Some admin functions may not work correctly." });
                    else setStatusMsg(null);
                } catch (err) {
                    if (!silent) setStatusMsg({ type: 'bad', text: "Admin Data Fetch Failed: " + err.message });
                }
            }
        } catch (e) {
            console.error("Master load failed", e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        if (activeTab === 'profile') return;
        const timer = setInterval(() => loadData(true), 60000);
        return () => clearInterval(timer);
    }, [activeTab, user]);

    if (loading && !allExpenses.length) return <div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner" /></div>;

    return (
        <section className="dashboard" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2.4rem', fontWeight: 950, marginBottom: '6px', color: '#38bdf8' }}>Studio Control Center</h1>
                    <div className="muted" style={{ fontWeight: 600, fontSize: '15px' }}>Infrastructure Management & Intelligence Engine</div>
                </div>

                <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className={`pill ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>👤 Business Profile</button>
                    <button className={`pill ${activeTab === 'automation' ? 'active' : ''}`} onClick={() => setActiveTab('automation')}>⚡ Automation</button>
                    <button className={`pill ${activeTab === 'intelligence' ? 'active' : ''}`} onClick={() => setActiveTab('intelligence')}>🧠 AI Intelligence</button>
                    {isAdmin && <button className={`pill ${activeTab === 'infrastructure' ? 'active' : ''}`} onClick={() => setActiveTab('infrastructure')}>🔒 Infrastructure</button>}
                    <button className={`pill ${activeTab === 'help' ? 'active' : ''}`} onClick={() => setActiveTab('help')}>❓ Documentation</button>
                    {isAdmin && <button className={`pill ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}>💎 SaaS Studio Mgmt</button>}
                </nav>
            </div>

            {/* System Health HUD */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'start', marginBottom: '40px' }}>
                {[
                    { label: 'LIVE TRANSACTIONS', value: stats.expenses, color: 'var(--accent)', showHealth: true },
                    { label: 'GEAR ASSETS', value: stats.equipment, color: '#38bdf8' },
                    { label: 'INVOICES', value: stats.invoices, color: '#f97316' },
                    { label: 'PIPELINE CRM', value: stats.clients, color: '#818cf8' },
                ].map(s => (
                    <div key={s.label} className="card glass" style={{ margin: 0, borderTop: `3px solid ${s.color}`, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '160px' }}>
                        <div className="muted extra-small" style={{ fontWeight: 900, letterSpacing: '0.05em' }}>{s.label}</div>
                        <div style={{ fontSize: '2.4rem', fontWeight: 950, marginTop: '6px', lineHeight: 1 }}>{s.value.toLocaleString()}</div>
                        {s.showHealth && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' }}>
                                <span className={`health-dot ${isHealthy ? 'health-ok' : 'health-bad'}`} title={isHealthy ? 'DB Connected' : 'DB Link Offline'} />
                                <span className={`health-dot ${isMailerReady ? 'health-ok' : 'health-bad'}`} title={isMailerReady ? 'SMTP Ready' : 'SMTP Missing'} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' && <ProfileTab settings={settings} setSettings={setSettings} onReload={loadData} />}
            {activeTab === 'intelligence' && <IntelligenceTab settings={settings} setSettings={setSettings} user={user} loading={loading} setLoading={setLoading} onReload={loadData} />}
            {activeTab === 'automation' && <AutomationTab rules={rules} allExpenses={allExpenses} onReload={loadData} />}
            {activeTab === 'infrastructure' && <InfrastructureTab subscription={subscription} onReload={loadData} />}
            {activeTab === 'help' && <HelpTab />}
            {activeTab === 'saas' && <SaasTab user={user} allSubscriptions={allSubscriptions} betaCodes={betaCodes} dailyStats={dailyStats} statusMsg={statusMsg} onReload={loadData} />}
        </section>
    );
}
