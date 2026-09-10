import React, { useState } from 'react';
import { apiPost } from '../../api';

const DEFAULT_WIDGETS = {
    invoices: true,
    forecast: true,
    performance_chart: true,
    top_expenses: true,
    insights: true,
    operational_intelligence: true,
    tax_set_aside: true,
    subscriptions_radar: true,
};

const WIDGET_LABELS = [
    { key: 'invoices',                label: 'Invoice & Receivables Health',  desc: 'Overdue invoices, unpaid pipeline, collection time' },
    { key: 'forecast',                label: 'Year-End Forecast',             desc: 'Projected revenue, expense, and net profit' },
    { key: 'performance_chart',       label: 'Monthly Performance Chart',     desc: 'Revenue vs expense bars by month' },
    { key: 'insights',                label: 'Financial Insights Strip',      desc: 'Margin quality, burn rate, cash reality, and more' },
    { key: 'top_expenses',            label: 'Top Expense Drivers',           desc: 'Ranked category spend breakdown' },
    { key: 'operational_intelligence',label: 'Operational Intelligence',      desc: 'Recurring subscriptions and vendor patterns' },
    { key: 'tax_set_aside',           label: 'Quarterly Tax Set-Aside',       desc: 'Estimated tax to set aside based on YTD net profit' },
    { key: 'subscriptions_radar',     label: 'Subscriptions Radar',          desc: '"$X/mo across N subscriptions" quick summary' },
];

const ROLES = [
    { id: 'photographer',  icon: '📷', label: 'Photographer',          sub: 'Includes Videographers' },
    { id: 'freelancer',    icon: '💻', label: 'Freelancer',            sub: 'Consultants, designers, writers' },
    { id: 'small_business',icon: '🏢', label: 'Small Business',        sub: 'Retail, services, agencies' },
    { id: 'personal',      icon: '🎯', label: 'Personal / Side Hustle', sub: 'Simple income & expense tracking' },
];

const ROLE_PRESETS = {
    photographer:   { invoices: true,  forecast: true,  performance_chart: true, top_expenses: true, insights: true, operational_intelligence: true,  tax_set_aside: true,  subscriptions_radar: true },
    freelancer:     { invoices: true,  forecast: false, performance_chart: true, top_expenses: true, insights: true, operational_intelligence: false, tax_set_aside: true,  subscriptions_radar: true },
    small_business: { invoices: true,  forecast: true,  performance_chart: true, top_expenses: true, insights: true, operational_intelligence: true,  tax_set_aside: true,  subscriptions_radar: true },
    personal:       { invoices: false, forecast: false, performance_chart: true, top_expenses: true, insights: true, operational_intelligence: false, tax_set_aside: false, subscriptions_radar: true },
};

export default function DashboardTab({ settings, setSettings }) {
    const config = settings?.dashboard_config || {};
    const [widgets, setWidgets] = useState({ ...DEFAULT_WIDGETS, ...(config.widgets || {}) });
    const [currentRole, setCurrentRole] = useState(config.role || null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [confirmRole, setConfirmRole] = useState(null);

    async function save(newWidgets, newRole) {
        setSaving(true);
        setSaved(false);
        setSaveError('');
        try {
            const updated = await apiPost('/settings', {
                dashboard_config: {
                    ...config,
                    role: newRole ?? currentRole,
                    widgets: newWidgets,
                },
            });
            setSettings?.(s => ({ ...s, dashboard_config: updated?.dashboard_config }));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            setSaveError(error?.message || 'Dashboard preferences could not be saved.');
        } finally {
            setSaving(false);
        }
    }

    function toggleWidget(key) {
        const next = { ...widgets, [key]: !widgets[key] };
        setWidgets(next);
        save(next, null);
    }

    function applyRole(roleId) {
        const preset = ROLE_PRESETS[roleId];
        setWidgets(preset);
        setCurrentRole(roleId);
        setConfirmRole(null);
        save(preset, roleId);
    }

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            {/* Role Selector */}
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="dashboard-role-heading">
                <div style={{ maxWidth: 720, marginBottom: 18 }}>
                    <h2 id="dashboard-role-heading" style={{ margin: 0, fontSize: 20 }}>Choose your business type</h2>
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>
                        Start with a recommended dashboard layout. You can adjust individual sections below at any time.
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
                    {ROLES.map(role => (
                        <button
                            key={role.id}
                            type="button"
                            aria-pressed={currentRole === role.id}
                            onClick={() => role.id !== currentRole && setConfirmRole(role.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                minHeight: 72,
                                background: currentRole === role.id ? 'rgba(76,125,255,.14)' : 'rgba(255,255,255,.03)',
                                border: `1px solid ${currentRole === role.id ? 'var(--accent)' : 'var(--line)'}`,
                                borderRadius: 12, padding: '12px 14px', color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
                            }}
                        >
                            <span aria-hidden="true" style={{ fontSize: 22, flexShrink: 0 }}>{role.icon}</span>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 850 }}>{role.label}</div>
                                <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{role.sub}</div>
                            </div>
                            {currentRole === role.id && <span aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 14 }}>✓</span>}
                        </button>
                    ))}
                </div>

                {/* Role change confirmation */}
                {confirmRole && (
                    <div role="alert" style={{ marginTop: 14, padding: 16, background: 'rgba(76,125,255,.08)', border: '1px solid rgba(76,125,255,.25)', borderRadius: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                            Switch to {ROLES.find(r => r.id === confirmRole)?.label}? This will reset your widget preferences to the default for that role.
                        </div>
                        <div className="controls" style={{ alignItems: 'center' }}>
                            <button type="button" className="btn" onClick={() => applyRole(confirmRole)}>
                                Apply recommended layout
                            </button>
                            <button type="button" className="btn secondary" onClick={() => setConfirmRole(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Widget Toggles */}
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="dashboard-sections-heading">
                <div style={{ maxWidth: 720, marginBottom: 18 }}>
                    <h2 id="dashboard-sections-heading" style={{ margin: 0, fontSize: 20 }}>Choose dashboard sections</h2>
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>
                        Show the information you use most. Revenue, expenses, and profit remain visible in every layout.
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 10 }}>
                    {WIDGET_LABELS.map(({ key, label, desc }) => (
                        <label
                            key={key}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 72, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid var(--line)', cursor: 'pointer' }}
                        >
                            <input
                                type="checkbox"
                                checked={widgets[key] !== false}
                                onChange={() => toggleWidget(key)}
                                disabled={saving}
                                style={{ accentColor: 'var(--accent)', width: 18, height: 18, flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: widgets[key] !== false ? 'var(--text)' : 'var(--muted)' }}>{label}</div>
                                <div className="muted" style={{ fontSize: 12, lineHeight: 1.4, marginTop: 3 }}>{desc}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: widgets[key] !== false ? 'var(--ok)' : 'var(--muted)', flexShrink: 0 }}>
                                {widgets[key] !== false ? 'Shown' : 'Hidden'}
                            </span>
                        </label>
                    ))}
                </div>
            </section>

            {/* Save status */}
            <div role="status" aria-live="polite" style={{ minHeight: 20, fontSize: 13, fontWeight: 700, color: saveError ? 'var(--bad)' : saved ? 'var(--ok)' : 'transparent' }}>
                {saveError || (saved ? 'Dashboard preferences saved.' : '')}
            </div>
        </div>
    );
}
