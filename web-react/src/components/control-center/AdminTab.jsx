// AdminTab.jsx — Consolidated admin panel: SaaS Management, System Logs, Security Review
import React, { useState } from 'react';
import SaasTab from './SaasTab.jsx';
import SystemLogsTab from './SystemLogsTab.jsx';
import SecurityReviewTab from './SecurityReviewTab.jsx';

const SECTIONS = [
    { key: 'saas',     label: 'SaaS Management' },
    { key: 'logs',     label: 'System Logs' },
    { key: 'security', label: 'Security' },
];

export default function AdminTab({ user, allSubscriptions, betaCodes, dailyStats, statusMsg, onReload, initialSection }) {
    const [section, setSection] = useState(initialSection || 'saas');

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            {/* Internal sub-nav */}
            <section className="card glass" style={{ margin: 0, padding: 'clamp(16px, 3vw, 24px)' }} aria-labelledby="admin-tools-heading">
                <div style={{ maxWidth: 760, marginBottom: 16 }}>
                    <h2 id="admin-tools-heading" style={{ margin: 0, fontSize: 20 }}>Administration tools</h2>
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55 }}>
                        Manage members and access, inspect system activity, and review security controls.
                    </p>
                </div>
                <div role="tablist" aria-label="Administration sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {SECTIONS.map(s => {
                        const selected = section === s.key;
                        return (
                            <button
                                key={s.key}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                onClick={() => setSection(s.key)}
                                className={`btn sm ${selected ? 'primary' : 'secondary'}`}
                                style={{ minHeight: 38 }}
                            >
                                {s.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Content */}
            <div role="tabpanel">
                {section === 'saas' && (
                    <SaasTab
                        user={user}
                        allSubscriptions={allSubscriptions}
                        betaCodes={betaCodes}
                        dailyStats={dailyStats}
                        statusMsg={statusMsg}
                        onReload={onReload}
                    />
                )}
                {section === 'logs' && <SystemLogsTab />}
                {section === 'security' && <SecurityReviewTab />}
            </div>
        </div>
    );
}
