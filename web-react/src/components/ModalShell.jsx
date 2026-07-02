import React from 'react';

// Shared rich-content modal shell — used by OnboardingChecklist and MoneyStoryModal.
export default function ModalShell({ children, accent = '#f97316' }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: `1px solid ${accent}33`, borderRadius: 24, padding: '36px 32px', maxWidth: 560, width: '100%', boxShadow: `0 0 80px ${accent}18`, maxHeight: '90vh', overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
}
