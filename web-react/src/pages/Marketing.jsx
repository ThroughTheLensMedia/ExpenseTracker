import React from 'react';
import { NavLink } from 'react-router-dom';

const Marketing = () => {
  return (
    <div className="marketing-container" style={{ color: 'white', padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Hero Section */}
      <section className="hero" style={{ textAlign: 'center', marginBottom: '80px', padding: '60px 20px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '24px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '20px', background: 'linear-gradient(to right, #60a5fa, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Built for Creatives. <br /> Perfected for Photographers.
        </h1>
        <p style={{ fontSize: '1.25rem', opacity: 0.8, maxWidth: '700px', margin: '0 auto 40px', lineHeight: '1.6' }}>
          Stop wrestling with generic accounting software. The Studio Tracker is the lightning-fast, Rocket Money-integrated dashboard designed to turn your passion into a profitable, audit-proof business.
        </p>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <NavLink to="/import" className="btn primary" style={{ padding: '15px 40px', fontSize: '18px', borderRadius: '12px' }}>Start Your 2026 Sync</NavLink>
          <button className="btn secondary" style={{ padding: '15px 40px', fontSize: '18px', borderRadius: '12px' }}>Watch the Demo</button>
        </div>
      </section>

      <div style={{ textAlign: 'center', marginBottom: '80px' }}>
        <img src="/marketing/features.png" alt="Features" style={{ maxWidth: '800px', width: '100%', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }} />
      </div>

      {/* Feature Grid with Assets */}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px', marginBottom: '80px' }}>
        <div className="glass" style={{ padding: '30px', borderRadius: '20px', transition: 'transform 0.3s ease' }}>
          <div style={{ fontSize: '40px', marginBottom: '20px' }}>📸</div>
          <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '15px' }}>Equipment Depreciation</h3>
          <p style={{ opacity: 0.7, lineHeight: '1.6' }}>That $3,000 Sony body just became your best tax deduction. Our automated equipment tracker handles the math so you keep more of your hard-earned cash.</p>
        </div>
        
        <div className="glass" style={{ padding: '30px', borderRadius: '20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '20px' }}>🚗</div>
          <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '15px' }}>Automatic Mileage</h3>
          <p style={{ opacity: 0.7, lineHeight: '1.6' }}>Log every trip to the studio or location shoot. We pull live IRS rates directly from IRS.gov to ensure you're getting every cent of your 72¢ per mile.</p>
        </div>


        <div className="glass" style={{ padding: '30px', borderRadius: '20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '20px' }}>🏦</div>
          <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '15px' }}>Rocket Money Sync</h3>
          <p style={{ opacity: 0.7, lineHeight: '1.6' }}>The magic bridge. Import your CSV and we'll auto-sort your business expenses while ignoring your personal groceries. Five minutes, total.</p>
        </div>
      </div>

      {/* Social Proof / Visual Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '60px', marginBottom: '80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '20px' }}>Audit-Proof Your Projects.</h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.7, lineHeight: '1.8', marginBottom: '30px' }}>
              IRS rules require receipts for expenses over $75. Our "Needed" badges highlight exactly where you're vulnerable. Attach a photo, save the record, and breathe easy.
            </p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#10b981' }}>✔</span> Accountant-ready CSV exports
              </li>
              <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#10b981' }}>✔</span> Section 179 Depreciation logic
              </li>
              <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#10b981' }}>✔</span> Real-time Schedule C snapshots
              </li>
            </ul>
          </div>
          <div className="glass" style={{ padding: '10px', borderRadius: '24px', overflow: 'hidden' }}>
            <img 
               src="/marketing/workspace.png" 
               alt="Photographer Workspace" 
               style={{ width: '100%', borderRadius: '14px', display: 'block' }} 
            />
          </div>

        </div>
      </section>

      {/* CTA Bottom */}
      <section style={{ textAlign: 'center', padding: '80px 20px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '20px' }}>Ready to Scale Your Studio?</h2>
        <p style={{ marginBottom: '40px', opacity: 0.7 }}>Stop guessing your numbers and start knowing your worth.</p>
        <NavLink to="/login" className="btn primary" style={{ padding: '18px 60px', fontSize: '20px', borderRadius: '16px', fontWeight: 800 }}>Start Tracking Now</NavLink>
      </section>
    </div>
  );
};

export default Marketing;
