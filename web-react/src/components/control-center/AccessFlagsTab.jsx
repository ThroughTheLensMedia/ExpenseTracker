// AccessFlagsTab.jsx — Admin toggles for global feature + bot capability flags
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '../../api';
import { useModal } from '../ModalContext.jsx';

const FEATURE_ORDER = [
    'bank_sync',
    'invoicing',
    'mileage',
    'gear_depreciation',
    'tax_review',
    'ai_assistant',
];

const BOT_ORDER = [
    'bot_security_reviews',
    'bot_saas_management',
    'bot_readonly_ops',
    'bot_require_human_confirm',
];

export default function AccessFlagsTab() {
    const modal = useModal();
    const [flags, setFlags] = useState([]);
    const [audit, setAudit] = useState([]);
    const [migrationPending, setMigrationPending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reasonByKey, setReasonByKey] = useState({});
    const [savingKey, setSavingKey] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [flagsRes, auditRes] = await Promise.all([
                apiGet('/admin/flags'),
                apiGet('/admin/flags/audit?limit=50').catch(() => ({ entries: [] })),
            ]);
            setFlags(Array.isArray(flagsRes.flags) ? flagsRes.flags : []);
            setMigrationPending(!!flagsRes.migration_pending);
            setAudit(Array.isArray(auditRes.entries) ? auditRes.entries : []);
        } catch (err) {
            setError(err.message || 'Failed to load flags');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const byKey = Object.fromEntries(flags.map(f => [f.key, f]));

    const setReason = (key, value) => {
        setReasonByKey(prev => ({ ...prev, [key]: value }));
    };

    const toggleFlag = async (flag, nextEnabled) => {
        const reason = (reasonByKey[flag.key] || '').trim();
        if (!reason) {
            await modal.alert('A reason is required before changing a flag.');
            return;
        }

        if (flag.category === 'feature' && flag.enabled && !nextEnabled) {
            const ok = await modal.confirm(
                `Turn off “${flag.label || flag.key}” for all non-admin users? Existing data stays; new use of this feature will be blocked until you turn it back on.`
            );
            if (!ok) return;
        }

        setSavingKey(flag.key);
        try {
            await apiPatch(`/admin/flags/${flag.key}`, { enabled: nextEnabled, reason });
            setReasonByKey(prev => ({ ...prev, [flag.key]: '' }));
            await load();
        } catch (err) {
            await modal.alert(err.message || 'Failed to update flag');
        } finally {
            setSavingKey(null);
        }
    };

    const renderGroup = (title, keys, note) => (
        <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
            {note && (
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5 }}>{note}</p>
            )}
            <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                {keys.map((key) => {
                    const flag = byKey[key] || { key, enabled: true, label: key, category: key.startsWith('bot_') ? 'bot' : 'feature' };
                    const busy = savingKey === key;
                    return (
                        <div
                            key={key}
                            style={{
                                display: 'grid',
                                gap: 10,
                                padding: '14px 16px',
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(255,255,255,0.03)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>{flag.label || key}</div>
                                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{key}</div>
                                </div>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: migrationPending ? 'not-allowed' : 'pointer' }}>
                                    <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                                        {flag.enabled ? 'ON' : 'OFF'}
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={!!flag.enabled}
                                        disabled={busy || migrationPending}
                                        onChange={(e) => toggleFlag(flag, e.target.checked)}
                                        aria-label={`Toggle ${flag.label || key}`}
                                    />
                                </label>
                            </div>
                            <input
                                type="text"
                                className="input"
                                placeholder="Reason for change (required)"
                                value={reasonByKey[key] || ''}
                                onChange={(e) => setReason(key, e.target.value)}
                                disabled={migrationPending}
                                style={{ width: '100%', fontSize: 13 }}
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );

    if (loading) {
        return <div className="muted" style={{ padding: 24 }}>Loading access flags…</div>;
    }

    if (error) {
        return (
            <section className="card glass" style={{ margin: 0, padding: 24 }}>
                <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
                <button type="button" className="btn sm secondary" style={{ marginTop: 12 }} onClick={load}>Retry</button>
            </section>
        );
    }

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>Access &amp; Flags</h2>
                <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>
                    Global switches for user-facing features and future bot capabilities. Every change needs a reason and is written to the audit log.
                </p>
                {migrationPending && (
                    <div style={{
                        marginTop: 14,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.35)',
                        color: '#fbbf24',
                        fontSize: 13,
                        lineHeight: 1.5,
                    }}>
                        Migration pending — run <code>api/migrations/023_app_flags.sql</code> in the Supabase SQL editor.
                        Showing built-in defaults; toggles are disabled until the tables exist.
                    </div>
                )}
            </section>

            {renderGroup('User-facing features', FEATURE_ORDER, 'Turning a feature off hides it for non-admins and blocks the matching API routes. Existing data is not deleted.')}
            {renderGroup('Bot capabilities', BOT_ORDER, 'Bot switches note: enforcement coming later. These record intent until bot identity is wired.')}

            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Recent flag changes</h3>
                {audit.length === 0 ? (
                    <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>No audit entries yet.</p>
                ) : (
                    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                        {audit.map((entry) => (
                            <div
                                key={entry.id}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    fontSize: 12,
                                    lineHeight: 1.45,
                                }}
                            >
                                <div style={{ fontWeight: 700 }}>
                                    {entry.key}: {String(entry.old_value)} → {String(entry.new_value)}
                                </div>
                                <div className="muted" style={{ marginTop: 4 }}>{entry.reason}</div>
                                <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                                    {entry.changed_at ? new Date(entry.changed_at).toLocaleString() : '—'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
