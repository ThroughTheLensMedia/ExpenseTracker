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

export default function Backup() {
    const modal = useModal();
    const [activeTab, setActiveTab] = useState('automation'); // 'automation' or 'infrastructure'

    // --- Common States ---
    const [stats, setStats] = useState({ expenses: 0, equipment: 0, invoices: 0, clients: 0 });
    const [allExpenses, setAllExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isHealthy, setIsHealthy] = useState(true);

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

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const results = await Promise.allSettled([
                fetchAllExpenses(),
                apiGet('/assets'),
                apiGet('/invoices'),
                apiGet('/invoices/clients'),
                apiGet('/rules'),
                apiGet('/health')
            ]);

            const exps = results[0].status === 'fulfilled' ? results[0].value : [];
            const eq = results[1].status === 'fulfilled' ? results[1].value : [];
            const inv = results[2].status === 'fulfilled' ? results[2].value : [];
            const cli = results[3].status === 'fulfilled' ? results[3].value : [];
            const rulesData = results[4].status === 'fulfilled' ? results[4].value : { rules: [] };
            const health = results[5].status === 'fulfilled' ? results[5].value : { ok: false };

            setAllExpenses(exps || []);
            setRules(rulesData.rules || []);
            setIsHealthy(health.ok);
            setStats({
                expenses: (exps || []).length,
                equipment: (eq || []).length,
                invoices: (inv || []).length,
                clients: (cli || []).length
            });
        } catch (e) {
            console.error("Data load failed critically", e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Silent Background Sync every 60 seconds (prevents the "refresh" flicker)
        const timer = setInterval(() => loadData(true), 60000);
        return () => clearInterval(timer);
    }, []);

    // --- Automation Logic ---
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
        try {
            const data = customPayload || {
                match_column: matchColumn,
                match_type: 'contains',
                match_value: matchValue,
                assign_category: category,
                assign_tax_bucket: '',
                assign_tax_deductible: true,
                assign_business_use_pct: 100
            };
            await apiPost('/rules', data);
            setMatchValue(''); setCategory('');
            loadData(true);
        } catch (err) { modal.alert(`Failed: ${err.message}`); }
    };

    const handleDeleteRule = async (id) => {
        const ok = await modal.confirm('Delete this automation rule?');
        if (!ok) return;
        await apiDelete(`/rules/${id}`);
        loadData(true);
    };

    const runWithProgress = async (callback) => {
        setApplying(true);
        setProgress(0);
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 92) return prev;
                return prev + Math.random() * 15;
            });
        }, 400);

        try {
            await callback();
            setProgress(100);
            setTimeout(() => { setProgress(0); setApplying(false); }, 1000);
        } catch (e) {
            setApplying(false);
            setProgress(0);
            throw e;
        } finally {
            clearInterval(interval);
        }
    };

    const handleApplyRules = async () => {
        setApplyMsg('🔄 Scanning transactions...');
        try {
            await runWithProgress(async () => {
                const r = await fetch('/api/import/apply-rules', { method: 'POST', credentials: 'include' });
                const data = await r.json();
                setApplyMsg(`✅ Success: ${data.updated} transactions updated.`);
            });
            setTimeout(() => setApplyMsg(''), 6000);
        } catch (e) { setApplyMsg(`❌ ${e.message}`); }
    };

    const handlePreviewRule = async (id) => {
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
        setRuleStatus(s => ({ ...s, [id]: { ...s[id], applying: true, applyMsg: 'Applying...' } }));
        try {
            const r = await fetch(`/api/rules/${id}/apply`, { method: 'POST', credentials: 'include' });
            const data = await r.json();
            setRuleStatus(s => ({ ...s, [id]: { applying: false, applyMsg: `✅ ${data.updated} transactions updated.` } }));
        } catch (e) {
            setRuleStatus(s => ({ ...s, [id]: { applying: false, applyMsg: `❌ ${e.message}` } }));
        }
    };

    // --- Infrastructure Logic ---
    const handlePurge = async () => {
        setPurging(true);
        setMsg("📡 Contacting Edge Nodes...");
        try {
            await apiPost("/admin/purge-cloudflare", { purge_everything: true });
            setMsg("✅ Cache Purged. Refresh your browser for latest.");
            setTimeout(() => setMsg(''), 6000);
        } catch (e) {
            modal.alert(`Purge failed: ${e.message}`);
        } finally {
            setPurging(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                const ok = await modal.confirm(`🚨 CRITICAL ACTION: Are you sure you want to RESTORE? Current data will be replaced.`);
                if (!ok) return;
                setRestoring(true);
                const res = await apiPost("/admin/import-all", { backup });
                modal.alert(`✅ Restore Complete! System updated.`);
                loadData(true);
            } catch (err) {
                modal.alert("Error reading backup file: " + err.message);
            } finally {
                setRestoring(false);
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Studio Control Center Header ── */}
            <div className="card glass glow-blue" style={{ border: 'none', padding: '30px', margin: 0, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, background: 'linear-gradient(90deg, #fff, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Studio Control Center
                        </h1>
                        <div className="muted" style={{ marginTop: '8px', fontSize: '15px' }}>Automation Engine · Infrastructure Management · Studio Security</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div className="tag ok" style={{ fontSize: '11px', fontWeight: 800 }}>V3.5.0-SCC</div>
                        <div className="muted small" style={{ marginTop: '6px' }}>
                            Status: <span className={`health-dot ${isHealthy ? 'health-ok' : 'health-bad'}`} /> {isHealthy ? 'Operational' : 'API Connection Issues'}
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                    <button
                        className={`pill ${activeTab === 'automation' ? 'active' : ''}`}
                        onClick={() => setActiveTab('automation')}
                        style={{ padding: '10px 24px', fontSize: '14px' }}
                    >
                        ⚡ Automation Engine
                    </button>
                    <button
                        className={`pill ${activeTab === 'infrastructure' ? 'active' : ''}`}
                        onClick={() => setActiveTab('infrastructure')}
                        style={{ padding: '10px 24px', fontSize: '14px' }}
                    >
                        🔒 Infrastructure & Backup
                    </button>
                </div>
            </div>

            {/* ── Live System Health Bar ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="card glass" style={{ margin: 0, borderTop: '2px solid var(--accent)', padding: '20px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>TOTAL ENTRIES</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '4px' }}>{stats.expenses.toLocaleString()}</div>
                    <div className="tag" style={{ fontSize: '9px', marginTop: '8px' }}>POSTGRES LIVE</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '2px solid var(--ok)', padding: '20px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>STUDIO ASSETS</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '4px' }}>{stats.equipment.toLocaleString()}</div>
                    <div className="tag" style={{ fontSize: '9px', marginTop: '8px' }}>GEAR PORTFOLIO</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '2px solid var(--warn)', padding: '20px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>CLASSIFICATION RULES</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '4px' }}>{rules.length.toLocaleString()}</div>
                    <div className="tag" style={{ fontSize: '9px', marginTop: '8px' }}>ACTIVE ENGINE</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '2px solid #818cf8', padding: '20px' }}>
                    <div className="muted small" style={{ fontWeight: 800 }}>CLIENTS</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '4px' }}>{stats.clients.toLocaleString()}</div>
                    <div className="tag" style={{ fontSize: '9px', marginTop: '8px' }}>CRM RECORDS</div>
                </div>
            </div>

            {loading && activeTab === 'automation' && <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>}

            {activeTab === 'automation' ? (
                /* ── AUTOMATION ENGINE VIEW ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card glass glow-blue" style={{ padding: '24px', border: 'none', margin: 0, position: 'relative', overflow: 'hidden' }}>
                        {applying && (
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, height: '4px',
                                width: `${progress}%`, background: 'var(--accent)',
                                boxShadow: '0 0 10px var(--accent)', transition: 'width 0.4s ease'
                            }} />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Engine Retro-Sync</h2>
                                <div className="muted" style={{ fontSize: '13px', marginTop: '4px' }}>Apply matching rules to catch historical transactions in your ledger.</div>
                                {applyMsg && <div style={{ marginTop: '8px', fontSize: '12px', color: '#4ade80', fontWeight: 700 }}>{applyMsg}</div>}
                            </div>
                            <button className="btn primary" onClick={handleApplyRules} disabled={applying}>
                                {applying ? '⏳ Synchronizing...' : 'Apply Rules to Ledger'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '20px', alignItems: 'start' }}>
                        {/* MAIN BLOCK: Active Rules List (Expanded to fit screen) */}
                        <div className="card glass" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Active Engine Rules</h2>
                                <div className="muted small" style={{ fontWeight: 800 }}>{rules.length} TOTAL RULES</div>
                            </div>

                            <div className="tableWrap" style={{ flex: 1, padding: '0', overflowY: 'visible', overflowX: 'hidden', border: 'none', background: 'transparent' }}>
                                <table className="glass" style={{ width: '100%', minWidth: '0', borderCollapse: 'separate', borderSpacing: '0 8px', margin: 0 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'transparent' }}>Match Criteria</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'transparent' }}>Assignment</th>
                                            <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'transparent' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rules.length === 0 && !loading && <tr><td colSpan="3" align="center" className="muted" style={{ padding: '60px' }}>No rules found.</td></tr>}
                                        {rules.map(r => {
                                            const rs = ruleStatus[r.id] || {};
                                            return (
                                                <React.Fragment key={r.id}>
                                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                        <td style={{ padding: '12px 16px', borderRadius: '8px 0 0 8px' }}>
                                                            <div style={{ fontWeight: 800, color: 'var(--warn)', fontSize: '14px' }}>"{r.match_value}"</div>
                                                            <div className="muted" style={{ fontSize: '10px', marginTop: '2px' }}>KEYWORD TRIGGER</div>
                                                        </td>
                                                        <td style={{ fontWeight: 700, fontSize: '13px', padding: '12px 16px' }}>
                                                            {r.assign_category || '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'right', padding: '12px 16px', borderRadius: '0 8px 8px 0' }}>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                <button className="btn sm secondary" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => handlePreviewRule(r.id)} disabled={rs.loading}>
                                                                    {rs.loading ? '...' : 'AUDIT'}
                                                                </button>
                                                                <button className="btn sm danger" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => handleDeleteRule(r.id)}>✕</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {rs.preview && (
                                                        <tr>
                                                            <td colSpan="3" style={{ padding: '0 0 8px 0' }}>
                                                                <div className="glass" style={{ background: 'rgba(25, 195, 125, 0.05)', padding: '16px', borderRadius: '8px' }}>
                                                                    <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 800 }}>Found {rs.preview.matchCount} records in ledger.</div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                                                        <button className="btn primary sm" style={{ fontSize: '10px', padding: '6px 14px' }} onClick={() => handleApplySingleRule(r.id)} disabled={rs.applying}>
                                                                            {rs.applying ? 'Applying...' : 'Apply Assignment Now'}
                                                                        </button>
                                                                        {rs.applyMsg && <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 700 }}>{rs.applyMsg}</span>}
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

                        {/* SIDEBAR: Create Rule + Discovery */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Create Rule (Moved to Sidebar) */}
                            <div className="card glass glow-blue" style={{ margin: 0, padding: '20px' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>➕ Add Rule</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <small className="muted" style={{ fontWeight: 800, fontSize: '9px' }}>KEYWORD</small>
                                        <input value={matchValue} onChange={e => setMatchValue(e.target.value)} placeholder="Adobe" style={{ marginTop: '4px', fontSize: '12px' }} />
                                    </div>
                                    <div>
                                        <small className="muted" style={{ fontWeight: 800, fontSize: '9px' }}>CATEGORY</small>
                                        <div style={{ marginTop: '4px' }}>
                                            <CategorySelect value={category} onChange={val => setCategory(val)} />
                                        </div>
                                    </div>
                                    <button className="btn primary" style={{ width: '100%', height: '38px', fontSize: '12px', marginTop: '4px' }} onClick={() => handleCreateRule()} disabled={!matchValue || !category}>SAVE ENGINE RULE</button>
                                </div>
                            </div>

                            <div className="card glass glow-green" style={{ margin: 0, padding: '20px' }}>
                                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#4ade80', fontWeight: 900 }}>💡 DISCOVERY</h3>
                                <div className="muted small" style={{ margin: '6px 0 15px' }}>Top missing rules.</div>
                                <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto' }}>
                                    {discoveryVendors.map(([name, count]) => (
                                        <button key={name} className="btn secondary sm" style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '8px' }} onClick={() => setMatchValue(name)}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>{name}</span>
                                            <span className="tag ok" style={{ fontSize: '9px', padding: '2px 4px' }}>{count}x</span>
                                        </button>
                                    ))}
                                    {discoveryVendors.length === 0 && <div className="muted small center italic">All clear!</div>}
                                </div>
                            </div>

                            <div className="card glass" style={{ margin: 0, padding: '20px' }}>
                                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900 }}>📦 LIBRARIES</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '12px' }}>
                                    {QUICK_SUBS.map(sub => (
                                        <button key={sub.name} className="btn secondary sm" style={{ fontSize: '9px', padding: '8px 4px' }} onClick={() => handleCreateRule({
                                            match_column: 'vendor', match_type: 'contains', match_value: sub.name,
                                            assign_category: sub.cat, assign_tax_bucket: sub.bucket,
                                            assign_tax_deductible: true, assign_business_use_pct: 100
                                        })}>+ {sub.name}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── INFRASTRUCTURE & BACKUP VIEW ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="grid two">
                        <div className="card glass glow-blue" style={{ margin: 0, position: 'relative', padding: '24px' }}>
                            {purging && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,26,51,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 'inherit' }}>
                                    <div className="spinner" />
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ fontSize: '32px' }}>⚡</div>
                                <div>
                                    <h2 style={{ margin: 0 }}>Edge Cache</h2>
                                    <div className="muted small">Cloudflare Infrastructure</div>
                                </div>
                            </div>
                            <p className="muted" style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: '24px' }}>
                                Purge global edge nodes to clear stale data routing.
                                Perform if UI elements feel out of sync after major imports.
                            </p>
                            <button className="btn secondary" onClick={handlePurge} style={{ width: '100%', padding: '14px', fontWeight: 900 }}>
                                {purging ? 'CONTACTING CLOUDFLARE...' : 'PURGE GLOBAL EDGE CACHE'}
                            </button>
                            {msg && <div className="tag ok" style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}>{msg}</div>}
                        </div>

                        <div className="card glass glow-green" style={{ margin: 0, position: 'relative', padding: '24px' }}>
                            {restoring && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,26,51,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 'inherit' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div className="spinner" style={{ borderTopColor: 'var(--ok)' }} />
                                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ok)', marginTop: '10px' }}>RESTORING MASTER ARCHIVE...</div>
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ fontSize: '32px' }}>🛡️</div>
                                <div>
                                    <h2 style={{ margin: 0 }}>Studio Restore</h2>
                                    <div className="muted small">Disaster Recovery Suite</div>
                                </div>
                            </div>
                            <p className="muted" style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: '24px' }}>
                                Recover your studio's entire history. Upload a Master snapshot (.json) to replace current data with archived records.
                            </p>
                            <label className="btn secondary" style={{ width: '100%', padding: '14px', cursor: 'pointer', borderColor: 'rgba(25, 195, 125, 0.4)' }}>
                                <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                                📤 UPLOAD & RESTORE STUDIO
                            </label>
                        </div>
                    </div>

                    <div className="card glass glow-blue" style={{ margin: 0, padding: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '300px' }}>
                                <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>📦 Master Infrastructure Backup</h2>
                                <p className="muted" style={{ fontSize: '15px', lineHeight: 1.6 }}>
                                    Secure your business data. Download a comprehensive snapshot of all transactions, equipment portfolios, and invoice history for cold storage or migration.
                                </p>
                            </div>
                            <a href="/api/admin/export-all" download className="btn primary glow-blue" style={{ minWidth: '280px', padding: '20px 40px', fontSize: '18px', fontWeight: 900 }}>
                                📥 DOWNLOAD BACKUP
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* ── System Details Footer ── */}
            <div style={{ marginTop: '40px', padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '20px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em' }} className="muted">
                    <span>BUILD: v3.5.0-ELITE-REACT</span>
                    <span>ENV: {process.env.NODE_ENV || 'production'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em' }} className="muted">
                    API STATUS: <span className={`health-dot ${isHealthy ? 'health-ok' : 'health-bad'}`} />
                    {isHealthy ? 'SYNCHRONIZED' : 'UNSTABLE CONNECTION'}
                </div>
            </div>

            <div className="muted center" style={{ fontSize: '10px', letterSpacing: '0.2em', opacity: 0.3, paddingBottom: '20px' }}>
                PROTECTING THROUGH THE LENS MEDIA · STUDIO CONTROL v3.5
            </div>
        </section>
    );
}
