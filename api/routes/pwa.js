const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { supabase } = require("../db");

const router = express.Router();

// ── STORAGE PREP ────────────────────────────────────────────────────────────
const RECEIPT_DIR = process.env.RECEIPT_DIR || (process.env.VERCEL ? "/tmp/receipts" : path.join(__dirname, "..", "receipts"));

function getStoragePath(filename) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}/${filename}`;
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * POST /pwa/quick-capture
 * Expects a multipart form with a 'file' field and optional project/expense metadata
 */
router.post("/quick-capture", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const filename = `quick_${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const relativePath = getStoragePath(filename);
        let receipt_link = "";

        // Strategy A: Supabase Cloud Storage
        const canUseCloud = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
        if (canUseCloud) {
            const { error: uploadError } = await supabase.storage
                .from("receipts")
                .upload(relativePath, req.file.buffer, { contentType: req.file.mimetype });

            if (!uploadError) {
                const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(relativePath);
                receipt_link = urlData.publicUrl;
            } else {
                console.warn("[PWA] Cloud upload fallback to local:", uploadError.message);
            }
        }

        // Strategy B: Local Fallback
        if (!receipt_link) {
            const localPath = path.join(RECEIPT_DIR, relativePath);
            const localDir = path.dirname(localPath);
            if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
            fs.writeFileSync(localPath, req.file.buffer);
            receipt_link = `/receipts/${relativePath}`;
        }

        // Step 1: Create an "Unverified" expense record immediately
        const { data, error } = await supabase
            .from("expenses")
            .insert({
                expense_date: new Date().toISOString().slice(0, 10),
                vendor: "Quick PWA Capture",
                category: "Uncategorized",
                amount_cents: 0,
                notes: "Captured via PWA Quick Snap. Category and amount pending review.",
                source: "pwa",
                receipt_link: receipt_link,
                tax_deductible: true
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: "Receipt captured and filed for review.",
            expense: data
        });
    } catch (e) {
        console.error("[PWA] Quick Capture Error:", e);
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;
