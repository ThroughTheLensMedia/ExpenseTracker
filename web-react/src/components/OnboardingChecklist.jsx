import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../api';
import ModalShell from './ModalShell.jsx';
import { BarChart3, Bot, FileText, Landmark, Camera, Car, Building2, Download, Mail, CreditCard, BookOpen, Laptop, Target, FileSpreadsheet, ClipboardList } from 'lucide-react';

const STORAGE_KEY   = 'll_onboarding_dismissed_v2'; // bump version to re-show for all users
const CHECKED_KEY   = 'll_onboarding_checked';

// ─── Content ──────────────────────────────────────────────────────────────────
const FEATURES = [
    { icon: BarChart3, label: 'Transaction Ledger',  desc: 'Import & categorize every expense' },
    { icon: Bot,       label: 'AI Brain',            desc: 'Ask questions about your finances' },
    { icon: FileText,  label: 'Invoicing',           desc: 'Create & send professional invoices' },
    { icon: Landmark,  label: 'Bank Sync (Plaid)',   desc: 'Automatic live transaction import' },
    { icon: Camera,    label: 'Gear Depreciation',   desc: 'Track camera gear & write-offs' },
    { icon: Car,       label: 'Mileage Log',         desc: 'Auto A→B→A round-trip tracking' },
];

const STEPS = [
    {
        id: 'profile',
        icon: Building2,
        title: 'Set Up Your Profile',
        desc: 'Add your business name, logo, and tax entity. This populates your invoices and reports.',
        action: { label: 'Open Profile', path: '/StudioControlCenter?tab=profile' },
        required: true,
    },
    {
        id: 'import',
        icon: Download,
        title: 'Import Your Transactions',
        desc: 'Download a CSV from your bank and import it — or connect via Plaid for live automatic sync.',
        action: { label: 'Go to Bank Import', path: '/import' },
        required: true,
    },
    {
        id: 'receipts',
        icon: Mail,
        title: 'Set Up Receipt Forwarding',
        desc: 'Get your unique email address. Forward any receipt email to it and Lumière automatically parses and attaches it to the right transaction.',
        action: { label: 'Set Up in Integrations', path: '/StudioControlCenter?tab=integration' },
        required: false,
    },
    {
        id: 'ai',
        icon: Bot,
        title: 'Add Your Gemini API Key',
        desc: 'Get a free key at aistudio.google.com. Unlocks the AI Financial Assistant — ask anything about your business.',
        action: { label: 'Set Up AI', path: '/StudioControlCenter?tab=intelligence' },
        required: false,
    },
    {
        id: 'stripe',
        icon: CreditCard,
        title: 'Enable Online Invoice Payments',
        desc: 'Add your Stripe publishable key so clients can pay invoices by card. Free Stripe account — no monthly fee.',
        action: { label: 'Set Up Stripe', path: '/StudioControlCenter?tab=profile' },
        required: false,
    },
    {
        id: 'invoice',
        icon: FileText,
        title: 'Create Your First Invoice',
        desc: 'Send a professional invoice to a client. Your business profile info pre-fills automatically.',
        action: { label: 'Open Invoicing', path: '/crm/financials' },
        required: false,
    },
    {
        id: 'docs',
        icon: BookOpen,
        title: 'Explore the Help Center',
        desc: 'Tips on CSV import, tax categories, mileage tracking, and more.',
        action: { label: 'Open Help Center', path: '/StudioControlCenter?tab=help' },
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

// Shared modal shell lives in ./ModalShell.jsx (extracted v7.12.0)

// ─── Role presets ─────────────────────────────────────────────────────────
const ROLE_PRESETS = {
    photographer: { invoices: true, forecast: true, performance_chart: true, top_expenses: true, insights: true, operational_intelligence: true },
    freelancer:   { invoices: true, forecast: false, performance_chart: true, top_expenses: true, insights: true, operational_intelligence: false },
    small_business: { invoices: true, forecast: true, performance_chart: true, top_expenses: true, insights: true, operational_intelligence: true },
    personal:     { invoices: false, forecast: false, performance_chart: true, top_expenses: true, insights: true, operational_intelligence: false },
};

const ROLES = [
    { id: 'photographer', icon: Camera, label: 'Photographer', sub: 'Includes Videographers', accent: '#f97316' },
    { id: 'freelancer',   icon: Laptop, label: 'Freelancer',   sub: 'Consultants, designers, writers', accent: '#38bdf8' },
    { id: 'small_business', icon: Building2, label: 'Small Business', sub: 'Retail, services, agencies', accent: '#10b981' },
    { id: 'personal',     icon: Target, label: 'Personal / Side Hustle', sub: 'Simple income & expense tracking', accent: '#a78bfa' },
];

// ─── Page 1: Role Selector ─────────────────────────────────────────────────
function PageRoleSelector({ onNext, onBack, onSkip }) {
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);

    async function pick(roleId) {
        setSelected(roleId);
        setSaving(true);
        try {
            await apiPost('/settings', {
                dashboard_config: { role: roleId, widgets: ROLE_PRESETS[roleId] },
            });
        } catch {
            // non-blocking — dashboard defaults to all-on if save fails
        }
        setSaving(false);
        onNext();
    }

    return (
        <ModalShell accent="#a78bfa">
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Step 1 of 3</div>
                <h2 style={{ fontSize: 20, fontWeight: 950, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'white' }}>
                    What best describes you?
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
                    Personalizes your dashboard to show what matters most to you. You can change this any time.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {ROLES.map(role => (
                    <button
                        key={role.id}
                        onClick={() => pick(role.id)}
                        disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            background: selected === role.id ? `${role.accent}18` : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${selected === role.id ? `${role.accent}55` : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: 14, padding: '14px 18px', cursor: saving ? 'wait' : 'pointer',
                            textAlign: 'left', width: '100%', transition: 'all 0.15s',
                        }}
                    >
                        <role.icon size={24} style={{ flexShrink: 0, color: role.accent }} />
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: 'white', marginBottom: 2 }}>{role.label}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{role.sub}</div>
                        </div>
                        {selected === role.id && (
                            <span style={{ marginLeft: 'auto', fontSize: 16, color: role.accent }}>✓</span>
                        )}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onBack} style={{ flex: '0 0 auto', padding: '12px 20px', borderRadius: 12, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>← Back</button>
                <button onClick={onNext} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    Skip for now →
                </button>
            </div>
        </ModalShell>
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
                        <f.icon size={18} style={{ flexShrink: 0, color: 'var(--accent)', marginTop: 1 }} />
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
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Step 2 of 3</div>
                <h2 style={{ fontSize: 20, fontWeight: 950, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'white' }}>
                    Getting Your Transactions In
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
                    Lumière Ledger works best when your transactions are here. Two ways to do it —
                    and after each import, Lumière shows you your <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Money Story</strong>:
                    deductions found, subscriptions detected, and anything needing review.
                </p>
            </div>

            {/* Option A: CSV */}
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 16, padding: '18px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <FileSpreadsheet size={22} style={{ flexShrink: 0, color: '#38bdf8' }} />
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
                    <Landmark size={22} style={{ flexShrink: 0, color: '#10b981' }} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'white' }}>Live Bank Sync via Plaid <Pill color="#10b981">from $4.99/mo</Pill></div>
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
                <ClipboardList size={16} /> Resume Setup
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
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Step 3 of 3</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 950, letterSpacing: '-0.02em', margin: 0, color: 'white' }}>
                        Setup Checklist
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
                <div style={{ fontSize: 13, fontWeight: 900, color: 'white', textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <step.icon size={14} style={{ flexShrink: 0, color: accent }} /> {step.title}
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
export default function OnboardingChecklist({ onDismiss, initialPage = 0 }) {
    const [page, setPage] = useState(initialPage);
    const [minimized, setMinimized] = useState(false);

    function dismiss() {
        localStorage.setItem(STORAGE_KEY, '1');
        onDismiss?.();
    }

    if (page === 0) return <PageWelcome onNext={() => setPage(1)} onSkip={dismiss} />;
    if (page === 1) return <PageRoleSelector onNext={() => setPage(2)} onBack={() => setPage(0)} onSkip={() => setPage(2)} />;
    if (page === 2) return <PageDataImport onNext={() => setPage(3)} onBack={() => setPage(1)} onSkip={dismiss} />;
    return (
        <PageChecklist
            onDone={dismiss}
            onBack={() => setPage(2)}
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
