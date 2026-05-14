import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing! Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel.");
}

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'lumiere-ledger-auth',
      }
    })
  : null;

// Export so hooks (e.g. useLeadsRealtime) can subscribe to Realtime without creating a second client
export { supabase };

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async (userId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Authorization': `Bearer ${session?.access_token}` };
      
      const [subRes, setRes] = await Promise.all([
        fetch('/api/subscription/status', { headers }),
        fetch('/api/settings', { headers })
      ]);

      if (subRes.ok) {
        const data = await subRes.json();
        setSubscription(data);
      }
      if (setRes.ok) {
        const data = await setRes.json();
        setSettings(data);
      }
    } catch (e) {
      console.error("Failed to fetch profile data:", e);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 0. Developer Bypass (Safe for Localhost)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // SECURITY: Use localStorage only — query params appear in browser history and shared links.
    const hasDevBypass = localStorage.getItem('studio_tracker_dev_mode') === 'true';

    if (isLocal && hasDevBypass) {
        console.warn("[AUTH] Developer Bypass Enabled");
        const mockUser = { id: 'f129a00b-333e-4d43-98b7-08ca1161d765', email: 'joshua.deuermeyer@gmail.com' };
        setSession({ access_token: 'mock-session', user: mockUser });
        setUser(mockUser);
        fetchSubscription(mockUser.id);
        setLoading(false);
        return;
    }

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        fetchSubscription(session.user.id);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Session check failed:", err);
      setLoading(false);
    });

    // 2. Auth State Listener
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchSubscription(session.user.id);
      } else {
        setSubscription(null);
      }
    });

    // 3. PWA re-open guard: refresh the token when the app becomes visible again
    // (PWA backgrounding prevents the SDK's auto-refresh interval from running)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data: { session: refreshed } } = await supabase.auth.getSession();
          if (refreshed) {
            setSession(refreshed);
            setUser(refreshed.user);
          }
        } catch (e) {
          console.warn('[AUTH] Visibility refresh failed:', e);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Subscription will be fetched by the onAuthStateChange listener
    return data;
  };

  const signup = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const refreshSubscription = () => {
    if (user) fetchSubscription(user.id);
  };

  const value = {
    user,
    session,
    subscription,
    settings,
    loading,
    login,
    signup,
    logout,
    loginWithGoogle,
    refreshSubscription
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
