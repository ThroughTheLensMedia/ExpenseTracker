const express = require("express");
const multer = require("multer");
const { supabase } = require("../db");

const router = express.Router();

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

        const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(relativePath, req.file.buffer, { contentType: req.file.mimetype });

        if (!uploadError) {
            const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(relativePath);
            receipt_link = urlData.publicUrl;
        } else {
            console.error("[Storage] Cloud upload failed:", uploadError.message);
            return res.status(500).json({ error: "Storage upload failed: " + uploadError.message });
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
