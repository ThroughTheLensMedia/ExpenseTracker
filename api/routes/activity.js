const express = require("express");
const router = express.Router();

// POST /api/activity/pulse
// Tracking interval: Usually called every 1 minute from the frontend
router.post("/pulse", async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        // Upsert logic: If row exists for (user, date), increment minutes. Else insert.
        // We use a raw RPC or a manual select/update flow if upsert with increment isn't available in standard RLS
        
        const { supabase: serviceClient } = require("../db");
        if (!serviceClient) throw new Error("DB Client unavailable");

        const { data: existing, error: fetchError } = await serviceClient
            .from('user_daily_activity')
            .select('id, total_minutes_active')
            .eq('user_id', userId)
            .eq('activity_date', today)
            .maybeSingle(); // maybeSingle() is cleaner than fetchError check

        if (existing) {
            const { data, error } = await serviceClient
                .from('user_daily_activity')
                .update({ 
                    total_minutes_active: (existing.total_minutes_active || 0) + 1,
                    last_pulse_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            return res.json({ ok: true, session_minutes: data.total_minutes_active });
        } else {
            const { data, error } = await serviceClient
                .from('user_daily_activity')
                .insert({
                    user_id: userId,
                    activity_date: today,
                    total_minutes_active: 1,
                    last_pulse_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                // 23505 = unique violation on (user_id, activity_date) — another concurrent
                // pulse (e.g. multiple open tabs) inserted the row between our SELECT above
                // and this INSERT. Fall back to incrementing the row that now exists instead
                // of failing the request.
                if (error.code === '23505') {
                    const { data: raceRow, error: raceFetchErr } = await serviceClient
                        .from('user_daily_activity')
                        .select('id, total_minutes_active')
                        .eq('user_id', userId)
                        .eq('activity_date', today)
                        .single();
                    if (raceFetchErr) throw raceFetchErr;

                    const { data: updated, error: raceUpdateErr } = await serviceClient
                        .from('user_daily_activity')
                        .update({
                            total_minutes_active: (raceRow.total_minutes_active || 0) + 1,
                            last_pulse_at: new Date().toISOString()
                        })
                        .eq('id', raceRow.id)
                        .select()
                        .single();
                    if (raceUpdateErr) throw raceUpdateErr;
                    return res.json({ ok: true, session_minutes: updated.total_minutes_active });
                }
                throw error;
            }
            return res.json({ ok: true, session_minutes: 1 });
        }
    } catch (e) {
        console.error("[Activity Pulse Error]", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
