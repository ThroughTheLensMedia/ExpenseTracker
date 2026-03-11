const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { supabase } = require("../db");

const router = express.Router();

// ── STORAGE PREP ────────────────────────────────────────────────────────────
const RECEIPT_DIR = process.env.RECEIPT_DIR || (process.env.VERCEL ? "/tmp/receipts" : path.join(__dirname, "..", "receipts"));

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

const storage = multer.memoryStorage(); // We'll process the upload based on availability
const upload = multer({ storage });

// POST /receipts/:id
router.post("/:id", upload.single("file"), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const filename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const relativePath = getStoragePath(filename);
        let receipt_link = "";

        // Strategy A: Use Supabase Storage (Cloud Persistence)
        const canUseCloud = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

        if (canUseCloud) {
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("receipts")
                .upload(relativePath, req.file.buffer, { contentType: req.file.mimetype });

            if (!uploadError) {
                const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(relativePath);
                receipt_link = urlData.publicUrl;
            } else {
                console.warn("[Storage] Cloud upload failed, falling back to local:", uploadError.message);
            }
        }

        // Strategy B: Fallback to Local Filesystem (Synology / Local Dev)
        if (!receipt_link) {
            const localPath = path.join(RECEIPT_DIR, relativePath);
            const localDir = path.dirname(localPath);
            if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
            fs.writeFileSync(localPath, req.file.buffer);
            receipt_link = `/receipts/${relativePath}`;
        }

        // Update Database
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
        console.error("[Receipts] Upload Critical Failure:", e);
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;
