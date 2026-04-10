import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { useNavigate, NavLink } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const { login, signup, loginWithGoogle, supabase: supabaseClient } = useAuth();
  // Auto-fill from URL
  const params = new URLSearchParams(window.location.search);
  const [isLogin, setIsLogin] = useState(!params.get('code'));
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  
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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      const { error: resetErr } = await sb.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/login`
      });
      if (resetErr) throw resetErr;
      setForgotSent(true);
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
          <img src="/icon.png" alt="Studio Tracker Icon" style={{ height: '120px', marginBottom: '20px', borderRadius: '24px', filter: 'drop-shadow(0 0 20px rgba(249, 115, 22, 0.2))' }} />
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 900, 
            margin: 0,
            color: 'white',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>Studio Tracker</h1>
          <p className="muted" style={{ marginTop: '8px', fontWeight: 600 }}>Financial Intelligence for Today's Photographer</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'left' }}>
            <label className="muted" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value.trim())} 
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
            style={{ padding: '16px', fontSize: '16px', marginTop: '10px', borderRadius: '12px' }}
            disabled={loading}
          >
            {loading ? 'PROCESSING...' : isLogin ? 'ENTER THE STUDIO' : 'CREATE STUDIO ACCOUNT'}
          </button>

          {isLogin && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', margin: '10px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                <span className="muted" style={{ fontSize: '10px', fontWeight: 900 }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              </div>

              <button 
                type="button" 
                onClick={async () => {
                  try {
                    setLoading(true);
                    await loginWithGoogle();
                  } catch (e) {
                    setError(e.message);
                    setLoading(false);
                  }
                }}
                className="btn secondary" 
                style={{ 
                  padding: '16px', 
                  fontSize: '14px', 
                  borderRadius: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
                disabled={loading}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
                CONTINUE WITH GOOGLE
              </button>
            </>
          )}
        </form>

        {/* Forgot Password link — only shown on login mode */}
        {isLogin && !showForgot && (
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 800 }}
            >
              {isLogin ? "Need a studio account? Sign Up" : "Already have an account? Login"}
            </button>
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={() => { setShowForgot(true); setError(null); setForgotEmail(email); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
              >
                Forgot your password?
              </button>
            </div>
          </div>
        )}

        {/* Forgot Password Form */}
        {showForgot && (
          <div style={{ marginTop: '20px', animation: 'fadeIn 0.3s ease-out' }}>
            {!forgotSent ? (
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ textAlign: 'left' }}>
                  <label className="muted" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reset Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder=" Your studio email"
                    style={{ marginTop: '8px', width: '100%' }}
                    required
                  />
                </div>
                {error && <div className="tag bad" style={{ padding: '10px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
                <button type="submit" className="btn primary" style={{ padding: '14px' }} disabled={loading}>
                  {loading ? 'SENDING...' : 'SEND RESET LINK'}
                </button>
                <button type="button" onClick={() => { setShowForgot(false); setError(null); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                  ← Back to login
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📬</div>
                <div style={{ fontWeight: 800, marginBottom: '8px', color: '#4ade80' }}>Reset link sent!</div>
                <div className="muted small">Check your inbox for a password reset email. It may take a minute.</div>
                <button onClick={() => { setShowForgot(false); setForgotSent(false); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 800, marginTop: '16px' }}>
                  ← Back to login
                </button>
              </div>
            )}
          </div>
        )}

        {!isLogin && !showForgot && (
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => setIsLogin(true)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 800 }}
            >
              Already have an account? Login
            </button>
          </div>
        )}

        <div className="muted" style={{ marginTop: '40px', fontSize: '10px', fontWeight: 900, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '15px' }}>
            <NavLink to="/privacy" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', letterSpacing: '0.05em', fontWeight: 900 }}>PRIVACY POLICY</NavLink>
            <NavLink to="/terms" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', letterSpacing: '0.05em', fontWeight: 900 }}>TERMS OF SERVICE</NavLink>
          </div>
          SECURE ENCRYPTED SESSION • STUDIO TRACKER © 2026 • PROFESSIONAL EDITION
        </div>
      </div>
    </div>
  );
}
