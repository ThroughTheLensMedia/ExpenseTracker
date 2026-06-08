import React, { useState } from 'react';
import { apiPost } from '../../api';

const DEFAULT_WIDGETS = {
    invoices: true,
    forecast: true,
    performance_chart: true,
    top_expenses: true,
    insights: true,
    operational_intelligence: true,
};

const WIDGET_LABELS = [
    { key: 'invoices',                label: 'Invoice & Receivables Health',  desc: 'Overdue invoices, unpaid pipeline, collection time' },
    { key: 'forecast',                label: 'Year-End Forecast',             desc: 'Projected revenue, expense, and net profit' },
    { key: 'performance_chart',       label: 'Monthly Performance Chart',     desc: 'Revenue vs expense bars by month' },
    { key: 'insights',                label: 'Financial Insights Strip',      desc: 'Margin quality, burn rate, cash reality, and more' },
    { key: 'top_expenses',            label: 'Top Expense Drivers',           desc: 'Ranked category spend breakdown' },
    { key: 'operational_intelligence',label: 'Operational Intelligence',      desc: 'Recurring subscriptions and vendor patterns' },
];

const ROLES = [
    { id: 'photographer',  icon: '📷', label: 'Photographer',          sub: 'Includes Videographers' },
    { id: 'freelancer',    icon: '💻', label: 'Freelancer',            sub: 'Consultants, designers, writers' },
    { id: 'small_business',icon: '🏢', label: 'Small Business',        sub: 'Retail, services, agencies' },
    { id: 'personal',      icon: '🎯', label: 'Personal / Side Hustle', sub: 'Simple income & expense tracking' },
];

const ROLE_PRESETS = {
    photographer:   { invoices: true,  forecast: true,  performance_chart: true, top_expenses: true, insights: true, operational_intelligence: true },
    freelancer:     { invoices: true,  forecast: false, performance_chart: true, top_expenses: true, insights: true, operational_intelligence: false },
    small_business: { invoices: true,  forecast: true,  performance_chart: true, top_expenses: true, insights: true, operational_intelligence: true },
    personal:       { invoices: false, forecast: false, performance_chart: true, top_expenses: true, insights: true, operational_intelligence: false },
};

export default function DashboardTab({ settings, setSettings }) {
    const config = settings?.dashboard_config || {};
    const [widgets, setWidgets] = useState({ ...DEFAULT_WIDGETS, ...(config.widgets || {}) });
    const [currentRole, setCurrentRole] = useState(config.role || null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [confirmRole, setConfirmRole] = useState(null);

    async function save(newWidgets, newRole) {
        setSaving(true);
        setSaved(false);
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
        } catch {} finally {
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
        <div style={{ maxWidth: 600, padding: '8px 0' }}>
            {/* Role Selector */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'white', marginBottom: 4 }}>Business Type</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 16 }}>
                    Sets default widget visibility. You can still override individual widgets below.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {ROLES.map(role => (
                        <button
                            key={role.id}
                            onClick={() => role.id !== currentRole && setConfirmRole(role.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                background: currentRole === role.id ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${currentRole === role.id ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                            }}
                        >
                            <span style={{ fontSize: 22, flexShrink: 0 }}>{role.icon}</span>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 900, color: currentRole === role.id ? '#f97316' : 'white' }}>{role.label}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginTop: 2 }}>{role.sub}</div>
                            </div>
                            {currentRole === role.id && <span style={{ marginLeft: 'auto', color: '#f97316', fontSize: 14 }}>✓</span>}
                        </button>
                    ))}
                </div>

                {/* Role change confirmation */}
                {confirmRole && (
                    <div style={{ marginTop: 12, padding: '14px 16px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'white', marginBottom: 8 }}>
                            Switch to {ROLES.find(r => r.id === confirmRole)?.label}? This will reset your widget preferences to the default for that role.
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => applyRole(confirmRole)} style={{ padding: '8px 16px', borderRadius: 8, background: '#f97316', border: 'none', color: 'white', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
                                Yes, switch
                            </button>
                            <button onClick={() => setConfirmRole(null)} style={{ padding: '8px 16px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Widget Toggles */}
            <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'white', marginBottom: 4 }}>Dashboard Sections</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 16 }}>
                    Toggle which sections appear on your dashboard. KPI tiles (Revenue, Expense, Profit) are always shown.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {WIDGET_LABELS.map(({ key, label, desc }) => (
                        <label
                            key={key}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.15s' }}
                        >
                            <input
                                type="checkbox"
                                checked={widgets[key] !== false}
                                onChange={() => toggleWidget(key)}
                                style={{ accentColor: '#f97316', width: 16, height: 16, flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: widgets[key] !== false ? 'white' : 'rgba(255,255,255,0.3)' }}>{label}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, marginTop: 2 }}>{desc}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: widgets[key] !== false ? '#4ade80' : 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
                                {widgets[key] !== false ? 'ON' : 'OFF'}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Save status */}
            <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: saved ? '#4ade80' : 'transparent', transition: 'color 0.3s' }}>
                ✓ Saved
            </div>
        </div>
    );
}
