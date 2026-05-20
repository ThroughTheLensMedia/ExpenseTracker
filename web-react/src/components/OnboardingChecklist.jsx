import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY   = 'll_onboarding_dismissed_v2'; // bump version to re-show for all users
const CHECKED_KEY   = 'll_onboarding_checked';

// ─── Content ──────────────────────────────────────────────────────────────────
const FEATURES = [
    { icon: '📊', label: 'Transaction Ledger',  desc: 'Import & categorize every expense' },
    { icon: '🤖', label: 'AI Brain',            desc: 'Ask questions about your finances' },
    { icon: '🧾', label: 'Invoicing',           desc: 'Create & send professional invoices' },
    { icon: '🏦', label: 'Bank Sync (Plaid)',   desc: 'Automatic live transaction import' },
    { icon: '📷', label: 'Gear Depreciation',   desc: 'Track camera gear & write-offs' },
    { icon: '🚗', label: 'Mileage Log',         desc: 'Auto A→B→A round-trip tracking' },
];

const STEPS = [
    {
        id: 'profile',
        icon: '🏢',
        title: 'Set Up Business Profile',
        desc: 'Add your business name, logo, and tax entity. This populates your invoices and reports.',
        action: { label: 'Open Profile', path: '/StudioControlCenter?tab=profile' },
        required: true,
    },
    {
        id: 'import',
        icon: '📥',
        title: 'Import Your Transactions',
        desc: 'Download a CSV from your bank and import it — or connect via Plaid for live automatic sync.',
        action: { label: 'Go to Bank Import', path: '/import' },
        required: true,
    },
    {
        id: 'ai',
        icon: '🤖',
        title: 'Add Your Gemini API Key',
        desc: 'Get a free key at aistudio.google.com. Unlocks the AI Financial Assistant — ask anything about your business.',
        action: { label: 'Set Up AI', path: '/StudioControlCenter?tab=integrations' },
        required: false,
    },
    {
        id: 'invoice',
        icon: '🧾',
        title: 'Create Your First Invoice',
        desc: 'Send a professional invoice to a client. Your business profile info pre-fills automatically.',
        action: { label: 'Open Invoicing', path: '/crm' },
        required: false,
    },
    {
        id: 'docs',
        icon: '📖',
        title: 'Explore the Help Docs',
        desc: 'Tips on CSV import, tax categories, mileage tracking, and more.',
        action: { label: 'Open Docs', path: '/StudioControlCenter?tab=help' },
        required: false,
    },
];

// ─── Reusable pill ─────────────────────────────────────────────────────────
function Pill({ children, color = '#f97316' }) {
    return (
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 20, background: `${color}22`, color, border: `1px solid ${color}44` }}>
            {children}
        </span>
    );
}

// ─── Shared modal shell ────────────────────────────────────────────────────
function ModalShell({ children, accent = '#f97316' }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: `1px solid ${accent}33`, borderRadius: 24, padding: '36px 32px', maxWidth: 560, width: '100%', boxShadow: `0 0 80px ${accent}18`, maxHeight: '90vh', overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
}

// ─── Page 0: Welcome ──────────────────────────────────────────────────────
function PageWelcome({ onNext, onSkip }) {
    return (
        <ModalShell accent="#f97316">
            {/* Logo mark */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>✦</div>
                <h2 style={{ fontSize: 24, fontWeight: 950, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'white' }}>
                    Welcome to Lumière Ledger
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
                    Financial intelligence built for photographers.<br />
                    Track income, expenses, gear, mileage, and invoices — all in one place.
                </p>
            </div>

            {/* Feature grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 28 }}>
                {FEATURES.map(f => (
                    <div key={f.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{f.icon}</span>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: 'white', marginBottom: 2 }}>{f.label}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, lineHeight: 1.4 }}>{f.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* CTA */}
            <button onClick={onNext} style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#f97316', border: 'none', color: 'white', fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: '-0.01em', marginBottom: 10 }}>
                Get Started — Show me the setup steps →
            </button>
            <button onClick={onSkip} style={{ width: '100%', padding: '11px', borderRadius: 12, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                I know what I'm doing — skip setup
            </button>
        </ModalShell>
    );
}

// ─── Page 1: How to get data in ────────────────────────────────────────────
function PageDataImport({ onNext, onBack, onSkip }) {
    return (
        <ModalShell accent="#38bdf8">
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Step 1 of 2</div>
                <h2 style={{ fontSize: 20, fontWeight: 950, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'white' }}>
                    📥 Getting Your Transactions In
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
                    Lumière Ledger works best when your transactions are here. Two ways to do it:
                </p>
            </div>

            {/* Option A: CSV */}
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 16, padding: '18px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>📄</span>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'white' }}>CSV Import <Pill color="#38bdf8">Free</Pill></div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 2 }}>Download from your bank, drag &amp; drop here</div>
                    </div>
                </div>
                <ul style={{ margin: '0 0 0 4px', padding: '0 0 0 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, lineHeight: 1.8 }}>
                    <li>Works with USAA, Chase, Wells Fargo, Amex, and more</li>
                    <li>One-time import — re-import each month to stay current</li>
                    <li>Go to <strong style={{ color: '#38bdf8' }}>Operations → Bank Import</strong></li>
                </ul>
            </div>

            {/* Option B: Plaid */}
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: '18px 20px', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>🏦</span>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'white' }}>Live Bank Sync via Plaid <Pill color="#10b981">$0.50/account/mo</Pill></div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 2 }}>Connect your bank once — transactions sync automatically</div>
                    </div>
                </div>
                <ul style={{ margin: '0 0 0 4px', padding: '0 0 0 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, lineHeight: 1.8 }}>
                    <li>Supported: USAA, Chase, Bank of America, and 10,000+ banks</li>
                    <li>New transactions appear automatically — nothing to download</li>
                    <li>Requires a billing method on file</li>
                    <li>Go to <strong style={{ color: '#10b981' }}>Operations → Bank Import → Connect Bank</strong></li>
                </ul>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onBack} style={{ flex: '0 0 auto', padding: '12px 20px', borderRadius: 12, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button onClick={onNext} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#38bdf8', border: 'none', color: '#0f172a', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
                    Next: Setup Checklist →
                </button>
            </div>
            <button onClick={onSkip} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                Skip — take me to the app
            </button>
        </ModalShell>
    );
}

// ─── Page 2: Setup checklist ────────────────────────────────────────────────
function PageChecklist({ onDone, onBack, minimized, onMinimize, onRestore }) {
    const navigate = useNavigate();
    const [checked, setChecked] = useState(() => {
        try { return JSON.parse(localStorage.getItem(CHECKED_KEY) || '{}'); }
        catch { return {}; }
    });

    function toggleCheck(id) {
        const next = { ...checked, [id]: !checked[id] };
        setChecked(next);
        localStorage.setItem(CHECKED_KEY, JSON.stringify(next));
    }

    function go(path) {
        onMinimize();
        navigate(path);
    }

    if (minimized) {
        return (
            <button onClick={onRestore} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', border: 'none', borderRadius: 999, padding: '12px 20px', color: 'white', fontWeight: 900, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 24px rgba(167,139,250,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                📋 Resume Setup
            </button>
        );
    }

    const doneCount   = STEPS.filter(s => checked[s.id]).length;
    const required    = STEPS.filter(s => s.required);
    const optional    = STEPS.filter(s => !s.required);
    const reqDone     = required.every(s => checked[s.id]);

    return (
        <ModalShell accent="#a78bfa">
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Step 2 of 2</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 950, letterSpacing: '-0.02em', margin: 0, color: 'white' }}>
                        ✅ Setup Checklist
                    </h2>
                    <span style={{ fontSize: 12, fontWeight: 800, color: doneCount === STEPS.length ? '#10b981' : 'rgba(255,255,255,0.4)' }}>
                        {doneCount}/{STEPS.length}
                    </span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(doneCount / STEPS.length) * 100}%`, height: '100%', background: '#a78bfa', borderRadius: 2, transition: 'width 0.4s ease' }} />
                </div>
            </div>

            {/* Required steps */}
            <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Start Here
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {required.map(step => <StepRow key={step.id} step={step} checked={!!checked[step.id]} onToggle={toggleCheck} onGo={go} accent="#a78bfa" />)}
            </div>

            {/* Optional steps */}
            <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                When You're Ready
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {optional.map(step => <StepRow key={step.id} step={step} checked={!!checked[step.id]} onToggle={toggleCheck} onGo={go} accent="#a78bfa" />)}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onBack} style={{ flex: '0 0 auto', padding: '12px 20px', borderRadius: 12, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button onClick={onDone} style={{ flex: 1, padding: '12px', borderRadius: 12, background: reqDone ? '#10b981' : '#a78bfa', border: 'none', color: reqDone ? '#0f172a' : 'white', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
                    {reqDone ? '🎉 All set — go to the app' : "I'll finish setup later — take me in"}
                </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, margin: '10px 0 0' }}>
                You can reopen this guide from Settings → Ledger Control Center
            </p>
        </ModalShell>
    );
}

function StepRow({ step, checked, onToggle, onGo, accent }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: checked ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${checked ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: '13px 14px', opacity: checked ? 0.75 : 1 }}>
            <button onClick={() => onToggle(step.id)} style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 2, background: checked ? '#10b981' : 'rgba(255,255,255,0.06)', border: `2px solid ${checked ? '#10b981' : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 900, padding: 0 }}>
                {checked ? '✓' : ''}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'white', textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1, marginBottom: 2 }}>
                    {step.icon} {step.title}
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, lineHeight: 1.5 }}>{step.desc}</p>
                <button onClick={() => onGo(step.action.path)} style={{ fontSize: 11, fontWeight: 800, color: accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationColor: `${accent}55` }}>
                    {step.action.label} →
                </button>
            </div>
        </div>
    );
}

// ─── Main export ───────────────────────────────────────────────────────────
export default function OnboardingChecklist({ onDismiss }) {
    const [page, setPage] = useState(0);
    const [minimized, setMinimized] = useState(false);

    function dismiss() {
        localStorage.setItem(STORAGE_KEY, '1');
        onDismiss?.();
    }

    if (page === 0) return <PageWelcome onNext={() => setPage(1)} onSkip={dismiss} />;
    if (page === 1) return <PageDataImport onNext={() => setPage(2)} onBack={() => setPage(0)} onSkip={dismiss} />;
    return (
        <PageChecklist
            onDone={dismiss}
            onBack={() => setPage(1)}
            minimized={minimized}
            onMinimize={() => setMinimized(true)}
            onRestore={() => setMinimized(false)}
        />
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────
export function shouldShowOnboarding(settings) {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(STORAGE_KEY)) return false;
    return !settings?.business_name;
}
