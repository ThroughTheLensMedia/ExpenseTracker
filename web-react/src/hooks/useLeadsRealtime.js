// useLeadsRealtime.js
// Subscribes to Supabase Realtime INSERT events on the leads table.
// Returns: { newLeadCount, latestLead, clearBadge }
// Shows a browser toast when a new lead arrives.

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../components/AuthContext';
import { useAuth } from '../components/AuthContext';

export function useLeadsRealtime() {
    const { user } = useAuth();
    const [newLeadCount, setNewLeadCount] = useState(0);
    const [latestLead, setLatestLead] = useState(null);
    const toastRef = useRef(null);
    const channelRef = useRef(null);

    const clearBadge = useCallback(() => {
        setNewLeadCount(0);
        setLatestLead(null);
    }, []);

    const showToast = useCallback((lead) => {
        // Remove existing toast if present
        if (toastRef.current) {
            toastRef.current.remove();
        }

        const toast = document.createElement('div');
        toast.id = 'lead-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 90px;
            right: 20px;
            z-index: 99999;
            background: linear-gradient(135deg, #0f1f3d, #1a2f5a);
            border: 1px solid rgba(56, 189, 248, 0.4);
            border-left: 4px solid #38bdf8;
            border-radius: 16px;
            padding: 16px 20px;
            color: white;
            font-family: inherit;
            min-width: 280px;
            max-width: 340px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(56,189,248,0.1);
            animation: slideInRight 0.3s ease-out;
            cursor: pointer;
        `;

        toast.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:12px;">
                <div style="font-size:22px; line-height:1;">🎯</div>
                <div style="flex:1;">
                    <div style="font-weight:900; font-size:11px; color:#38bdf8; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:4px;">New Lead</div>
                    <div style="font-weight:800; font-size:14px;">${lead.name || 'New Inquiry'}</div>
                    <div style="font-size:11px; color:rgba(255,255,255,0.6); margin-top:2px;">${lead.project_type || 'Session Request'}</div>
                </div>
                <div style="font-size:16px; opacity:0.5; cursor:pointer;" onclick="this.closest('#lead-toast').remove()">✕</div>
            </div>
        `;

        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(120%); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
            }
        `;
        if (!document.getElementById('lead-toast-style')) {
            style.id = 'lead-toast-style';
            document.head.appendChild(style);
        }

        // Click to navigate to CRM
        toast.addEventListener('click', () => {
            toast.remove();
            window.location.href = '/crm';
        });

        document.body.appendChild(toast);
        toastRef.current = toast;

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000);
    }, []);

    useEffect(() => {
        if (!supabase || !user?.id) return;

        // Subscribe to INSERT events on the leads table scoped to this user
        const channel = supabase
            .channel(`leads-intake-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'leads',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const lead = payload.new;
                    setNewLeadCount(prev => prev + 1);
                    setLatestLead(lead);
                    showToast(lead);
                    console.log('[Realtime] New lead received:', lead);
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] leads channel status:', status);
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [user?.id, showToast]);

    return { newLeadCount, latestLead, clearBadge };
}
