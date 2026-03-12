import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  // Auto-fill from URL
  const params = new URLSearchParams(window.location.search);
  
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [betaCode, setBetaCode] = useState(params.get('code') || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isLogin) {
        await login(email, password);
        navigate('/');
      } else {
        if (!betaCode) throw new Error("A valid Beta Code is required to create an account.");
        await signup(email, password);
        setSuccess("Studio account created! Check your email to confirm, then use your code to activate.");
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
      padding: '20px'
    }}>
      <div className="card glass glow-blue" style={{ 
        maxWidth: '450px', 
        width: '100%', 
        padding: '50px 40px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ 
            fontSize: '2.4rem', 
            fontWeight: 950, 
            margin: 0,
            background: 'linear-gradient(90deg, #fff, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Studio {isLogin ? 'Access' : 'Onboarding'}</h1>
          <p className="muted" style={{ marginTop: '8px', fontWeight: 600 }}>Expense Tracker & CRM • Elite v3</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'left' }}>
            <label className="muted" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder=" Joshua@studio.com"
              style={{ marginTop: '8px', width: '100%' }}
              required
            />
          </div>

          {!isLogin && (
            <div style={{ textAlign: 'left' }}>
              <label className="muted" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)' }}>Studio Invite Code</label>
              <input 
                type="text" 
                value={betaCode} 
                onChange={(e) => setBetaCode(e.target.value.toUpperCase())} 
                placeholder=" ENTER YOUR 8-DIGIT CODE"
                style={{ marginTop: '8px', width: '100%', borderColor: 'var(--accent)', fontWeight: 900, letterSpacing: '0.1em' }}
                required
              />
              <div className="muted small" style={{ marginTop: '8px', fontSize: '10px' }}>Exclusive access code required. Check your invitation email.</div>
            </div>
          )}

          <div style={{ textAlign: 'left' }}>
            <label className="muted" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder=" •••••••••••"
              style={{ marginTop: '8px', width: '100%' }}
              required
            />
          </div>

          {error && (
            <div className="tag bad" style={{ padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="tag ok" style={{ padding: '12px', borderRadius: '8px', fontSize: '13px', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80' }}>
              {success}
            </div>
          )}

          <button 
            type="submit" 
            className="btn primary glow-orange" 
            style={{ padding: '16px', fontSize: '16px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'PROCESSING...' : isLogin ? 'ENTER THE STUDIO' : 'CREATE STUDIO ACCOUNT'}
          </button>
        </form>

        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 800 }}
          >
            {isLogin ? "Need a studio account? Sign Up" : "Already have an account? Login"}
          </button>
        </div>

        <div className="muted" style={{ marginTop: '40px', fontSize: '11px', fontWeight: 800 }}>
          SECURE ENCRYPTED SESSION • STUDIO TRACKER © 2026
        </div>
      </div>
    </div>
  );
}
