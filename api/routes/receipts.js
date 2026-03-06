const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { supabase } = require("../db");

const router = express.Router();

// NOTE: If deploying to a serverless platform (Vercel/Railway), 
// local filesystem storage is ephemeral. Consider Supabase Storage for persistence.
const RECEIPT_DIR = process.env.RECEIPT_DIR || (process.env.VERCEL ? "/tmp/receipts" : path.join(__dirname, "..", "receipts"));
if (!fs.existsSync(RECEIPT_DIR)) fs.mkdirSync(RECEIPT_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RECEIPT_DIR),
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${Date.now()}_${safe}`);
    }
});
const upload = multer({ storage });

// POST /receipts/:id
router.post("/:id", upload.single("file"), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const receipt_link = `/receipts/${req.file.filename}`;

        const { data, error } = await supabase
            .from("expenses")
            .update({ receipt_link, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Expense not found" });

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;
