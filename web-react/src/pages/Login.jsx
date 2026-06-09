import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { useNavigate, NavLink } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const { login, signup, loginWithGoogle, supabase: supabaseClient } = useAuth();
  const params = new URLSearchParams(window.location.search);

  // If a code is in the URL, start in signup/code mode immediately
  const prefillCode = params.get('code') || '';
  const [isLogin, setIsLogin] = useState(!prefillCode);
  const [useInviteCode, setUseInviteCode] = useState(!!prefillCode);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [betaCode, setBetaCode] = useState(prefillCode);

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
        if (!confirmPassword) throw new Error("Please confirm your password.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");

        // If user entered an invite code, validate it server-side before creating account
        if (useInviteCode) {
          if (!betaCode) throw new Error("Please enter your invite code, or sign up free without one.");
          const vRes = await fetch(`/api/subscription/validate-code/${betaCode.trim().toUpperCase()}`);
          const vData = await vRes.json();
          if (!vData.valid) throw new Error(`Invite code: ${vData.reason}`);
          // Store for auto-redeem after email confirmation + login
          localStorage.setItem('lumiere_pending_code', JSON.stringify({ code: betaCode.trim().toUpperCase(), email: email.trim() }));
        }

        await signup(email, password);
        setSuccess("Account created! A confirmation email is on its way from support@throughthelens.media — check your inbox and spam folder. Click the confirmation link, then return here to log in.");
        setIsLogin(true);
      }
    } catch (err) {
      // If signup failed after we stashed the code, remove the stash
      if (!isLogin) localStorage.removeItem('lumiere_pending_code');
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

  const switchToSignup = (withCode = false) => {
    setIsLogin(false);
    setUseInviteCode(withCode);
    if (!withCode) setBetaCode('');
    setError(null);
    setSuccess(null);
    setShowRequestForm(false);
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
          <img src="/icon.png" alt="Lumière Ledger Icon" style={{ height: '120px', marginBottom: '20px', borderRadius: '24px', filter: 'drop-shadow(0 0 20px rgba(249, 115, 22, 0.2))' }} />
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            margin: 0,
            color: 'white',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>Lumière Ledger</h1>
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

          {/* Invite code field — only shown in signup + invite-code mode */}
          {!isLogin && useInviteCode && (
            <div style={{ textAlign: 'left' }}>
              <label className="muted" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)' }}>Invite Code</label>
              <input
                type="text"
                value={betaCode}
                onChange={(e) => setBetaCode(e.target.value.toUpperCase())}
                placeholder=" ENTER YOUR 8-DIGIT CODE"
                style={{ marginTop: '8px', width: '100%', borderColor: 'var(--accent)', fontWeight: 900, letterSpacing: '0.1em' }}
                required
              />
              <div className="muted small" style={{ marginTop: '8px', fontSize: '10px' }}>Check your invitation email for your code.</div>
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

          {!isLogin && (
            <div style={{ textAlign: 'left' }}>
              <label className="muted" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder=" •••••••••••"
                style={{
                  marginTop: '8px', width: '100%',
                  borderColor: confirmPassword && password !== confirmPassword ? '#ef4444' : undefined
                }}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>
                  Passwords do not match
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="tag bad" style={{ padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="tag ok" style={{ padding: '14px 16px', borderRadius: '10px', fontSize: '13px', background: 'rgba(74, 222, 128, 0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', lineHeight: 1.55, textAlign: 'left', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn primary glow-orange"
            style={{ padding: '16px', fontSize: '16px', marginTop: '10px', borderRadius: '12px' }}
            disabled={loading}
          >
            {loading ? 'PROCESSING...' : isLogin ? 'ENTER LUMIÈRE' : useInviteCode ? 'ACTIVATE & CREATE ACCOUNT' : 'CREATE FREE ACCOUNT'}
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

        {/* Bottom links — login mode */}
        {isLogin && !showForgot && !showRequestForm && (
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => { setShowForgot(true); setError(null); setForgotEmail(email); }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
            >
              Forgot your password?
            </button>
            <button
              onClick={() => switchToSignup(false)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 800 }}
            >
              Create a Free Account
            </button>
            <button
              onClick={() => switchToSignup(true)}
              style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '13px', fontWeight: 800 }}
            >
              Have an invite code? Sign Up
            </button>
            <button
              onClick={() => setShowRequestForm(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
            >
              Request access
            </button>
          </div>
        )}

        {/* Account Request Form */}
        {showRequestForm && !requestSent && (
          <div style={{ marginTop: '20px', animation: 'fadeIn 0.3s ease-out' }}>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              setError(null);
              try {
                const res = await fetch('/api/account-request', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: requestName, email: requestEmail })
                });
                if (!res.ok) throw new Error('Request failed. Please try again.');
                setRequestSent(true);
              } catch (err) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'left' }}>
                <label className="muted" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
                <input
                  type="text"
                  value={requestName}
                  onChange={e => setRequestName(e.target.value)}
                  placeholder="John Smith"
                  style={{ marginTop: '8px', width: '100%' }}
                  required
                />
              </div>
              <div style={{ textAlign: 'left' }}>
                <label className="muted" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                <input
                  type="email"
                  value={requestEmail}
                  onChange={e => setRequestEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ marginTop: '8px', width: '100%' }}
                  required
                />
              </div>
              {error && <div className="tag bad" style={{ padding: '10px', borderRadius: '8px', fontSize: '12px' }}>{error}</div>}
              <button type="submit" className="btn primary glow-orange" style={{ padding: '14px', borderRadius: '12px' }} disabled={loading}>
                {loading ? 'SENDING...' : 'REQUEST ACCESS'}
              </button>
              <button type="button" onClick={() => { setShowRequestForm(false); setError(null); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                ← Back to login
              </button>
            </form>
          </div>
        )}

        {showRequestForm && requestSent && (
          <div style={{ marginTop: '20px', textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>✉️</div>
            <div style={{ fontWeight: 800, marginBottom: '8px', color: '#4ade80' }}>Request Sent!</div>
            <div className="muted small">We'll review your request and send you an invite code shortly.</div>
            <button onClick={() => { setShowRequestForm(false); setRequestSent(false); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 800, marginTop: '16px' }}>
              ← Back to login
            </button>
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

        {/* Signup mode — bottom nav */}
        {!isLogin && !showForgot && (
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {useInviteCode ? (
              <button
                onClick={() => { setUseInviteCode(false); setBetaCode(''); setError(null); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
              >
                No code? Sign up free instead
              </button>
            ) : (
              <button
                onClick={() => { setUseInviteCode(true); setError(null); }}
                style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '13px', fontWeight: 800 }}
              >
                Have an invite code? Use it here
              </button>
            )}
            <button
              onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
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
          SECURE ENCRYPTED SESSION • LUMIÈRE LEDGER © 2026 • PROFESSIONAL EDITION
        </div>
      </div>
    </div>
  );
}
