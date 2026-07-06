const express = require('express');
const multer  = require('multer');
const { getGeminiModel } = require('../utils/gemini');
const { decryptOrPlain } = require('../utils/cryptoUtil');
const { supabase: adminClient } = require('../db'); // service role — needed for Storage (bucket has no RLS policies)

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB max

const VALID_TYPES = ['general', 'warranty', 'contract', 'insurance', 'loan'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * chunkText(text, size, overlap)
 * Splits a string into overlapping chunks of ~size characters.
 * Skips chunks shorter than 50 chars (noise from headers/footers).
 */
function chunkText(text, size = 2000, overlap = 100) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        const chunk = text.slice(start, end).trim();
        if (chunk.length >= 50) chunks.push(chunk);
        if (end === text.length) break;
        start = end - overlap;
    }
    return chunks;
}

/**
 * extractTextFromPdf(buffer)
 * Uses pdf-parse to extract raw text from a PDF buffer.
 */
async function extractTextFromPdf(buffer) {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
}

/**
 * extractTextFromImage(buffer, mimeType, apiKey)
 * Sends image to Gemini Vision and asks it to transcribe all text.
 */
async function extractTextFromImage(buffer, mimeType, apiKey) {
    const model = await getGeminiModel(apiKey);
    const result = await model.generateContent([
        'Transcribe all text from this document image exactly as written. Return only the raw text, no formatting or commentary.',
        { inlineData: { data: buffer.toString('base64'), mimeType } },
    ]);
    return result.response.text().trim();
}

// ── GET /documents ────────────────────────────────────────────────────────────
// Returns the user's indexed document list.
router.get('/', async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from('user_documents')
            .select('id, filename, doc_type, chunk_count, created_at, file_path')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

// ── GET /documents/:id/download ───────────────────────────────────────────────
// Returns a 1-hour signed URL for the original uploaded file.
router.get('/:id/download', async (req, res) => {
    try {
        const { data: doc, error: docErr } = await req.sb
            .from('user_documents')
            .select('file_path, filename')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (docErr || !doc) return res.status(404).json({ error: 'Document not found' });
        if (!doc.file_path) return res.status(404).json({ error: 'Original file not available for this document' });

        // Use service-role client (req.sb) to create signed URL — bucket is private
        const { data: signedData, error: signErr } = await adminClient.storage
            .from('documents')
            .createSignedUrl(doc.file_path, 3600); // 1-hour expiry

        if (signErr) throw signErr;
        res.json({ url: signedData.signedUrl, filename: doc.filename });
    } catch (e) {
        console.error('[Documents] Download error:', e.message);
        res.status(500).json({ error: String(e.message || e) });
    }
});

// ── POST /documents/upload ────────────────────────────────────────────────────
// Accepts a PDF or image, extracts text, chunks it, and stores everything in
// user_documents + document_chunks. Also saves the original file to Storage.
// No embeddings — Brain uses full-text context injection via context window.
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided' });

        // Gemini key required for image transcription; PDFs use pdf-parse (no key needed)
        const { data: settings } = await req.sb
            .from('settings')
            .select('gemini_api_key')
            .eq('user_id', req.user.id)
            .maybeSingle();

        const apiKey = await decryptOrPlain(settings?.gemini_api_key);
        const mime = req.file.mimetype;

        // Images require Gemini Vision — PDFs do not
        if (mime.startsWith('image/') && !apiKey) {
            return res.status(400).json({ error: 'no_key' });
        }

        if (!['application/pdf'].includes(mime) && !mime.startsWith('image/')) {
            return res.status(400).json({ error: 'Unsupported file type. Upload a PDF or image.' });
        }

        const docType = VALID_TYPES.includes(req.body?.doc_type) ? req.body.doc_type : 'general';
        const filename = req.file.originalname || 'document';

        // ── Extract text ──────────────────────────────────────────────────────
        let rawText = '';
        if (mime === 'application/pdf') {
            rawText = await extractTextFromPdf(req.file.buffer);
        } else {
            rawText = await extractTextFromImage(req.file.buffer, mime, apiKey);
        }

        if (!rawText.trim()) {
            return res.status(422).json({ error: 'Could not extract text from this file. Try a clearer scan.' });
        }

        // ── Chunk ─────────────────────────────────────────────────────────────
        const chunks = chunkText(rawText);
        if (!chunks.length) {
            return res.status(422).json({ error: 'Document appears to contain no readable text.' });
        }

        // ── Save original file to Supabase Storage ────────────────────────────
        const d = new Date();
        const datePath = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${req.user.id}/${datePath}/${Date.now()}_${safeFilename}`;

        let filePath = null;
        const { error: storageErr } = await adminClient.storage
            .from('documents')
            .upload(storagePath, req.file.buffer, { contentType: mime });

        if (!storageErr) {
            filePath = storagePath;
        } else {
            console.error('[Documents] Storage upload failed (non-fatal):', storageErr.message);
        }

        // ── Insert document metadata ──────────────────────────────────────────
        const { data: doc, error: docErr } = await req.sb
            .from('user_documents')
            .insert({ user_id: req.user.id, filename, doc_type: docType, chunk_count: chunks.length, file_path: filePath })
            .select()
            .single();
        if (docErr) throw docErr;

        // ── Insert text chunks (no embeddings) ────────────────────────────────
        const chunkRows = chunks.map((chunk, i) => ({
            user_id:     req.user.id,
            doc_id:      doc.id,
            chunk_index: i,
            chunk_text:  chunk,
            // embedding intentionally omitted — Brain uses full context window injection
        }));

        const { error: chunkErr } = await req.sb
            .from('document_chunks')
            .insert(chunkRows);

        if (chunkErr) {
            // Roll back document row and storage file if chunks fail
            await req.sb.from('user_documents').delete().eq('id', doc.id).eq('user_id', req.user.id);
            if (filePath) await adminClient.storage.from('documents').remove([filePath]);
            throw chunkErr;
        }

        res.json({ id: doc.id, filename, doc_type: docType, chunk_count: chunks.length, has_file: !!filePath });
    } catch (e) {
        console.error('[Documents] Upload error:', e.message);
        res.status(500).json({ error: String(e.message || e) });
    }
});

// ── DELETE /documents/:id ─────────────────────────────────────────────────────
// Deletes the document, its chunks, and the original file from Storage.
router.delete('/:id', async (req, res) => {
    try {
        // Fetch file_path before deleting so we can clean up Storage
        const { data: doc } = await req.sb
            .from('user_documents')
            .select('file_path')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        const { error } = await req.sb
            .from('user_documents')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);
        if (error) throw error;

        // Clean up Storage file (non-fatal if missing)
        if (doc?.file_path) {
            await adminClient.storage.from('documents').remove([doc.file_path]).catch(() => {});
        }

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;
