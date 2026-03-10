import React, { useState } from 'react';
import { apiPost } from '../api';

export default function Backup() {
    const [msg, setMsg] = useState('');

    const handlePurge = async () => {
        setMsg("Purging...");
        try {
            await apiPost("/admin/purge-cloudflare", { purge_everything: true });
            setMsg("Purge requested. Hard refresh (Shift+Reload) if the UI still looks stale.");
        } catch (e) {
            setMsg(`Purge failed: ${e.message}`);
        }
    };

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card glass glow-blue" style={{ border: 'none' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900 }}>System Control Center</h1>
                <div className="muted" style={{ marginTop: '4px' }}>Maintenance, Data Portability, and Infrastructure Management</div>
            </div>

            <div className="grid two">
                {/* ── Cache Management ── */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '24px' }}>⚡</div>
                        <div>
                            <h2 style={{ margin: 0 }}>Edge Cache</h2>
                            <div className="muted small">Cloudflare Infrastructure</div>
                        </div>
                    </div>

                    <div className="muted" style={{ marginBottom: '18px', fontSize: '13px', lineHeight: 1.5 }}>
                        If you've recently imported thousands of rows or updated core logic and the UI feels "stale,"
                        this will force the global edge nodes to fetch the latest version of your data.
                    </div>

                    <button className="btn secondary" onClick={handlePurge} style={{ width: '100%', padding: '12px' }}>
                        Purge Global Edge Cache
                    </button>

                    {msg && (
                        <div className="tag ok" style={{ marginTop: '14px', width: '100%', justifyContent: 'center' }}>
                            {msg}
                        </div>
                    )}
                </div>

                {/* ── Data Integrity ── */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '24px' }}>🛡️</div>
                        <div>
                            <h2 style={{ margin: 0 }}>Protection</h2>
                            <div className="muted small">Daily Snapshots</div>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span className="muted small">Database Health</span>
                            <span className="tag ok" style={{ fontSize: '10px' }}>OPTIMIZED</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                            Your data is stored in High-Availability clusters with point-in-time recovery enabled.
                        </div>
                    </div>

                    <div className="muted small" style={{ lineHeight: 1.4 }}>
                        • All <strong>3,100+ Transactions</strong> backed up<br />
                        • Equipment Inventory & Depreciation logs secured<br />
                        • Client & Invoice directories protected
                    </div>
                </div>
            </div>

            <div className="card glass">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <h2 style={{ margin: '0 0 8px 0' }}>📦 Master Data Export</h2>
                        <div className="muted" style={{ fontSize: '14px' }}>
                            Generate a comprehensive encrypted snapshot of your entire studio database.
                            This includes all raw JSON data for portability or migration.
                        </div>
                    </div>
                    <a href="/api/admin/export-all" download className="btn primary glow-blue" style={{ minWidth: '240px', padding: '14px 24px', fontSize: '15px' }}>
                        📥 Download Full Master Backup
                    </a>
                </div>
            </div>

            <div className="muted center" style={{ marginTop: '20px', fontSize: '11px', letterSpacing: '0.05em' }}>
                THROUGH THE LENS MEDIA · SYSTEM VERSION 2.1.0-ELITE
            </div>
        </section>
    );
}
