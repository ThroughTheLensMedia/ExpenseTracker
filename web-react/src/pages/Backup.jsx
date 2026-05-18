import React, { useState, useEffect } from 'react';
import { apiGet, fetchAllExpenses, fetchAllAssets, fetchAllInvoices, fetchAllLeads } from '../api';
import { useAuth } from '../components/AuthContext';

// Tab Components
import ProfileTab from '../components/control-center/ProfileTab.jsx';
import IntelligenceTab from '../components/control-center/IntelligenceTab.jsx';
import AutomationTab from '../components/control-center/AutomationTab.jsx';
import InfrastructureTab from '../components/control-center/InfrastructureTab.jsx';
import HelpTab from '../components/control-center/HelpTab.jsx';
import SaasTab from '../components/control-center/SaasTab.jsx';
import IntegrationTab from '../components/control-center/IntegrationTab.jsx';
import FeedbackTab from '../components/control-center/FeedbackTab.jsx';

const DEFAULT_SETTINGS = {
    business_name: '', contact_name: '', website: '', email: '', phone: '', address: '',
    tax_id: '', invoice_notes: '', signature_text: '', standard_terms: '', payment_methods: '',
    entity_type: 'Sole Proprietorship', naics_code: '711510', business_category: 'Photography Studio', job_title: ''
};

export default function Backup() {
    const { user, subscription, refreshSubscription } = useAuth();
    const [activeTab, setActiveTab] = useState('automation');

    // Base state (loaded immediately — lightweight)
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [isHealthy, setIsHealthy] = useState(null);   // null = not yet checked
    const [isMailerReady, setIsMailerReady] = useState(null);
    const [healthCheckedAt, setHealthCheckedAt] = useState(null);
    const [baseLoaded, setBaseLoaded] = useState(false);

    // Tab-specific state (loaded on demand)
    const [allExpenses, setAllExpenses] = useState([]);
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSkeleton, setShowSkeleton] = useState(false);

    // Admin state
    const [allSubscriptions, setAllSubscriptions] = useState([]);
    const [betaCodes, setBetaCodes] = useState([]);
    const [dailyStats, setDailyStats] = useState([]);
    const [statusMsg, setStatusMsg] = useState(null);

    const isAdmin = user?.email === 'joshua.deuermeyer@gmail.com' || user?.email === 'info@throughthelens.media';

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        if (t && ['automation', 'profile', 'infrastructure', 'help', 'saas', 'intelligence', 'integration', 'feedback'].includes(t)) {
            setActiveTab(t);
        }
    }, [window.location.search]);

    // Base load: health + settings only — fast, fires once on mount
    const loadBase = async () => {
        try {
            const [hlth, st] = await Promise.all([
                apiGet('/health').catch(() => ({ ok: false })),
                apiGet('/settings').catch(() => ({}))
            ]);
            setIsHealthy(hlth.ok && hlth.db !== false);
            setIsMailerReady(!!hlth.mailer);
            setHealthCheckedAt(new Date());
            setSettings(st || {});
        } catch (e) {
            console.error('Base load failed', e);
        } finally {
            setBaseLoaded(true);
        }
    };

    // Tab-specific load: only fetches what the active tab actually needs
    const loadTabData = async (tab, silent = false) => {
        if (!silent) {
            setLoading(true);
            const skeletonTimer = setTimeout(() => setShowSkeleton(true), 800);
            try {
                if (tab === 'automation') {
                    const [exps, rls] = await Promise.all([
                        fetchAllExpenses().catch(() => []),
                        apiGet('/rules').catch(() => ({ rules: [] }))
                    ]);
                    setAllExpenses(exps);
                    setRules(rls.rules || []);
                } else if (tab === 'saas' && isAdmin) {
                    const [subs, codes, adminStatus, dStats] = await Promise.all([
                        apiGet('/admin/subscriptions').catch(() => []),
                        apiGet('/admin/beta-codes').catch(() => []),
                        apiGet('/admin/check-status').catch(err => ({ error: err.message })),
                        apiGet('/admin/daily-report').catch(() => ({ data: [] }))
                    ]);
                    setAllSubscriptions(subs || []);
                    setBetaCodes(codes || []);
                    setDailyStats(dStats.data || []);
                    if (adminStatus.error) setStatusMsg({ type: 'bad', text: 'Admin fetch failed: ' + adminStatus.error });
                    else if (adminStatus.diagnostics?.service_key_degraded) setStatusMsg({ type: 'bad', text: 'Admin service key degraded.' });
                    else setStatusMsg(null);
                }
                // profile, intelligence, infrastructure, integration, help, feedback: no heavy fetch needed
            } finally {
                clearTimeout(skeletonTimer);
                setLoading(false);
                setShowSkeleton(false);
            }
        } else {
            // Silent refresh — same logic, no loading state
            if (tab === 'automation') {
                const [exps, rls] = await Promise.all([
                    fetchAllExpenses().catch(() => []),
                    apiGet('/rules').catch(() => ({ rules: [] }))
                ]);
                setAllExpenses(exps);
                setRules(rls.rules || []);
            } else if (tab === 'saas' && isAdmin) {
                const [subs, codes, dStats] = await Promise.all([
                    apiGet('/admin/subscriptions').catch(() => []),
                    apiGet('/admin/beta-codes').catch(() => []),
                    apiGet('/admin/daily-report').catch(() => ({ data: [] }))
                ]);
                setAllSubscriptions(subs || []);
                setBetaCodes(codes || []);
                setDailyStats(dStats.data || []);
            }
        }
    };

    const loadData = (silent = false) => loadTabData(activeTab, silent);

    useEffect(() => { loadBase(); }, [user]);

    useEffect(() => {
        if (!baseLoaded) return;
        loadTabData(activeTab);
        const timer = setInterval(() => loadTabData(activeTab, true), 60000);
        return () => clearInterval(timer);
    }, [activeTab, baseLoaded]);

    const formatCheckedAt = (d) => {
        if (!d) return '—';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <section className="dashboard" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2.4rem', fontWeight: 950, marginBottom: '6px', color: '#38bdf8' }}>Ledger Control Center</h1>
                    <div className="muted" style={{ fontWeight: 600, fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                        <span>Infrastructure Management & Intelligence Engine</span>
                    </div>
                </div>

                <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className={`pill ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Business Profile</button>
                    <button className={`pill ${activeTab === 'automation' ? 'active' : ''}`} onClick={() => setActiveTab('automation')}>Automation</button>
                    <button className={`pill ${activeTab === 'intelligence' ? 'active' : ''}`} onClick={() => setActiveTab('intelligence')}>AI Intelligence</button>
                    {isAdmin && <button className={`pill ${activeTab === 'infrastructure' ? 'active' : ''}`} onClick={() => setActiveTab('infrastructure')}>Infrastructure</button>}
                    <button className={`pill ${activeTab === 'integration' ? 'active' : ''}`} onClick={() => setActiveTab('integration')}>Integrations</button>
                    <button className={`pill ${activeTab === 'help' ? 'active' : ''}`} onClick={() => setActiveTab('help')}>Documentation</button>
                    <button className={`pill ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => setActiveTab('feedback')}>Feedback</button>
                    {isAdmin && <button className={`pill ${activeTab === 'saas' ? 'active' : ''}`} onClick={() => setActiveTab('saas')}>SaaS Management</button>}
                </nav>
            </div>

            {/* System Status Panel */}
            <div className="card glass" style={{ margin: '0 0 32px', padding: '20px 28px', borderTop: '3px solid rgba(56,189,248,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>System Status</div>
                    <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {[
                            { label: 'Database', ok: isHealthy, okText: 'Connected', badText: 'Offline' },
                            { label: 'Email / SMTP', ok: isMailerReady, okText: 'Ready', badText: 'Not Configured' },
                        ].map(({ label, ok, okText, badText }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                                    background: ok === null ? 'rgba(255,255,255,0.2)' : ok ? '#10b981' : '#ef4444',
                                    boxShadow: ok === null ? 'none' : ok ? '0 0 6px #10b981' : '0 0 6px #ef4444'
                                }} />
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: ok === null ? 'rgba(255,255,255,0.3)' : ok ? '#10b981' : '#ef4444' }}>
                                    {ok === null ? 'Checking…' : ok ? okText : badText}
                                </span>
                            </div>
                        ))}
                        {healthCheckedAt && (
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                                Last checked {formatCheckedAt(healthCheckedAt)}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => loadBase()}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 800, padding: '4px 12px', cursor: 'pointer', letterSpacing: '0.04em' }}
                    >
                        REFRESH
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {showSkeleton && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
                    {[80, 60, 90, 50].map((w, i) => (
                        <div key={i} style={{ height: '18px', width: `${w}%`, borderRadius: '6px', background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                    ))}
                </div>
            )}
            {!showSkeleton && activeTab === 'profile' && <ProfileTab settings={settings} setSettings={setSettings} onReload={loadData} />}
            {!showSkeleton && activeTab === 'intelligence' && <IntelligenceTab settings={settings} setSettings={setSettings} user={user} loading={loading} setLoading={setLoading} onReload={loadData} />}
            {!showSkeleton && activeTab === 'automation' && <AutomationTab rules={rules} allExpenses={allExpenses} onReload={loadData} />}
            {!showSkeleton && activeTab === 'infrastructure' && <InfrastructureTab subscription={subscription} onReload={loadData} />}
            {!showSkeleton && activeTab === 'integration' && <IntegrationTab />}
            {!showSkeleton && activeTab === 'help' && <HelpTab />}
            {!showSkeleton && activeTab === 'feedback' && <FeedbackTab />}
            {!showSkeleton && activeTab === 'saas' && <SaasTab user={user} allSubscriptions={allSubscriptions} betaCodes={betaCodes} dailyStats={dailyStats} statusMsg={statusMsg} onReload={loadData} />}
        </section>
    );
}
