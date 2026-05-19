import React, { useState, useEffect, useCallback } from 'react';
import { apiPost, apiGet, apiDelete, invalidateExpensesCache } from '../api';
import { useModal } from './ModalContext.jsx';

/**
 * PlaidLink component - Handles bank connection via Plaid Link.
 *
 * Usage: Drop into the Import page or a dedicated Bank Connections page.
 * Requires the Plaid Link SDK script loaded in index.html:
 *   <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
 */
export default function PlaidLink({ onSync }) {
    const modal = useModal();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [msg, setMsg] = useState(null);

    const loadAccounts = async () => {
        try {
            const data = await apiGet('/plaid/accounts');
            setAccounts(data.accounts || []);
        } catch (e) {
            console.error('[Plaid] Failed to load accounts:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAccounts(); }, []);

    const handleConnect = useCallback(async () => {
        setConnecting(true);
        setMsg(null);
        try {
            // 1. Get link token from our API
            const { link_token } = await apiPost('/plaid/create-link-token');

            // 2. Open Plaid Link
            if (!window.Plaid) {
                setMsg({ ok: false, text: 'Plaid SDK not loaded. Please refresh the page.' });
                setConnecting(false);
                return;
            }

            const handler = window.Plaid.create({
                token: link_token,
                onSuccess: async (public_token, metadata) => {
                    try {
                        const result = await apiPost('/plaid/exchange-token', {
                            public_token,
                            institution: metadata.institution,
                        });
                        invalidateExpensesCache();
                        const linkedNote = result.linked > 0 ? ` Matched ${result.linked} existing imported transactions.` : '';
                        setMsg({ ok: true, text: `Connected ${result.connection.institution_name}! ${result.synced} new transactions imported.${linkedNote}` });
                        loadAccounts();
                        if (onSync) onSync();
                    } catch (err) {
                        setMsg({ ok: false, text: `Connection failed: ${err.message}` });
                    }
                    setConnecting(false);
                },
                onExit: (err) => {
                    if (err) console.warn('[Plaid] Link exit with error:', err);
                    setConnecting(false);
                },
            });
            handler.open();
        } catch (e) {
            setMsg({ ok: false, text: `Failed to start Plaid: ${e.message}` });
            setConnecting(false);
        }
    }, [onSync]);

    const handleSync = async () => {
        setSyncing(true);
        setMsg(null);
        try {
            const result = await apiPost('/plaid/sync');
            invalidateExpensesCache();
            const linkedNote = result.linked > 0 ? ` ${result.linked} matched to existing imports.` : '';
            setMsg({ ok: true, text: `Synced ${result.added} new, ${result.modified} updated, ${result.removed} removed.${linkedNote}` });
            if (onSync) onSync();
        } catch (e) {
            setMsg({ ok: false, text: `Sync failed: ${e.message}` });
        } finally {
            setSyncing(false);
        }
    };

    const handleDisconnect = async (id, name) => {
        const ok = await modal.confirm(`Disconnect ${name}? Existing transactions will remain.`);
        if (!ok) return;
        try {
            await apiDelete(`/plaid/accounts/${id}`);
            setMsg({ ok: true, text: `${name} disconnected.` });
            loadAccounts();
        } catch (e) {
            setMsg({ ok: false, text: `Failed: ${e.message}` });
        }
    };

    const activeAccounts = accounts.filter(a => a.status === 'active');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.4rem' }}>🏦 Connected Bank Accounts</h3>
                    <p className="muted" style={{ fontSize: '13px', marginTop: '6px' }}>
                        Auto-sync transactions directly from your bank via Plaid. No CSV uploads needed.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn primary glow-blue" onClick={handleConnect} disabled={connecting} style={{ fontWeight: 900 }}>
                        {connecting ? 'Connecting...' : '+ Connect Bank'}
                    </button>
                    {activeAccounts.length > 0 && (
                        <button className="btn secondary" onClick={handleSync} disabled={syncing} style={{ fontWeight: 900 }}>
                            {syncing ? 'Syncing...' : '🔄 Sync All'}
                        </button>
                    )}
                </div>
            </div>

            {/* Status message */}
            {msg && (
                <div className={`tag ${msg.ok ? 'ok' : 'bad'}`} style={{ padding: '12px 20px', fontSize: '13px' }}>
                    {msg.ok ? '✅' : '❌'} {msg.text}
                </div>
            )}

            {/* Connected accounts list */}
            {loading ? (
                <div className="muted" style={{ textAlign: 'center', padding: '30px' }}>Loading accounts...</div>
            ) : activeAccounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏦</div>
                    <div style={{ fontWeight: 800, marginBottom: '8px' }}>No Banks Connected</div>
                    <div className="muted" style={{ fontSize: '13px', maxWidth: '400px', margin: '0 auto' }}>
                        Click "Connect Bank" to securely link your bank account via Plaid. Transactions will auto-sync daily.
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeAccounts.map(acct => (
                        <div key={acct.id} className="card glass" style={{ margin: 0, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '15px' }}>🏦 {acct.institution_name}</div>
                                <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                    Last synced: {acct.last_synced_at
                                        ? new Date(acct.last_synced_at).toLocaleString()
                                        : 'Never'}
                                </div>
                            </div>
                            <button
                                className="btn sm danger"
                                onClick={() => handleDisconnect(acct.id, acct.institution_name)}
                                style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }}
                            >
                                Disconnect
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
