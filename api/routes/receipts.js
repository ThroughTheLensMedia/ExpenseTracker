const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

// POST /receipts/:table/:id
router.post("/:table/:id", upload.single("file"), async (req, res) => {
    try {
        const { table, id } = req.params;
        const validTables = ["expenses", "equipment_assets"];
        if (!validTables.includes(table)) return res.status(400).json({ error: "Invalid table" });
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const filename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const relativePath = getStoragePath(filename);
        let receipt_link = "";

        // Strategy A: Use Supabase Storage
        const canUseCloud = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

        if (canUseCloud) {
            const { error: uploadError } = await supabase.storage
                .from("receipts")
                .upload(relativePath, req.file.buffer, { contentType: req.file.mimetype });

            if (!uploadError) {
                const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(relativePath);
                receipt_link = urlData.publicUrl;
            } else {
                console.warn("[Storage] Cloud upload failed fallback to local:", uploadError.message);
            }
        }

        // Strategy B: Fallback to Local Filesystem
        if (!receipt_link) {
            const localPath = path.join(RECEIPT_DIR, relativePath);
            const localDir = path.dirname(localPath);
            if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
            fs.writeFileSync(localPath, req.file.buffer);
            receipt_link = `/receipts/${relativePath}`;
        }

        // Update Database
        const { data, error } = await req.sb
            .from(table)
            .update({ receipt_link, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Record not found" });

        res.json(data);
    } catch (e) {
        console.error("[Receipts] Upload Failure:", e);
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;
