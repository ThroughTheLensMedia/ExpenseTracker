const express = require('express');
const multer  = require('multer');
const { getEmbedding, getGeminiModel } = require('../utils/gemini');

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
            .select('id, filename, doc_type, chunk_count, created_at')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

// ── POST /documents/upload ────────────────────────────────────────────────────
// Accepts a PDF or image, extracts text, chunks it, embeds each chunk, and
// stores everything in user_documents + document_chunks.
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided' });

        // Require Gemini key — embeddings use the user's own API key
        const { data: settings } = await req.sb
            .from('settings')
            .select('gemini_api_key')
            .eq('user_id', req.user.id)
            .maybeSingle();

        const apiKey = settings?.gemini_api_key;
        if (!apiKey) return res.status(400).json({ error: 'no_key' });

        const docType = VALID_TYPES.includes(req.body?.doc_type) ? req.body.doc_type : 'general';
        const filename = req.file.originalname || 'document';
        const mime = req.file.mimetype;

        // ── Extract text ──────────────────────────────────────────────────────
        let rawText = '';
        if (mime === 'application/pdf') {
            rawText = await extractTextFromPdf(req.file.buffer);
        } else if (mime.startsWith('image/')) {
            rawText = await extractTextFromImage(req.file.buffer, mime, apiKey);
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Upload a PDF or image.' });
        }

        if (!rawText.trim()) {
            return res.status(422).json({ error: 'Could not extract text from this file. Try a clearer scan.' });
        }

        // ── Chunk ─────────────────────────────────────────────────────────────
        const chunks = chunkText(rawText);
        if (!chunks.length) {
            return res.status(422).json({ error: 'Document appears to contain no readable text.' });
        }

        // ── Insert document metadata ──────────────────────────────────────────
        const { data: doc, error: docErr } = await req.sb
            .from('user_documents')
            .insert({ user_id: req.user.id, filename, doc_type: docType, chunk_count: chunks.length })
            .select()
            .single();
        if (docErr) throw docErr;

        // ── Embed + insert chunks (sequential to stay within rate limits) ─────
        const chunkRows = [];
        for (let i = 0; i < chunks.length; i++) {
            const embedding = await getEmbedding(apiKey, chunks[i]);
            chunkRows.push({
                user_id:     req.user.id,
                doc_id:      doc.id,
                chunk_index: i,
                chunk_text:  chunks[i],
                embedding:   JSON.stringify(embedding), // pgvector accepts JSON array
            });
        }

        const { error: chunkErr } = await req.sb
            .from('document_chunks')
            .insert(chunkRows);
        if (chunkErr) {
            // Roll back the document row if chunks fail
            await req.sb.from('user_documents').delete().eq('id', doc.id).eq('user_id', req.user.id);
            throw chunkErr;
        }

        res.json({ id: doc.id, filename, doc_type: docType, chunk_count: chunks.length });
    } catch (e) {
        console.error('[Documents] Upload error:', e.message);
        res.status(500).json({ error: String(e.message || e) });
    }
});

// ── DELETE /documents/:id ─────────────────────────────────────────────────────
// Deletes the document and all its chunks (FK cascade handles chunks).
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await req.sb
            .from('user_documents')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});

module.exports = router;
