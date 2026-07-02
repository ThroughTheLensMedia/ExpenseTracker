import React from 'react';
import { PartyPopper } from 'lucide-react';
import { formatMoney } from '../api';
import ModalShell from './ModalShell.jsx';

// Fires once, the moment a photographer's first-ever invoice gets marked paid.
export default function InvoicePaidCelebration({ clientName, totalCents, onClose }) {
    return (
        <ModalShell accent="#4ade80">
            <div style={{ textAlign: 'center' }}>
                <PartyPopper size={40} style={{ color: '#4ade80', marginBottom: 14 }} />
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', color: 'white' }}>Your First Paid Invoice!</h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 600, lineHeight: 1.6, margin: '0 0 22px' }}>
                    <span className="money amt-income" style={{ fontWeight: 900 }}>{formatMoney(totalCents)}</span> from {clientName} just landed in your ledger. Here's to many more.
                </p>
                <button onClick={onClose} className="btn" style={{ width: '100%', padding: '13px', fontSize: 14 }}>
                    Nice — back to my ledger
                </button>
            </div>
        </ModalShell>
    );
}
