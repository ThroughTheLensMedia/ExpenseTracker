const { createClient } = require('@supabase/supabase-js');
const { parseReceiptFromEmailBody, parseReceiptFromFile } = require('../utils/receiptEmailParser');
const { sendReceiptConfirmationEmail } = require('../utils/mailer');
const log = require('../utils/logger');

// Phase 1 fallback: hardcoded token → userId for Joshua while the DB token
// system ramps up. Once all users have called GET /receipts/my-address at
// least once (which stores their token in settings), this map is never hit.
const LEGACY_TOKEN_MAP = {
    'jd': '49e7efcb-6434-4f0c-9563-3151a6d50df9',
};

/**
 * POST /api/receipts/email-inbound
 * Postmark inbound webhook. No JWT auth — protected by POSTMARK_INBOUND_TOKEN query param.
 */
const handler = async (req) => {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    try {
        const inboundToken = process.env.POSTMARK_INBOUND_TOKEN;
        const provided = req.query.token;
        if (inboundToken && provided !== inboundToken) {
            log.warn('email-inbound', 'Invalid token — request ignored', { provided: provided?.slice(0, 8) });
            return;
        }

        const payload = req.body;
        if (!payload || !payload.To) {
            log.warn('email-inbound', 'Missing payload or To field');
            return;
        }

        const toAddress = Array.isArray(payload.ToFull)
            ? payload.ToFull[0]?.Email || payload.To
            : payload.To;

        const tokenMatch = toAddress.match(/receipts\+([^@]+)@/i);
        const token = tokenMatch ? tokenMatch[1].toLowerCase() : null;

        // Phase 2: look up user by receipt_token stored in settings table
        let userId = null;
        if (token) {
            // Check DB first (Phase 2 — per-user HMAC tokens stored on first address view)
            const { data: settingsRow } = await supabase
                .from('settings')
                .select('user_id')
                .eq('receipt_token', token)
                .maybeSingle();
            if (settingsRow?.user_id) {
                userId = settingsRow.user_id;
            } else {
                // Phase 1 fallback — legacy short tokens (e.g. "jd")
                userId = LEGACY_TOKEN_MAP[token] || null;
            }
        }

        // Final fallback: no token in To address at all → default to Joshua
        if (!userId) {
            userId = LEGACY_TOKEN_MAP['jd'] || null;
        }

        if (!userId) {
            log.warn('email-inbound', 'No user resolved — ignoring', { to: toAddress });
            return;
        }

        const senderEmail = payload.From || '';
        const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1].toLowerCase() : '';
        const subject = payload.Subject || '';
        const attachments = payload.Attachments || [];

        log.info('email-inbound', 'Email received', {
            from: senderEmail,
            subject,
            attachmentCount: attachments.length,
            attachmentNames: attachments.map(a => a.Name),
            hasTextBody: !!(payload.TextBody),
            hasHtmlBody: !!(payload.HtmlBody),
        }, userId);

        // Build plain text body — prefer TextBody, fall back to HTML stripped of tags
        let plainBody = payload.TextBody || payload.StrippedTextReply || '';
        if (!plainBody && payload.HtmlBody) {
            plainBody = payload.HtmlBody
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\s{2,}/g, ' ')
                .trim();
            log.info('email-inbound', 'Using stripped HtmlBody as text fallback', { bodyLength: plainBody.length }, userId);
        }

        // Instant ack — fires before Gemini
        sendReceiptConfirmationEmail({ to: senderEmail, outcome: 'received', subject })
            .then(() => log.info('email-inbound', 'Ack email sent', { to: senderEmail }, userId))
            .catch(e => log.error('email-inbound', 'Ack email failed', { error: e.message }, userId));

        // Load user's Gemini API key
        const { data: settings, error: settingsErr } = await supabase
            .from('settings')
            .select('gemini_api_key')
            .eq('user_id', userId)
            .maybeSingle();

        if (settingsErr || !settings?.gemini_api_key) {
            log.error('email-inbound', 'No Gemini API key found', { userId, error: settingsErr?.message }, userId);
            return;
        }
        const apiKey = settings.gemini_api_key;

        // --- Step 1: Parse receipt ---
        let extracted = null;
        let fileBuffer = null;
        let fileMime = null;
        let fileExt = 'jpg';

        const receiptPdf  = attachments.find(a => /^receipt/i.test(a.Name) && a.ContentType === 'application/pdf');
        const invoicePdf  = attachments.find(a => /^invoice/i.test(a.Name) && a.ContentType === 'application/pdf');
        const anyPdf      = attachments.find(a => a.ContentType === 'application/pdf');
        const imageAttach = attachments.find(a => ['image/jpeg', 'image/png'].includes(a.ContentType));
        const chosenAttachment = receiptPdf || invoicePdf || anyPdf || imageAttach;

        if (chosenAttachment) {
            log.info('email-inbound', 'Parsing attachment via Gemini Vision', {
                name: chosenAttachment.Name,
                type: chosenAttachment.ContentType,
                sizeB64: chosenAttachment.Content?.length,
            }, userId);
            fileBuffer = Buffer.from(chosenAttachment.Content, 'base64');
            fileMime = chosenAttachment.ContentType;
            fileExt = chosenAttachment.Name?.split('.').pop()?.toLowerCase() || 'jpg';
            extracted = await parseReceiptFromFile(apiKey, fileBuffer, fileMime);
            log.info('email-inbound', 'Attachment parse result', { extracted }, userId);
        }

        if (!extracted || extracted.amount_cents == null) {
            if (!apiKey) {
                log.warn('email-inbound', 'No Gemini API key — body parse skipped', {}, userId);
            } else {
                log.info('email-inbound', 'Falling back to body parse', { bodyLength: plainBody.length }, userId);
                try {
                    const bodyResult = await parseReceiptFromEmailBody(apiKey, plainBody, senderDomain, subject);
                    log.info('email-inbound', 'Body parse result', { extracted: bodyResult }, userId);
                    if (bodyResult) extracted = bodyResult;
                } catch (parseErr) {
                    log.error('email-inbound', 'Body parse threw an error', { error: parseErr.message }, userId);
                }
            }
        }

        if (!extracted || extracted.amount_cents == null) {
            log.warn('email-inbound', 'No amount extracted — sending failed email', { from: senderEmail, subject, extracted }, userId);
            await sendReceiptConfirmationEmail({ to: senderEmail, outcome: 'failed', subject })
                .catch(e => log.error('email-inbound', 'Failed confirmation email error', { error: e.message }, userId));
            return;
        }

        // Upload file to Supabase Storage
        let storedFilePath = null;
        if (fileBuffer) {
            const d = new Date();
            const datePath = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
            storedFilePath = `${datePath}/email_${Date.now()}.${fileExt}`;
            const { error: uploadErr } = await supabase.storage
                .from('receipts')
                .upload(storedFilePath, fileBuffer, { contentType: fileMime });
            if (uploadErr) {
                log.error('email-inbound', 'Storage upload failed', { error: uploadErr.message, path: storedFilePath }, userId);
                storedFilePath = null;
            }
        }

        // --- Step 2: Match existing expense ---
        const receiptDate = extracted.date;
        const amountCents = extracted.amount_cents;
        const baseDate = new Date(receiptDate + 'T12:00:00Z');
        const dateMinus7 = new Date(baseDate); dateMinus7.setDate(baseDate.getDate() - 7);
        const datePlus7  = new Date(baseDate); datePlus7.setDate(baseDate.getDate() + 7);

        const { data: matches } = await supabase
            .from('expenses')
            .select('id, vendor, expense_date, amount_cents, receipt_link')
            .eq('user_id', userId)
            .eq('amount_cents', amountCents)
            .gte('expense_date', dateMinus7.toISOString().slice(0, 10))
            .lte('expense_date', datePlus7.toISOString().slice(0, 10));

        const unlinked     = (matches || []).filter(e => !e.receipt_link);
        const alreadyLinked = (matches || []).filter(e => e.receipt_link);

        log.info('email-inbound', 'Match query result', {
            amountCents,
            receiptDate,
            dateWindow: `${dateMinus7.toISOString().slice(0,10)} → ${datePlus7.toISOString().slice(0,10)}`,
            totalMatches: (matches || []).length,
            unlinked: unlinked.length,
            alreadyLinked: alreadyLinked.length,
        }, userId);

        if (unlinked.length === 1) {
            const match = unlinked[0];
            await supabase
                .from('expenses')
                .update({ receipt_link: storedFilePath, updated_at: new Date().toISOString() })
                .eq('id', match.id)
                .eq('user_id', userId);

            log.info('email-inbound', 'Receipt matched and attached', {
                expenseId: match.id, vendor: match.vendor, amountCents,
            }, userId);

            await sendReceiptConfirmationEmail({
                to: senderEmail, outcome: 'matched',
                vendor: match.vendor || extracted.vendor,
                amountCents, expenseDate: match.expense_date, expenseId: match.id,
            }).catch(e => log.error('email-inbound', 'Matched confirmation email failed', { error: e.message }, userId));

        } else if (unlinked.length === 0 && alreadyLinked.length > 0) {
            const match = alreadyLinked[0];
            log.info('email-inbound', 'Transaction already has receipt', { expenseId: match.id }, userId);
            await sendReceiptConfirmationEmail({
                to: senderEmail, outcome: 'already_linked',
                vendor: match.vendor || extracted.vendor,
                amountCents, expenseDate: match.expense_date, expenseId: match.id,
            }).catch(e => log.error('email-inbound', 'Already-linked confirmation email failed', { error: e.message }, userId));

        } else {
            const needsReview = unlinked.length > 1;
            await supabase.from('pending_receipts').insert({
                user_id: userId, vendor: extracted.vendor,
                receipt_date: receiptDate, amount_cents: amountCents,
                file_path: storedFilePath, raw_subject: subject,
                raw_sender: senderEmail, needs_review: needsReview,
            });

            log.info('email-inbound', 'No match — stored as pending receipt', {
                vendor: extracted.vendor, amountCents, needsReview,
            }, userId);

            await sendReceiptConfirmationEmail({
                to: senderEmail, outcome: 'pending',
                vendor: extracted.vendor, amountCents,
            }).catch(e => log.error('email-inbound', 'Pending confirmation email failed', { error: e.message }, userId));
        }

    } catch (err) {
        log.error('email-inbound', 'Unhandled error', { error: err.message, stack: err.stack });
    }
};

module.exports = handler;
