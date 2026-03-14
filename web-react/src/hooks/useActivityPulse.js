import { useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../components/AuthContext';

/**
 * useActivityPulse
 * Sends a 'heartbeat' to the server every minute to track user engagement.
 * Only runs if the user is authenticated.
 */
export function useActivityPulse() {
    const { session } = useAuth();
    const isAuthenticated = !!session;

    useEffect(() => {
        if (!isAuthenticated) return;

        const sendPulse = async () => {
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                const token = currentSession?.access_token;
                if (!token) return;

                await fetch('/api/activity/pulse', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (e) {
                // Silent catch — heartbeat failure shouldn't disrupt UI
                console.debug("[Activity] Pulse failed", e);
            }
        };

        // Send initial pulse
        sendPulse();

        // Interval: 1 minute (60,000 ms)
        const interval = setInterval(sendPulse, 60000);

        return () => clearInterval(interval);
    }, [isAuthenticated]);
}
