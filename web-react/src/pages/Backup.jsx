import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, fetchAllExpenses } from '../api';
import { useModal } from '../components/ModalContext.jsx';

export default function Backup() {
    const modal = useModal();
    const [msg, setMsg] = useState('');
    const [purging, setPurging] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [stats, setStats] = useState({ expenses: 0, equipment: 0, invoices: 0, clients: 0 });

    const loadStats = async () => {
        try {
            const [exps, eq, inv, cli] = await Promise.all([
                fetchAllExpenses(),
                apiGet('/equipment'),
                apiGet('/invoices'),
                apiGet('/clients')
            ]);
            setStats({
                expenses: (exps || []).length,
                equipment: (eq || []).length,
                invoices: (inv || []).length,
                clients: (cli || []).length
            });
        } catch (e) { console.error("Stats load failed", e); }
    };

    useEffect(() => { loadStats(); }, []);

    const handlePurge = async () => {
        setPurging(true);
        setMsg("📡 Contacting Edge Nodes...");
        try {
            await apiPost("/admin/purge-cloudflare", { purge_everything: true });
            setMsg("✅ Cache Purged. Refresh your browser to see latest.");
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

                const ok = await modal.confirm(`🚨 CRITICAL ACTION: Are you sure you want to RESTORE from this backup? This will replace all existing data for expenses, equipment, and invoices with the contents of this file.`);
                if (!ok) return;

                setRestoring(true);
                const res = await apiPost("/admin/import-all", { backup });
                modal.alert(`✅ Restore Complete! ${res.message}. System updated.`);
                loadStats();
            } catch (err) {
                modal.alert("Error reading backup file: " + err.message);
            } finally {
                setRestoring(false);
                e.target.value = ''; // Reset input
            }
        };
        reader.readAsText(file);
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Elite Header ── */}
            <div className="card glass glow-blue" style={{ border: 'none', padding: '30px', margin: 0, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, background: 'linear-gradient(90deg, #fff, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Studio Control Center
                        </h1>
                        <div className="muted" style={{ marginTop: '8px', fontSize: '15px' }}>Infrastructure Management · Data Security · Disaster Recovery</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div className="tag ok" style={{ fontSize: '11px', fontWeight: 800 }}>SYSTEM VERSION 2.2.0-ELITE</div>
                        <div className="muted small" style={{ marginTop: '6px' }}>Status: <span className="health-dot health-ok" /> Operational</div>
                    </div>
                </div>
            </div>

            {/* ── System Health Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="card glass" style={{ margin: 0, borderTop: '2px solid var(--accent)' }}>
                    <div className="muted small">ACTIVE TRANSACTIONS</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900 }}>{stats.expenses.toLocaleString()}</div>
                    <div className="tag" style={{ fontSize: '9px', marginTop: '8px' }}>POSTGRES ANALYTICS</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '2px solid var(--ok)' }}>
                    <div className="muted small">GEAR ASSETS</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900 }}>{stats.equipment.toLocaleString()}</div>
                    <div className="tag" style={{ fontSize: '9px', marginTop: '8px' }}>DEPRECIATION TRACKED</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '2px solid var(--warn)' }}>
                    <div className="muted small">INVOICES ISSUED</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900 }}>{stats.invoices.toLocaleString()}</div>
                    <div className="tag" style={{ fontSize: '9px', marginTop: '8px' }}>CLIENT REVENUE</div>
                </div>
                <div className="card glass" style={{ margin: 0, borderTop: '2px solid #818cf8' }}>
                    <div className="muted small">CLIENT BASE</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900 }}>{stats.clients.toLocaleString()}</div>
                    <div className="tag" style={{ fontSize: '9px', marginTop: '8px' }}>STUDIO NETWORK</div>
                </div>
            </div>

            <div className="grid two">
                {/* ── Cache Management ── */}
                <div className="card glass glow-blue" style={{ margin: 0, position: 'relative' }}>
                    {purging && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,26,51,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 'inherit' }}>
                            <div className="spinner" style={{ borderTopColor: 'var(--accent)' }} />
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ fontSize: '28px' }}>⚡</div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Infrastructure</h2>
                            <div className="muted small">Cloudflare Global Edge nodes</div>
                        </div>
                    </div>

                    <p className="muted" style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: '24px' }}>
                        Force a global synchronization of your studio data across all edge nodes.
                        Useful after batch imports or major rule updates to clear stale routing.
                    </p>

                    <button className="btn secondary" onClick={handlePurge} style={{ width: '100%', padding: '14px', fontWeight: 900 }}>
                        {purging ? 'COMMUNICATING...' : 'PURGE GLOBAL EDGE CACHE'}
                    </button>

                    {msg && (
                        <div className="tag ok" style={{ marginTop: '16px', width: '100%', justifyContent: 'center', padding: '10px' }}>
                            {msg}
                        </div>
                    )}
                </div>

                {/* ── System Recovery / Restore ── */}
                <div className="card glass glow-green" style={{ margin: 0, position: 'relative' }}>
                    {restoring && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,26,51,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 'inherit' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div className="spinner" style={{ borderTopColor: 'var(--ok)', margin: '0 auto 10px' }} />
                                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ok)' }}>RESTORING MASTER ARCHIVE...</div>
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ fontSize: '28px' }}>🛡️</div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Universal Restore</h2>
                            <div className="muted small">Recover from Master Archive</div>
                        </div>
                    </div>

                    <p className="muted" style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
                        To restore your database, upload a <strong>.json</strong> file generated from the Master Export tool.
                        This action will replace existing studio data with the backup contents.
                    </p>

                    <label className="btn secondary" style={{ width: '100%', padding: '14px', cursor: 'pointer', borderColor: 'rgba(25, 195, 125, 0.3)' }}>
                        <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                        📤 UPLOAD & RESTORE DATABASE
                    </label>
                </div>
            </div>

            {/* ── Master Data Export ── */}
            <div className="card glass glow-blue" style={{ margin: 0, padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '30px' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '32px' }}>📦</div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Master Data Export Archive</h2>
                        </div>
                        <p className="muted" style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                            Generate a comprehensive, uncompressed snapshot of your entire studio ecosystem.
                            This includes all raw JSON data for portability, migration, or deep cold-storage backup.
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <a href="/api/admin/export-all" download className="btn primary glow-blue" style={{ minWidth: '280px', padding: '18px 30px', fontSize: '16px', fontWeight: 900 }}>
                            📥 DOWNLOAD MASTER BACKUP
                        </a>
                        <div className="muted small" style={{ marginTop: '10px' }}>JSON Format · Includes 7 Primary Tables</div>
                    </div>
                </div>
            </div>

            <div className="muted center" style={{ marginTop: '30px', fontSize: '11px', letterSpacing: '0.1em', opacity: 0.6 }}>
                SECURED ACCESS · THROUGH THE LENS MEDIA · CLOUD INFRASTRUCTURE
            </div>
        </section>
    );
}
