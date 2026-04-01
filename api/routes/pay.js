const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { sendInvoiceApprovalEmail } = require('../utils/mailer');

/**
 * GET /api/pay/:token
 * Public — no auth required.
 * Returns invoice details + photographer's payment handles so the client can pay.
 */
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Fetch invoice by payment token (uses service role so no RLS restriction)
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, clients(*), invoice_items(*)')
            .eq('payment_token', token)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: 'Invoice not found or payment link has expired.' });
        }

        // Don't allow paying a voided or already-signed invoice
        if (invoice.status === 'void') {
            return res.status(410).json({ error: 'This invoice has been voided.' });
        }
        if (invoice.customer_signed_at) {
            return res.status(409).json({ error: 'This invoice has already been approved.', signed_at: invoice.customer_signed_at });
        }

        // Fetch photographer's settings (payment handles, business name, email)
        // We find the settings row belonging to the invoice owner (user_id)
        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, venmo_handle, zelle_handle, cashapp_tag, stripe_publishable_key, logo_url, phone, website')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        // Return safe public payload — no secret keys, no internal IDs beyond what's needed
        res.json({
            invoice: {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                issue_date: invoice.issue_date,
                due_date: invoice.due_date,
                status: invoice.status,
                notes: invoice.notes,
                tax_percent: invoice.tax_percent,
                discount_cents: invoice.discount_cents,
                photographer_signed: invoice.photographer_signed,
                customer_signed_at: invoice.customer_signed_at,
                client: {
                    name: invoice.clients?.name,
                    email: invoice.clients?.email,
                },
                items: (invoice.invoice_items || []).map(it => ({
                    description: it.description,
                    quantity: it.quantity,
                    unit_price_cents: it.unit_price_cents,
                })),
            },
            studio: {
                business_name: settings?.business_name || 'Your Photographer',
                email: settings?.email || null,
                phone: settings?.phone || null,
                website: settings?.website || null,
                logo_url: settings?.logo_url || null,
                venmo_handle: settings?.venmo_handle || null,
                zelle_handle: settings?.zelle_handle || null,
                cashapp_tag: settings?.cashapp_tag || null,
                stripe_publishable_key: settings?.stripe_publishable_key || null,
            }
        });

    } catch (e) {
        console.error('[PAY] GET error:', e);
        res.status(500).json({ error: 'Unable to load invoice.' });
    }
});

/**
 * POST /api/pay/:token
 * Public — no auth required.
 * Accepts customer e-signature. Stores signature and notifies photographer.
 */
router.post('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { signature } = req.body;

        if (!signature || signature.trim().length < 2) {
            return res.status(400).json({ error: 'A valid full name is required to approve this invoice.' });
        }

        // Fetch invoice to validate it's still signable
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, clients(*), invoice_items(*)')
            .eq('payment_token', token)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }
        if (invoice.status === 'void') {
            return res.status(410).json({ error: 'This invoice has been voided and cannot be approved.' });
        }
        if (invoice.customer_signed_at) {
            return res.status(409).json({ error: 'This invoice has already been approved.' });
        }

        const signedAt = new Date().toISOString();

        // Save signature to invoice — status remains 'sent' (photographer confirms manually)
        const { error: updateError } = await supabase
            .from('invoices')
            .update({
                customer_signature: signature.trim(),
                customer_signed_at: signedAt,
                updated_at: signedAt,
            })
            .eq('id', invoice.id);

        if (updateError) throw updateError;

        // Calculate total for the notification email
        const subtotalCents = (invoice.invoice_items || []).reduce(
            (s, it) => s + (it.unit_price_cents * it.quantity), 0
        );
        const taxCents = Math.round(subtotalCents * ((invoice.tax_percent || 0) / 100));
        const discountAmt = Math.round(subtotalCents * ((invoice.discount_cents || 0) / 100));
        const totalCents = subtotalCents + taxCents - discountAmt;

        // Fetch photographer's business email + payment handles for notification
        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, venmo_handle, zelle_handle, cashapp_tag')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        const studioEmail = settings?.email;

        if (studioEmail) {
            await sendInvoiceApprovalEmail({
                to: studioEmail,
                studioName: settings?.business_name || 'Studio Tracker',
                clientName: invoice.clients?.name || 'Your Client',
                clientEmail: invoice.clients?.email || '',
                invoiceNumber: invoice.invoice_number,
                totalCents,
                signedAt,
                customerSignature: signature.trim(),
                paymentHandles: {
                    venmo: settings?.venmo_handle,
                    zelle: settings?.zelle_handle,
                    cashapp: settings?.cashapp_tag,
                },
                invoiceId: invoice.id,
            });
        } else {
            console.warn(`[PAY] No business email on file for invoice ${invoice.id} — approval notification skipped.`);
        }

        res.json({
            ok: true,
            message: 'Invoice approved successfully. Your photographer has been notified.',
            signed_at: signedAt,
        });

    } catch (e) {
        console.error('[PAY] POST error:', e);
        res.status(500).json({ error: 'Failed to process approval. Please try again.' });
    }
});

module.exports = router;
