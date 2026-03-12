const express = require("express");
const z = require("zod");

const router = express.Router();

const MileageSchema = z.object({
    log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    miles: z.coerce.number().min(0),
    purpose: z.string().trim().min(1, "Purpose required")
});

const QuerySchema = z.object({
    year: z.coerce.number().min(1900).max(2500).optional()
});

// ─── Mileage Logs ────────────────────────────────────────────────────────────

// GET /mileage
router.get("/", async (req, res) => {
    try {
        const { year } = QuerySchema.parse(req.query);
        let query = req.sb.from("mileage_logs").select("*").order("log_date", { ascending: false });
        if (year) {
            query = query.gte("log_date", `${year}-01-01`).lte("log_date", `${year}-12-31`);
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error("[API] GET /mileage Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /mileage
router.post("/", async (req, res) => {
    try {
        const body = MileageSchema.parse(req.body);
        const { data, error } = await supabase.from("mileage_logs").insert([body]).select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (e) {
        console.error("[API] POST /mileage Error:", e);
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
        res.status(500).json({ error: e.message });
    }
});

// DELETE /mileage/:id
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from("mileage_logs").delete().eq("id", id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        console.error("[API] DELETE /mileage Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// ─── Mileage Rates ───────────────────────────────────────────────────────────

// GET /mileage/rates  – returns all stored IRS rates
router.get("/rates", async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from("mileage_rates")
            .select("*")
            .order("year", { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error("[API] GET /mileage/rates Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /mileage/rates/sync  – scrapes IRS.gov and saves the latest rate
router.post("/rates/sync", async (req, res) => {
    try {
        // Fetch the IRS standard mileage rates page
        const irsUrl = "https://www.irs.gov/tax-professionals/standard-mileage-rates";
        const response = await fetch(irsUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; ExpenseTrackerBot/1.0)" }
        });
        if (!response.ok) throw new Error(`IRS.gov returned HTTP ${response.status}`);

        const html = await response.text();

        // Parse the business mileage rate for the current year.
        // The IRS page lists rates like: "Self-employed and business: 70 cents/mile"
        const currentYear = new Date().getFullYear();

        // Look for a pattern like "business: 70 cents" or "70 cents/mile"
        const patterns = [
            /self-employed and business:\s*(\d+(?:\.\d+)?)\s*cents?\/mile/i,
            /business(?:\s+use)?:\s*(\d+(?:\.\d+)?)\s*cents?\/mile/i,
            /(\d+(?:\.\d+)?)\s*cents?(?:\/|\s+per\s+)mile.*?business/i,
        ];

        let ratePerMile = null;
        let matchedText = null;

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                ratePerMile = parseFloat(match[1]) / 100; // convert cents to dollars
                matchedText = match[0];
                break;
            }
        }

        if (!ratePerMile) {
            return res.status(422).json({
                error: "Could not parse mileage rate from IRS.gov. The page format may have changed.",
                hint: "Please enter the rate manually."
            });
        }

        // Upsert the rate
        const { error: upsertError } = await req.sb
            .from("mileage_rates")
            .upsert({
                year: currentYear,
                rate_per_mile: ratePerMile,
                source: `IRS.gov (auto-synced ${new Date().toISOString().slice(0, 10)})`,
                last_synced_at: new Date().toISOString()
            }, { onConflict: "year" });

        if (upsertError) throw upsertError;

        res.json({ ok: true, year: currentYear, rate_per_mile: ratePerMile, parsed_from: matchedText });
    } catch (e) {
        console.error("[API] POST /mileage/rates/sync Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /mileage/rates  – manually set a rate for a specific year
router.post("/rates", async (req, res) => {
    try {
        const body = z.object({
            year: z.coerce.number().min(2000).max(2100),
            rate_per_mile: z.coerce.number().min(0).max(5),
        }).parse(req.body);

        const { error } = await req.sb
            .from("mileage_rates")
            .upsert({ ...body, source: "Manual entry", last_synced_at: new Date().toISOString() }, { onConflict: "year" });

        if (error) throw error;
        res.json({ ok: true, ...body });
    } catch (e) {
        console.error("[API] POST /mileage/rates Error:", e);
        if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

