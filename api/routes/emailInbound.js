const { supabase } = require('../db');
const { parseReceiptFromEmailBody, parseReceiptFromFile } = require('../utils/receiptEmailParser');
const { sendReceiptConfirmationEmail } = require('../utils/mailer');

// Phase 1: single user. "jd" maps to Joshua's user ID.
const TOKEN_MAP = {
    'jd': '49e7efcb-6434-4f0c-9563-3151a6d50df9',
};

/**
 * POST /api/receipts/email-inbound
 * Postmark inbound webhook. No JWT auth — protected by POSTMARK_INBOUND_TOKEN query param.
 * Exported as a plain async handler (not an Express Router) so it can be mounted directly
 * on app.post() without sub-router path-stripping complications.
 */
// res.sendStatus(200) is now handled unconditionally in server.js before this function is called.
// This function receives only req — it processes and logs, never touches res.
const handler = async (req) => {
    try {
        // Verify token passed as query param in webhook URL
        // Postmark webhook URL format: /api/receipts/email-inbound?token=<POSTMARK_INBOUND_TOKEN>
        const inboundToken = process.env.POSTMARK_INBOUND_TOKEN;
        const provided = req.query.token;
        console.log('[EmailInbound] Token check — provided:', provided, '| env:', inboundToken ? inboundToken.slice(0, 8) + '...' : 'NOT SET');
        if (inboundToken && provided !== inboundToken) {
            console.warn('[EmailInbound] Invalid token — ignoring');
            return;
        }

        const payload = req.body;
        if (!payload || !payload.To) {
            console.warn('[EmailInbound] Missing payload or To field');
            return;
        }

        // Parse token from To address (e.g. receipts+jd@lumiereledger.com → "jd")
        const toAddress = Array.isArray(payload.ToFull)
            ? payload.ToFull[0]?.Email || payload.To
            : payload.To;

        const tokenMatch = toAddress.match(/receipts\+([^@]+)@/i);
        const token = tokenMatch ? tokenMatch[1].toLowerCase() : null;
        // Phase 1: fall back to Joshua's user ID if no token found (direct Postmark address forwarding)
        const FALLBACK_USER_ID = TOKEN_MAP['jd'];
        const userId = (token ? TOKEN_MAP[token] : null) || FALLBACK_USER_ID;

        if (!userId) {
            console.warn('[EmailInbound] No user resolved — ignoring');
            return;
        }

        const senderEmail = payload.From || '';
        const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1].toLowerCase() : '';
        const subject = payload.Subject || '';
        const plainBody = payload.TextBody || payload.StrippedTextReply || '';

        // Load user's Gemini API key
        const { data: settings, error: settingsErr } = await supabase
            .from('settings')
            .select('gemini_api_key')
            .eq('user_id', userId)
            .maybeSingle();

        console.log('[EmailInbound] Settings query — userId:', userId, '| data:', settings ? 'ROW RETURNED' : 'NULL', '| error:', settingsErr?.message || 'none');

        const apiKey = settings?.gemini_api_key;
        if (!apiKey) {
            console.error('[EmailInbound] No Gemini API key for user', userId, '| settingsErr:', settingsErr?.message);
            return;
        }

        // --- Step 1: Determine what to parse ---
        let extracted = null;
        let fileBuffer = null;
        let fileMime = null;
        let fileExt = 'pdf';

        const attachments = payload.Attachments || [];

        // Priority 1: Receipt PDF (prefer "Receipt*" over "Invoice*")
        const receiptPdf = attachments.find(a =>
            /^receipt/i.test(a.Name) && a.ContentType === 'application/pdf'
        );
        const invoicePdf = attachments.find(a =>
            /^invoice/i.test(a.Name) && a.ContentType === 'application/pdf'
        );
        const imagePdf = attachments.find(a =>
            a.ContentType === 'application/pdf'
        );
        const imageAttach = attachments.find(a =>
            ['image/jpeg', 'image/png'].includes(a.ContentType)
        );

        const chosenAttachment = receiptPdf || invoicePdf || imagePdf || imageAttach;

        if (chosenAttachment) {
            fileBuffer = Buffer.from(chosenAttachment.Content, 'base64');
            fileMime = chosenAttachment.ContentType;
            fileExt = chosenAttachment.Name?.split('.').pop()?.toLowerCase() || 'pdf';
            extracted = await parseReceiptFromFile(apiKey, fileBuffer, fileMime);
        }

        // Priority 2: Email body (fallback)
        if (!extracted || extracted.amount_cents == null) {
            const bodyResult = await parseReceiptFromEmailBody(apiKey, plainBody, senderDomain, subject);
            if (bodyResult) extracted = bodyResult;
        }

        // If we still have no amount, bail
        if (!extracted || extracted.amount_cents == null) {
            console.log('[EmailInbound] No amount found in email from', senderEmail, '| subject:', subject);
            const failResult = await sendReceiptConfirmationEmail({
                to: senderEmail,
                outcome: 'failed',
                subject,
            }).catch(e => ({ success: false, error: e.message }));
            console.log('[EmailInbound] Failed confirmation email result:', JSON.stringify(failResult));
            return;
        }

        // Upload file to Supabase Storage if we have one
        let storedFilePath = null;
        if (fileBuffer) {
            const d = new Date();
            const datePath = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
            const filename = `email_${Date.now()}.${fileExt}`;
            storedFilePath = `${datePath}/${filename}`;

            const { error: uploadErr } = await supabase.storage
                .from('receipts')
                .upload(storedFilePath, fileBuffer, { contentType: fileMime });

            if (uploadErr) {
                console.error('[EmailInbound] Storage upload failed:', uploadErr.message);
                storedFilePath = null;
            }
        }

        // --- Step 2: Pass 1 — match existing expense ---
        const receiptDate = extracted.date;
        const amountCents = extracted.amount_cents;

        // Build date range ±3 days
        const baseDate = new Date(receiptDate + 'T12:00:00Z');
        const dateMinus3 = new Date(baseDate); dateMinus3.setDate(baseDate.getDate() - 3);
        const datePlus3  = new Date(baseDate); datePlus3.setDate(baseDate.getDate() + 3);
        const from = dateMinus3.toISOString().slice(0, 10);
        const to   = datePlus3.toISOString().slice(0, 10);

        const { data: matches } = await supabase
            .from('expenses')
            .select('id, vendor, expense_date, amount_cents, receipt_link')
            .eq('user_id', userId)
            .eq('amount_cents', amountCents)
            .gte('expense_date', from)
            .lte('expense_date', to);

        // Separate matches into unlinked (no receipt) and already-linked (has receipt)
        const unlinked = (matches || []).filter(e => !e.receipt_link);
        const alreadyLinked = (matches || []).filter(e => e.receipt_link);

        if (unlinked.length === 1) {
            // Perfect match — attach receipt
            const match = unlinked[0];
            await supabase
                .from('expenses')
                .update({ receipt_link: storedFilePath, updated_at: new Date().toISOString() })
                .eq('id', match.id)
                .eq('user_id', userId);

            console.log(`[EmailInbound] Matched receipt to expense ${match.id} (${match.vendor} $${(amountCents / 100).toFixed(2)})`);

            sendReceiptConfirmationEmail({
                to: senderEmail,
                outcome: 'matched',
                vendor: match.vendor || extracted.vendor,
                amountCents,
                expenseDate: match.expense_date,
                expenseId: match.id,
            }).then(r => console.log('[EmailInbound] Matched confirmation sent:', JSON.stringify(r)))
              .catch(e => console.error('[EmailInbound] Matched confirmation failed:', e.message));

        } else if (unlinked.length === 0 && alreadyLinked.length > 0) {
            // Transaction exists but already has a receipt attached
            const match = alreadyLinked[0];
            console.log(`[EmailInbound] Transaction ${match.id} already has receipt — notifying sender`);
            sendReceiptConfirmationEmail({
                to: senderEmail,
                outcome: 'already_linked',
                vendor: match.vendor || extracted.vendor,
                amountCents,
                expenseDate: match.expense_date,
                expenseId: match.id,
            }).then(r => console.log('[EmailInbound] Already-linked confirmation sent:', JSON.stringify(r)))
              .catch(e => console.error('[EmailInbound] Already-linked confirmation failed:', e.message));

        } else {
            // No match or ambiguous — store as pending
            const needsReview = unlinked.length > 1;

            await supabase.from('pending_receipts').insert({
                user_id:      userId,
                vendor:       extracted.vendor,
                receipt_date: receiptDate,
                amount_cents: amountCents,
                file_path:    storedFilePath,
                raw_subject:  subject,
                raw_sender:   senderEmail,
                needs_review: needsReview,
            });

            console.log(`[EmailInbound] No match — stored pending receipt for $${(amountCents / 100).toFixed(2)} from ${extracted.vendor}`);

            sendReceiptConfirmationEmail({
                to: senderEmail,
                outcome: 'pending',
                vendor: extracted.vendor,
                amountCents,
            }).then(r => console.log('[EmailInbound] Pending confirmation sent:', JSON.stringify(r)))
              .catch(e => console.error('[EmailInbound] Pending confirmation failed:', e.message));
        }

    } catch (err) {
        console.error('[EmailInbound] Unhandled error:', err.message, err.stack);
    }
};

module.exports = handler;
