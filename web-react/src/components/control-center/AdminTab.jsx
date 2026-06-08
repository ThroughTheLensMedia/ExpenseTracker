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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Internal sub-nav */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: '4px' }}>Admin</span>
                {SECTIONS.map(s => (
                    <button
                        key={s.key}
                        onClick={() => setSection(s.key)}
                        style={{
                            padding: '5px 14px',
                            borderRadius: '8px',
                            border: section === s.key ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(255,255,255,0.1)',
                            background: section === s.key ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                            color: section === s.key ? '#f97316' : 'rgba(255,255,255,0.5)',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Content */}
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
    );
}
