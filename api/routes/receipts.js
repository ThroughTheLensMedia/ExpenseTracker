const express = require("express");
const multer = require("multer");
const fileType = require("file-type");
const { supabase } = require("../db");

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

const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /receipts/snap (Quick capture for PWA/Dashboard)
router.post("/snap", upload.single("file"), async (req, res) => {
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

// POST /receipts/:table/:id
router.post("/:table/:id", upload.single("file"), async (req, res) => {
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
