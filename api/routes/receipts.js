const express = require("express");
const multer = require("multer");
const fileType = require("file-type");
const { supabase } = require("../db");
const { getGeminiModel } = require("../utils/gemini");
const { decryptOrPlain } = require("../utils/cryptoUtil");
const { deriveReceiptToken } = require("../utils/tokenUtils");

const router = express.Router();

/**
 * validateFileType(buffer, filename)
 * Validates file using MIME type + magic bytes.
 * Only allows: image/jpeg, image/png, application/pdf
 */
async function validateFileType(buffer, filename) {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

    try {
        const type = await fileType.fromBuffer(buffer);

        if (!type) {
            return { valid: false, error: 'File type unrecognized' };
        }

        if (!ALLOWED_TYPES.includes(type.mime)) {
            return {
                valid: false,
                error: `File type ${type.mime} not allowed. Supported: JPEG, PNG, PDF`
            };
        }

        // Double-check extension matches (defense in depth)
        const ext = filename.split('.').pop()?.toLowerCase();
        const validExts = ['jpg', 'jpeg', 'png', 'pdf'];
        if (!validExts.includes(ext)) {
            return { valid: false, error: 'File extension mismatch' };
        }

        return { valid: true };
    } catch (err) {
        console.error('[RECEIPTS] File type validation error:', err.message);
        return { valid: false, error: 'File validation failed' };
    }
}

/**
 * Helper: Organize into YYYY/MM/DD paths
 */
function getStoragePath(filename) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}/${filename}`;
}

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024; // 4MB — Vercel serverless functions hard-cap request bodies around 4.5MB
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: MAX_RECEIPT_BYTES } });

// Turns Multer's fileSize overflow into a clean JSON 413 instead of a bare error
function handleUploadErrors(err, req, res, next) {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File too large. Max 4MB — please resize or compress and try again." });
    }
    if (err) return res.status(400).json({ error: err.message || String(err) });
    next();
}

/**
 * POST /receipts/extract
 * Sends an uploaded image or PDF to Gemini Vision and returns extracted
 * receipt fields: vendor, amount, date, category, notes.
 * Uses the user's own BYOB Gemini API key from their settings row.
 * This route is intentionally before /:table/:id so Express doesn't treat
 * "extract" as a table name.
 */
router.post("/extract", upload.single("file"), handleUploadErrors, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });

        const { data: settings } = await req.sb
            .from('settings').select('gemini_api_key').eq('user_id', req.user.id).maybeSingle();

        const apiKey = await decryptOrPlain(settings?.gemini_api_key);
        if (!apiKey) return res.status(400).json({ error: "no_key" });

        const model = await getGeminiModel(apiKey);

        const today = new Date().toISOString().slice(0, 10);
        const prompt = `You are a receipt parser for a professional photographer's expense tracker.
Extract these fields from the receipt image or PDF:
- vendor: business name only (no address, no phone)
- date: transaction date in YYYY-MM-DD format (use "${today}" if not visible)
- subtotal: pre-tip, pre-tax subtotal as a positive number (null if not visible)
- tip: tip amount as a positive number (null if no tip line or tip is $0)
- tax: tax amount as a positive number (null if not visible)
- total: final total charged including tip and tax — this is what hits the card (null if not visible)
- amount: same value as total (for backward compatibility)
- tip_split_likely: true if the tip was written in by hand or added after the card was run (i.e. blank tip line, tip written in pencil, or "TIP" line shows $0 with a handwritten amount), false otherwise
- category: best match from — Advertising, Auto & Transport, Bills & Utilities, Camera & Equipment, Clothing, Dining & Drinks, Education, Entertainment, Gas & Fuel, Groceries, Health & Medical, Home & Garden, Insurance (Business), Insurance (Personal), Office Supplies, Parking & Tolls, Personal Care, Pets, Photography, Professional Services, Rent / Lease, Repairs & Maintenance, Shopping, Software & Tech, Subscriptions, Supplies, Taxes & Licenses, Travel & Vacation, Personal Expense
- notes: one short phrase about what was purchased (10 words max)

If a tip is present, build the notes as: "Subtotal \$X + tip \$Y = \$Z" — otherwise use your own short description.
Return ONLY a valid JSON object. Use null for any field you cannot read.
Example with tip: {"vendor":"The Capital Grille","date":"${today}","subtotal":45.00,"tip":9.00,"tax":3.85,"total":57.85,"amount":57.85,"tip_split_likely":false,"category":"Dining & Drinks","notes":"Subtotal $45.00 + tip $9.00 = $57.85"}
Example no tip: {"vendor":"Best Buy","date":"${today}","subtotal":null,"tip":null,"tax":null,"total":249.99,"amount":249.99,"tip_split_likely":false,"category":"Camera & Equipment","notes":"Memory cards and lens filter"}`;

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString('base64'),
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const raw = result.response.text().trim().replace(/```json|```/g, '').trim();

        let extracted = {};
        try {
            extracted = JSON.parse(raw);
        } catch (_) {
            console.error('[Extract] JSON parse failed. Raw:', raw.slice(0, 300));
            return res.status(500).json({ error: "Could not read receipt data — try a clearer photo." });
        }

        res.json(extracted);
    } catch (e) {
        console.error('[Extract] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /receipts/snap (Quick capture for PWA/Dashboard)
router.post("/snap", upload.single("file"), handleUploadErrors, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Validate file type BEFORE processing
        const validation = await validateFileType(req.file.buffer, req.file.originalname);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const filename = `snap_${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const relativePath = getStoragePath(filename);
        let receipt_link = "";

        const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(relativePath, req.file.buffer, { contentType: req.file.mimetype });

        if (uploadError) {
            console.error("[Snap] Storage failure:", uploadError.message);
            return res.status(500).json({ error: "Storage failure: " + uploadError.message });
        }

        // Store the relative path, NOT a public URL
        const receipt_ident = relativePath;


        // Create a pending expense record
        const { data, error } = await req.sb
            .from("expenses")
            .insert({
                expense_date: new Date().toISOString().slice(0, 10),
                vendor: "Quick Snap Capture",
                category: "Uncategorized",
                amount_cents: 0,
                notes: "Captured via Dashboard Quick Snap. Value and category pending review.",
                source: "dashboard",
                receipt_link: receipt_ident,
                tax_deductible: true
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (e) {
        console.error("[Snap] Fatal Error:", e);
        res.status(500).json({ error: String(e.message || e) });
    }
});

/**
 * GET /receipts/my-address
 * Returns this user's unique receipt forwarding email address.
 * Derives token from RECEIPT_HMAC_SECRET + user ID, stores it in settings
 * for fast inbound lookup, then returns the full address.
 */
router.get("/my-address", async (req, res) => {
    try {
        if (!process.env.RECEIPT_HMAC_SECRET) {
            return res.status(503).json({ error: 'Receipt forwarding not configured on this server.' });
        }
        const token = deriveReceiptToken(req.user.id);
        // Upsert token into settings so emailInbound can look it up by token
        await req.sb
            .from('settings')
            .upsert({ user_id: req.user.id, receipt_token: token }, { onConflict: 'user_id' });
        res.json({ address: `receipts+${token}@lumiereledger.com` });
    } catch (e) {
        console.error('[Receipts] my-address error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /receipts/:table/:id
router.post("/:table/:id", upload.single("file"), handleUploadErrors, async (req, res) => {
    try {
        const { table, id } = req.params;
        const validTables = ["expenses", "equipment_assets"];
        if (!validTables.includes(table)) return res.status(400).json({ error: "Invalid table" });
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Validate file type BEFORE processing
        const validation = await validateFileType(req.file.buffer, req.file.originalname);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const filename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const relativePath = getStoragePath(filename);
        let receipt_link = "";

        const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(relativePath, req.file.buffer, { contentType: req.file.mimetype });

        if (uploadError) {
            console.error("[Storage] Cloud upload failed:", uploadError.message);
            return res.status(500).json({ error: "Storage upload failed: " + uploadError.message });
        }

        const receipt_ident = relativePath;


        // Update Database
        const { data, error } = await req.sb
            .from(table)
            .update({ receipt_link: receipt_ident, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error(`[Receipts] DB Update Error on ${table}:`, error.message);
            throw new Error(`Database update failed: ${error.message}`);
        }
        if (!data) return res.status(404).json({ error: "Record not found (Check if RLS permits table updates)" });

        // Auto-clean a matching pending_receipts row (from email forwarding pipeline)
        // Only fires when uploading to expenses and the amount is unambiguous (exactly one match)
        if (table === 'expenses' && data.amount_cents) {
            try {
                const { data: pending } = await req.sb
                    .from('pending_receipts')
                    .select('id, file_path')
                    .eq('user_id', req.user.id)
                    .eq('amount_cents', data.amount_cents);
                if (pending?.length === 1) {
                    const p = pending[0];
                    await req.sb.from('pending_receipts').delete().eq('id', p.id);
                    if (p.file_path) {
                        await supabase.storage.from('receipts').remove([p.file_path]).catch(() => {});
                    }
                    console.log(`[Receipts] Auto-cleaned pending_receipts row ${p.id} for amount ${data.amount_cents}`);
                }
            } catch (cleanupErr) {
                // Non-fatal — upload succeeded, just log the cleanup failure
                console.warn('[Receipts] pending_receipts cleanup failed:', cleanupErr.message);
            }
        }

        res.json(data);
    } catch (e) {
        console.error("[Receipts] Fatal Upload Failure:", e.message);
        res.status(500).json({ error: String(e.message || e) });
    }
});

/**
 * GET /receipts/signed-url
 * Takes a 'path' (from receipt_link column) and returns a temporary signed URL.
 * Signed URLs expire in 1 hour.
 */
router.get("/signed-url", async (req, res) => {
    try {
        const { path } = req.query;
        if (!path) return res.status(400).json({ error: "Path missing" });

        // If it's already a public URL, return it as-is (backward compatible)
        if (path.startsWith("http")) {
            return res.json({ url: path });
        }

        const { data, error } = await supabase.storage
            .from("receipts")
            .createSignedUrl(path, 3600); // 1 hour TTL

        if (error) throw error;
        res.json({ url: data.signedUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
