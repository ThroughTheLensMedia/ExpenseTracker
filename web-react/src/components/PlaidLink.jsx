import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiPost, apiGet, apiDelete, invalidateExpensesCache } from '../api';
import { useModal } from './ModalContext.jsx';

const VITE_PRICE = {
    core_monthly:   import.meta.env.VITE_STRIPE_PRICE_CORE_MONTHLY,
    core_annual:    import.meta.env.VITE_STRIPE_PRICE_CORE_ANNUAL,
    studio_monthly: import.meta.env.VITE_STRIPE_PRICE_STUDIO_MONTHLY,
    studio_annual:  import.meta.env.VITE_STRIPE_PRICE_STUDIO_ANNUAL,
};

/**
 * PlaidLink component - Handles bank connection via Plaid Link.
 * Requires the Plaid Link SDK loaded in index.html.
 */
export default function PlaidLink({ onSync, autoConnect = false }) {
    const modal = useModal();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [msg, setMsg] = useState(null);
    const [billingGate, setBillingGate] = useState(false);
    const [billingLoading, setBillingLoading] = useState(null);
    const [billingAnnual, setBillingAnnual] = useState(false);

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

    // Auto-trigger connect when arriving via "Connect a Bank" button on Accounts page
    const autoConnectFired = useRef(false);
    useEffect(() => {
        if (autoConnect && !loading && !autoConnectFired.current) {
            autoConnectFired.current = true;
            handleConnect();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoConnect, loading]);

    const handleConnect = useCallback(async () => {
        const confirmed = await modal.confirm(
            '💳 Live Bank Sync — Billing Notice\n\nConnecting your bank via Plaid adds $0.50/month per connected account to your subscription, billed automatically.\n\nYou can disconnect at any time from the Accounts page.\n\nContinue to connect your bank?'
        );
        if (!confirmed) return;

        setConnecting(true);
        setMsg(null);
        setBillingGate(false);
        try {
            const { link_token } = await apiPost('/plaid/create-link-token');

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
            if (e.message?.includes('plaid_payment_required') || e.status === 402) {
                setBillingGate(true); // show inline billing setup UI
            } else {
                setMsg({ ok: false, text: `Failed to start Plaid: ${e.message}` });
            }
            setConnecting(false);
        }
    }, [onSync, modal]);

    const handleUpgrade = async (planKey) => {
        const priceId = VITE_PRICE[planKey];
        if (!priceId) return;
        setBillingLoading(planKey);
        try {
            const { url } = await apiPost('/stripe/create-checkout', { price_id: priceId });
            if (url) window.location.href = url;
        } catch (err) {
            setMsg({ ok: false, text: `Checkout error: ${err.message}` });
        } finally {
            setBillingLoading(null);
        }
    };

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

            {/* Inline billing gate — shown when user has no payment method on file */}
            {billingGate && (
                <div style={{ padding: '24px 28px', background: 'rgba(249,115,22,0.05)', borderRadius: '16px', border: '1px solid rgba(249,115,22,0.25)' }}>
                    <div style={{ fontWeight: 950, fontSize: '13px', color: '#f97316', marginBottom: '10px', letterSpacing: '0.05em' }}>💳 PAYMENT METHOD REQUIRED</div>
                    <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                        Live Bank Sync adds <strong>$0.50/month per connected account</strong> billed through your Lumière Ledger subscription.
                        A payment method must be on file before connecting.
                    </p>
                    <p style={{ margin: '0 0 18px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                        This is separate from the Stripe key in your Business Profile — that key is for collecting invoice payments from your clients.
                        Choose a plan below to add a billing method, then come back to connect your bank.
                    </p>

                    {/* Monthly / Annual toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Billing:</span>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px' }}>
                            <button onClick={() => setBillingAnnual(false)} style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer', background: !billingAnnual ? 'rgba(255,255,255,0.1)' : 'transparent', color: !billingAnnual ? '#fff' : 'rgba(255,255,255,0.4)' }}>Monthly</button>
                            <button onClick={() => setBillingAnnual(true)} style={{ padding: '5px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer', background: billingAnnual ? 'rgba(56,189,248,0.15)' : 'transparent', color: billingAnnual ? '#38bdf8' : 'rgba(255,255,255,0.4)' }}>Annual · Save 20%</button>
                        </div>
                    </div>

                    {/* Plan cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ padding: '16px 18px', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.04)' }}>
                            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>Core</div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                                {billingAnnual ? '$7.17' : '$9'}<span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mo</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '14px', lineHeight: 1.5 }}>
                                AI Brain · Receipt scanner · 2,000 tx/mo · 20 invoices/mo<br />+ $0.50/mo per Plaid account
                            </div>
                            <button onClick={() => handleUpgrade(billingAnnual ? 'core_annual' : 'core_monthly')} disabled={!!billingLoading} className="btn primary" style={{ width: '100%', padding: '10px', fontSize: '13px', opacity: billingLoading ? 0.6 : 1 }}>
                                {billingLoading === (billingAnnual ? 'core_annual' : 'core_monthly') ? 'Loading...' : 'Subscribe to Core'}
                            </button>
                        </div>
                        <div style={{ padding: '16px 18px', borderRadius: '12px', border: '1px solid rgba(249,115,22,0.25)', background: 'rgba(249,115,22,0.04)' }}>
                            <div style={{ fontWeight: 700, color: '#f97316', marginBottom: '4px' }}>Studio</div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                                {billingAnnual ? '$15.17' : '$19'}<span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mo</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '14px', lineHeight: 1.5 }}>
                                Everything in Core · Unlimited · Mileage · Priority support<br />+ $0.50/mo per Plaid account
                            </div>
                            <button onClick={() => handleUpgrade(billingAnnual ? 'studio_annual' : 'studio_monthly')} disabled={!!billingLoading} className="btn primary glow-blue" style={{ width: '100%', padding: '10px', fontSize: '13px', opacity: billingLoading ? 0.6 : 1 }}>
                                {billingLoading === (billingAnnual ? 'studio_annual' : 'studio_monthly') ? 'Loading...' : 'Subscribe to Studio'}
                            </button>
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                        Already subscribed? Refresh the page and try connecting again.
                    </div>
                </div>
            )}

            {/* Status message */}
            {msg && (
                <div className={`tag ${msg.ok ? 'ok' : 'bad'}`} style={{ padding: '12px 20px', fontSize: '13px', whiteSpace: 'normal', lineHeight: 1.5 }}>
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
