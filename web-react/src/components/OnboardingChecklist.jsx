import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'll_onboarding_dismissed';

const STEPS = [
    {
        id: 'profile',
        icon: '🏢',
        title: 'Set Up Your Business Profile',
        desc: 'Add your business name, logo, contact info, and tax entity type. This personalizes your invoices and reports.',
        action: { label: 'Go to Profile', path: '/StudioControlCenter?tab=profile' },
    },
    {
        id: 'ai',
        icon: '🤖',
        title: 'Set Up AI Brain',
        desc: 'Add your Google Gemini API key to unlock the AI Financial Assistant — ask questions about your business in plain English.',
        action: { label: 'Set Up AI', path: '/StudioControlCenter?tab=integrations' },
    },
    {
        id: 'plaid',
        icon: '🏦',
        title: 'Connect Your Bank via Plaid',
        desc: 'Link your bank account for automatic transaction sync. Requires an active billing method ($0.50/account/month).',
        action: { label: 'Connect Bank', path: '/import' },
    },
    {
        id: 'docs',
        icon: '📖',
        title: 'Review the Documentation',
        desc: 'Learn how to import transactions, set up tax categories, track mileage, and get the most out of Lumière Ledger.',
        action: { label: 'Read Docs', path: '/StudioControlCenter?tab=help' },
    },
];

export default function OnboardingChecklist({ onDismiss }) {
    const navigate = useNavigate();
    const [checked, setChecked] = useState(() => {
        try { return JSON.parse(localStorage.getItem('ll_onboarding_checked') || '{}'); }
        catch { return {}; }
    });

    function toggleCheck(id) {
        const next = { ...checked, [id]: !checked[id] };
        setChecked(next);
        localStorage.setItem('ll_onboarding_checked', JSON.stringify(next));
    }

    function dismiss() {
        localStorage.setItem(STORAGE_KEY, '1');
        onDismiss?.();
    }

    function go(path) {
        navigate(path);
        dismiss();
    }

    const doneCount = STEPS.filter(s => checked[s.id]).length;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                border: '1px solid rgba(249,115,22,0.25)',
                borderRadius: 24, padding: '36px 32px',
                maxWidth: 560, width: '100%',
                boxShadow: '0 0 60px rgba(249,115,22,0.12)',
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>✦</div>
                    <h2 style={{ fontSize: 22, fontWeight: 950, letterSpacing: '-0.02em', margin: '0 0 8px', color: 'white' }}>
                        Welcome to Lumière Ledger
                    </h2>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                        Get set up in 4 steps. You can return to this checklist from the Settings menu.
                    </p>
                    {doneCount > 0 && (
                        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                            {doneCount} of {STEPS.length} complete
                        </div>
                    )}
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
                    <div style={{ width: `${(doneCount / STEPS.length) * 100}%`, height: '100%', background: '#f97316', borderRadius: 2, transition: 'width 0.4s ease' }} />
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                    {STEPS.map(step => (
                        <div key={step.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 14,
                            background: checked[step.id] ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${checked[step.id] ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)'}`,
                            borderRadius: 14, padding: '14px 16px',
                            opacity: checked[step.id] ? 0.7 : 1,
                        }}>
                            {/* Checkbox */}
                            <button onClick={() => toggleCheck(step.id)} style={{
                                width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
                                background: checked[step.id] ? '#10b981' : 'rgba(255,255,255,0.06)',
                                border: `2px solid ${checked[step.id] ? '#10b981' : 'rgba(255,255,255,0.2)'}`,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 13, fontWeight: 900, padding: 0,
                            }}>
                                {checked[step.id] ? '✓' : ''}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                    <span style={{ fontSize: 16 }}>{step.icon}</span>
                                    <span style={{ fontSize: 14, fontWeight: 900, color: 'white', textDecoration: checked[step.id] ? 'line-through' : 'none', opacity: checked[step.id] ? 0.6 : 1 }}>{step.title}</span>
                                </div>
                                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, lineHeight: 1.5 }}>{step.desc}</p>
                                <button onClick={() => go(step.action.path)}
                                    style={{ fontSize: 11, fontWeight: 800, color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationColor: 'rgba(249,115,22,0.4)' }}>
                                    {step.action.label} →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Dismiss */}
                <button onClick={dismiss} style={{
                    width: '100%', padding: '13px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                }}>
                    I'll set up later — Take me to the app
                </button>
            </div>
        </div>
    );
}

// Hook: returns true if onboarding should be shown (new user, never dismissed)
export function shouldShowOnboarding(settings) {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(STORAGE_KEY)) return false;
    // Show if profile isn't filled in yet (new user)
    return !settings?.business_name;
}
