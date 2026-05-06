// /api/routes/intake.js
// Public server-to-server intake endpoint for TTLM website booking form
// No user auth required — protected by LUMIERE_INTAKE_SECRET shared key
// Leads are inserted directly into Joshua's account (owner user_id)

const express = require("express");
const router = express.Router();
const { supabase } = require("../db");

// Joshua's Supabase user_id — intake leads are always scoped to this account
const OWNER_USER_ID = "49e7efcb-6434-4f0c-9563-3151a6d50df9";

router.post("/", async (req, res) => {
    try {
        const secret = req.headers["x-intake-secret"] || req.body?.intake_secret;
        const INTAKE_SECRET = process.env.LUMIERE_INTAKE_SECRET;

        if (!INTAKE_SECRET) {
            console.error("[INTAKE] LUMIERE_INTAKE_SECRET env var is not set.");
            return res.status(500).json({ ok: false, error: "Intake not configured." });
        }

        if (!secret || secret !== INTAKE_SECRET) {
            console.warn("[INTAKE] Rejected request — invalid or missing intake secret.");
            return res.status(401).json({ ok: false, error: "Unauthorized." });
        }

        if (!supabase) {
            return res.status(500).json({ ok: false, error: "Database unavailable." });
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

        // Build a readable notes field from the form details
        const noteParts = [];
        if (idealDate)  noteParts.push(`Ideal Date: ${idealDate}`);
        if (location)   noteParts.push(`Location: ${location}`);
        if (message)    noteParts.push(`Message: ${message}`);
        if (sourceUrl)  noteParts.push(`Source: ${sourceUrl}`);
        const notes = noteParts.join("\n");

        const { data, error } = await supabase
            .from("leads")
            .insert({
                user_id:            OWNER_USER_ID,
                name:               String(name  || "").trim(),
                email:              String(email || "").trim(),
                phone:              String(phone || "").trim(),
                project_type:       String(shootType || "Other").trim(),
                quoted_value_cents: 0,
                status:             "New Lead",
                notes,
                client_id:          null
            })
            .select()
            .single();

        if (error) {
            console.error("[INTAKE] Supabase insert error:", error.message);
            return res.status(500).json({ ok: false, error: "Failed to save lead." });
        }

        console.log(`[INTAKE] Lead created — id:${data.id} name:${data.name} email:${data.email}`);
        return res.json({ ok: true, id: data.id });

    } catch (err) {
        console.error("[INTAKE] Unexpected error:", err.message);
        return res.status(500).json({ ok: false, error: "Internal server error." });
    }
});

module.exports = router;
