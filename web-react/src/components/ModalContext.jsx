import React, { createContext, useContext, useState, useCallback } from 'react';

/* ───────────────────────────────────────────────────────────────────────────
   Global Modal Context
   Provides drop-in replacements for window.confirm() and window.alert()
   with a branded "Expense Tracker's Brain says..." modal.

   Usage anywhere in the app:
     const modal = useModal();
     const ok = await modal.confirm('Are you sure?');
     await modal.alert('Something happened!');
─────────────────────────────────────────────────────────────────────────── */

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
    const [queue, setQueue] = useState([]); // stack of { type, message, resolve }

    const current = queue[0] || null;

    const resolve = useCallback((value) => {
        setQueue(q => {
            const [head, ...rest] = q;
            if (head) head.resolve(value);
            return rest;
        });
    }, []);

    const push = useCallback((type, message) =>
        new Promise(res => setQueue(q => [...q, { type, message, resolve: res }])),
        []);

    const modal = {
        confirm: (msg) => push('confirm', msg),
        alert: (msg) => push('alert', msg),
    };

    return (
        <ModalContext.Provider value={modal}>
            {children}
            {current && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 999999,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px',
                    animation: 'fadeIn 0.15s ease'
                }}>
                    <div style={{
                        width: '100%', maxWidth: '480px',
                        background: 'linear-gradient(160deg, rgba(17,30,58,0.99), rgba(10,16,35,0.98))',
                        border: '1px solid rgba(99,102,241,0.35)',
                        borderRadius: '18px',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                        overflow: 'hidden',
                        animation: 'slideUp 0.2s cubic-bezier(0.34,1.56,0.64,1)'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '14px 20px',
                            background: 'rgba(99,102,241,0.12)',
                            borderBottom: '1px solid rgba(99,102,241,0.2)',
                            display: 'flex', alignItems: 'center', gap: '10px'
                        }}>
                            <span style={{ fontSize: '18px' }}>🧠</span>
                            <span style={{
                                fontSize: '11px', fontWeight: 800,
                                letterSpacing: '0.12em', color: 'rgba(165,180,252,0.9)',
                                textTransform: 'uppercase'
                            }}>
                                Expense Tracker's Brain says...
                            </span>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '22px 24px' }}>
                            <p style={{
                                margin: 0, fontSize: '14px', lineHeight: 1.65,
                                color: 'rgba(255,255,255,0.88)'
                            }}>
                                {current.message}
                            </p>
                        </div>

                        {/* Actions */}
                        <div style={{
                            padding: '0 24px 20px',
                            display: 'flex', justifyContent: 'flex-end', gap: '10px'
                        }}>
                            {current.type === 'confirm' && (
                                <button
                                    className="btn secondary"
                                    style={{ padding: '9px 20px' }}
                                    onClick={() => resolve(false)}
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                className="btn"
                                style={{
                                    padding: '9px 22px',
                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    boxShadow: '0 4px 14px rgba(99,102,241,0.4)'
                                }}
                                autoFocus
                                onClick={() => resolve(current.type === 'confirm' ? true : undefined)}
                            >
                                {current.type === 'confirm' ? 'Confirm' : 'OK'}
                            </button>
                        </div>
                    </div>

                    <style>{`
                        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
                        @keyframes slideUp { from { transform: translateY(20px) scale(0.96); opacity: 0 }
                                             to   { transform: translateY(0) scale(1); opacity: 1 } }
                    `}</style>
                </div>
            )}
        </ModalContext.Provider>
    );
}

export function useModal() {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error('useModal must be used inside <ModalProvider>');
    return ctx;
}
