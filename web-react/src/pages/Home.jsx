import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px'
    }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', maxWidth: '800px', marginTop: '60px' }}>
        <img 
          src="/icon.png" 
          alt="Studio Tracker Logo" 
          width="140"
          height="140"
          style={{ 
            marginBottom: '30px', 
            borderRadius: '32px', 
            filter: 'drop-shadow(0 0 30px rgba(249, 115, 22, 0.3))' 
          }} 
        />
        
        <h1 style={{ 
          fontSize: 'clamp(2.5rem, 8vw, 3.5rem)', 
          fontWeight: 950, 
          letterSpacing: '-0.04em', 
          marginBottom: '20px',
          lineHeight: 1.1
        }}>
          Financial Intelligence for <span style={{ color: 'var(--accent)' }}>Today's Photographer</span>
        </h1>
        
        <p style={{ 
          fontSize: '1.2rem', 
          color: '#94a3b8', 
          lineHeight: '1.6', 
          maxWidth: '600px', 
          margin: '0 auto 40px auto',
          fontWeight: 500
        }}>
          Studio Tracker is the elite command center for photographers. 
          Automate your tax data, manage gear assets, and monitor your business health with precision.
        </p>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <NavLink to="/login" className="btn primary glow-orange" style={{ 
            padding: '18px 40px', 
            fontSize: '18px', 
            borderRadius: '16px',
            textDecoration: 'none'
          }}>
            ENTER THE STUDIO
          </NavLink>
        </div>
      </div>

      {/* Feature Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px', 
        maxWidth: '1000px', 
        width: '100%',
        marginTop: '80px'
      }}>
        <div className="card glass" style={{ padding: '30px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '15px' }}>📊</div>
          <h3 style={{ fontWeight: 800, marginBottom: '10px' }}>Real-time Analytics</h3>
          <p className="muted" style={{ fontSize: '14px' }}>Track Gross Yield, Net Income, and Profit Margins with automated visual intelligence.</p>
        </div>
        <div className="card glass" style={{ padding: '30px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '15px' }}>⚖️</div>
          <h3 style={{ fontWeight: 800, marginBottom: '10px' }}>Tax Optimization</h3>
          <p className="muted" style={{ fontSize: '14px' }}>Automated Schedule C categories and mileage tracking designed specifically for photographers.</p>
        </div>
        <div className="card glass" style={{ padding: '30px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '15px' }}>📸</div>
          <h3 style={{ fontWeight: 800, marginBottom: '10px' }}>Asset Command</h3>
          <p className="muted" style={{ fontSize: '14px' }}>Manage camera gear value, depreciation and equipment insurance data in one place.</p>
        </div>
      </div>

      <footer style={{ marginTop: 'auto', paddingTop: '100px', paddingBottom: '60px', display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '25px', justifyContent: 'center' }}>
            <NavLink to="/privacy" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>PRIVACY POLICY</NavLink>
            <NavLink to="/terms" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>TERMS OF SERVICE</NavLink>
          </div>
          <div className="muted" style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.15em', opacity: 0.6, textAlign: 'center' }}>
            STUDIO TRACKER © 2026 • PROFESSIONAL EDITION
          </div>
        </div>
      </footer>
    </div>
  );
}
