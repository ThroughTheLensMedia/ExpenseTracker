const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { supabase } = require("../db");

const router = express.Router();

// Storage configuration - Use standard Multer disk storage for local handling
const RECEIPT_DIR = process.env.RECEIPT_DIR || (process.env.VERCEL ? "/tmp/receipts" : path.join(__dirname, "..", "receipts"));
if (!fs.existsSync(RECEIPT_DIR)) fs.mkdirSync(RECEIPT_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RECEIPT_DIR),
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `quick_${Date.now()}_${safe}`);
    }
});
const upload = multer({ storage });

/**
 * POST /pwa/quick-capture
 * Expects a multipart form with a 'file' field and optional project/expense metadata
 */
router.post("/quick-capture", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const receipt_link = `/receipts/${req.file.filename}`;

        // Step 1: Create an "Unverified" expense record immediately
        // This allows the user to snap now and categorize later from the dashboard liabilities
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
