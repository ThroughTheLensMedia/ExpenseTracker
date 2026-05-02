import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Terms() {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', color: 'white', lineHeight: '1.6' }}>
      <NavLink to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 800, fontSize: '14px' }}>← BACK TO STUDIO LOGIN</NavLink>
      
      <div style={{ marginTop: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 950, marginBottom: '10px' }}>Terms of Service</h1>
        <p className="muted" style={{ fontWeight: 600 }}>Last Updated: March 16, 2026</p>
      </div>

      <section style={{ marginTop: '40px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Acceptance of Terms</h2>
        <p>By accessing or using Lumière Ledger, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Accounts and Access</h2>
        <p>Lumière Ledger is a professional SaaS tool. Access is granted via invitation codes or paid subscriptions. You are responsible for maintaining the confidentiality of your account credentials.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. Gemini API Keys</h2>
        <p>This service utilizes a "Bring Your Own Key" model. You must provide a valid Google Gemini API Key. This key is stored securely and used exclusively within your session to process your data. We do not use your key for any other users or internal tasks.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>4. Data Ownership</h2>
        <p>You retain full ownership of all financial data, leads, and assets entered into Lumière Ledger. We provide the platform to process and visualize this data, but we do not claim ownership of it.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>5. Acceptable Use</h2>
        <p>You agree not to use Lumière Ledger for any illegal activities, including financial fraud. Any misuse of the platform may result in immediate suspension or revocation of your access.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>6. Limitation of Liability</h2>
        <p>Lumière Ledger is a tool for financial organization. While we strive for 100% accuracy, we are not responsible for tax filing errors, missing data, or financial decisions made based on the app's output. Consult with a qualified tax professional for official filings.</p>
      </section>

      <section style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>7. Termination</h2>
        <p>We reserve the right to terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
      </section>

      <div className="muted" style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', textAlign: 'center' }}>
        LUMIÈRE LEDGER © 2026 • ELITE FINANCIAL INTELLIGENCE
      </div>
    </div>
  );
}
