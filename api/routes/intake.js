// /api/routes/intake.js
// Public server-to-server intake endpoint for TTLM website booking form
// No user auth required — protected by LUMIERE_INTAKE_SECRET shared key
// Leads are inserted directly into Joshua's account (owner user_id)

const express = require("express");
const router = express.Router();
const { supabase } = require("../db");
const { ADMIN_UUID } = require("../constants");

// Fallback for the original single-owner setup (env var still works for backward compat)
const LEGACY_resolvedUserId = ADMIN_UUID;
const LEGACY_INTAKE_SECRET  = process.env.LUMIERE_INTAKE_SECRET || "";

router.post("/", async (req, res) => {
    try {
        const secret = req.headers["x-intake-secret"] || req.body?.intake_secret;
        const INTAKE_SECRET = process.env.LUMIERE_INTAKE_SECRET;

        if (!secret) {
            return res.status(401).json({ ok: false, error: "Missing intake secret." });
        }

        if (!supabase) {
            return res.status(500).json({ ok: false, error: "Database unavailable." });
        }

        // ---- Resolve user_id from intake key ----
        // Priority 1: DB-managed key (multi-tenant)
        // Priority 2: Legacy env var (backward compat for original owner)
        let resolvedUserId = null;

        const { data: keyRecord, error: keyErr } = await supabase
            .from("intake_keys")
            .select("user_id, id")
            .eq("key", secret)
            .maybeSingle();

        if (keyRecord) {
            resolvedUserId = keyRecord.user_id;
            // Update last_used_at (fire-and-forget)
            supabase.from("intake_keys")
                .update({ last_used_at: new Date().toISOString() })
                .eq("id", keyRecord.id)
                .then(() => {})
                .catch(() => {});
        } else if (LEGACY_INTAKE_SECRET && secret === LEGACY_INTAKE_SECRET) {
            resolvedUserId = LEGACY_resolvedUserId;
        }

        if (!resolvedUserId) {
            console.warn("[INTAKE] Rejected — key not found in DB or env fallback.");
            return res.status(401).json({ ok: false, error: "Unauthorized." });
        }

        const {
            name,
            email,
            phone,
            shootType,
            idealDate,
            location,
            message,
            sourceUrl
        } = req.body;

        if (!name || !email) {
            return res.status(400).json({ ok: false, error: "name and email are required." });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanName  = String(name).trim();
        const cleanPhone = String(phone || "").trim();

        // ---- Client deduplication: find or create by email ----
        let clientId = null;
        let isReturning = false;

        const { data: existingClient } = await supabase
            .from("clients")
            .select("id, name")
            .eq("user_id", resolvedUserId)
            .ilike("email", cleanEmail)
            .maybeSingle();

        if (existingClient) {
            // Returning customer — link to existing record
            clientId = existingClient.id;
            isReturning = true;
            console.log(`[INTAKE] Returning client matched — id:${clientId} email:${cleanEmail}`);
        } else {
            // New customer — create a client record first
            const { data: newClient, error: clientErr } = await supabase
                .from("clients")
                .insert({ user_id: resolvedUserId, name: cleanName, email: cleanEmail, phone: cleanPhone })
                .select("id")
                .single();

            if (clientErr) {
                console.warn("[INTAKE] Client creation failed (non-fatal):", clientErr.message);
            } else {
                clientId = newClient.id;
                console.log(`[INTAKE] New client created — id:${clientId} email:${cleanEmail}`);
            }
        }

        // ---- Build notes ----
        const noteParts = [];
        if (isReturning)  noteParts.push(`⟳ Returning client`);
        if (idealDate)    noteParts.push(`Ideal Date: ${idealDate}`);
        if (location)     noteParts.push(`Location: ${location}`);
        if (message)      noteParts.push(`Message: ${message}`);
        if (sourceUrl)    noteParts.push(`Source: ${sourceUrl}`);
        const notes = noteParts.join("\n");

        // ---- Insert lead ----
        const { data, error } = await supabase
            .from("leads")
            .insert({
                user_id:            resolvedUserId,
                client_id:          clientId,
                name:               cleanName,
                email:              cleanEmail,
                phone:              cleanPhone,
                project_type:       String(shootType || "Other").trim(),
                quoted_value_cents: 0,
                status:             "New Lead",
                notes
            })
            .select()
            .single();

        if (error) {
            console.error("[INTAKE] Supabase insert error:", error.message);
            return res.status(500).json({ ok: false, error: "Failed to save lead." });
        }

        console.log(`[INTAKE] Lead created — id:${data.id} returning:${isReturning} client_id:${clientId}`);
        return res.json({ ok: true, id: data.id, returning: isReturning });

    } catch (err) {
        console.error("[INTAKE] Unexpected error:", err.message);
        return res.status(500).json({ ok: false, error: "Internal server error." });
    }
});

module.exports = router;
