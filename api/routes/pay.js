const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { sendInvoiceApprovalEmail } = require('../utils/mailer');
const { decryptOrPlain } = require('../utils/cryptoUtil');
const Stripe = require('stripe');

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

        // Don't allow paying a voided invoice
        if (invoice.status === 'void') {
            return res.status(410).json({ error: 'This invoice has been voided.' });
        }
        if (invoice.customer_signed_at) {
            return res.status(409).json({ error: 'This invoice has already been approved.', signed_at: invoice.customer_signed_at });
        }

        // Fetch photographer's settings (payment handles, business name, email)
        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, venmo_handle, zelle_handle, cashapp_tag, stripe_publishable_key, logo_url, phone, website')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        let hasStripe = false;
        if (settings?.stripe_publishable_key) {
            try {
                const rawKey = await decryptOrPlain(settings.stripe_publishable_key);
                const stripeKey = typeof rawKey === 'string' ? rawKey.trim() : '';
                hasStripe = Boolean(stripeKey && (stripeKey.startsWith('rk_') || stripeKey.startsWith('sk_')));
            } catch (err) {
                console.error('[PAY] Stripe key decrypt error:', err);
            }
        }

        // Return safe public payload — no secret keys exposed to browser
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
                has_stripe: hasStripe,
            }
        });

    } catch (e) {
        console.error('[PAY] GET error:', e);
        res.status(500).json({ error: 'Unable to load invoice.' });
    }
});

/**
 * POST /api/pay/:token/checkout
 * Public — creates a dynamic Stripe Checkout Session for the exact invoice balance.
 */
router.post('/:token/checkout', async (req, res) => {
    try {
        const { token } = req.params;

        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, clients(*), invoice_items(*)')
            .eq('payment_token', token)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }
        if (invoice.status === 'void') {
            return res.status(410).json({ error: 'This invoice has been voided.' });
        }
        if (invoice.status === 'paid' || invoice.customer_signed_at) {
            return res.status(409).json({ error: 'This invoice has already been approved and paid.' });
        }

        // Fetch photographer's Stripe key from settings
        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, stripe_publishable_key')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        if (!settings?.stripe_publishable_key) {
            return res.status(400).json({ error: 'Online card payments are not configured for this business.' });
        }

        const stripeKey = await decryptOrPlain(settings.stripe_publishable_key);
        if (!stripeKey || (!stripeKey.startsWith('rk_') && !stripeKey.startsWith('sk_'))) {
            return res.status(400).json({ error: 'Stripe is not fully configured. Please ensure a valid Stripe Secret or Restricted Key is saved in Studio Settings.' });
        }

        const userStripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

        // Calculate totals
        const billedItems = (invoice.invoice_items || []).filter(it => it.quantity > 0);
        const subtotalCents = billedItems.reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
        const taxCents = Math.round(subtotalCents * ((invoice.tax_percent || 0) / 100));
        const discountPct = (invoice.discount_cents || 0) / 10000;
        const discountAmt = Math.round(subtotalCents * discountPct);
        const totalCents = subtotalCents + taxCents - discountAmt;

        if (totalCents <= 0) {
            return res.status(400).json({ error: 'Invoice total must be greater than $0 to pay online.' });
        }

        const appUrl = process.env.APP_URL || 'https://www.lumiereledger.com';

        // Clean itemized breakdown for Stripe Checkout
        let line_items = [];
        if (discountAmt > 0) {
            // When a discount is applied, lump sum with itemized description guarantees penny-perfect balance
            line_items = [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Invoice #${invoice.invoice_number} — ${settings.business_name || 'Services'}`,
                            description: billedItems.map(it => `${it.quantity}x ${it.description}`).join(' • ') + (taxCents > 0 ? ` + Tax (${invoice.tax_percent}%)` : '') + ` (Discount applied)`,
                        },
                        unit_amount: totalCents,
                    },
                    quantity: 1,
                }
            ];
        } else {
            // Full professional line-item breakdown
            line_items = billedItems.map(it => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: it.description || 'Service item',
                    },
                    unit_amount: it.unit_price_cents,
                },
                quantity: it.quantity,
            }));

            if (taxCents > 0) {
                line_items.push({
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Sales Tax (${invoice.tax_percent}%)`,
                        },
                        unit_amount: taxCents,
                    },
                    quantity: 1,
                });
            }
        }

        // Create Checkout Session directly in the photographer's Stripe account
        const session = await userStripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: invoice.clients?.email || undefined,
            client_reference_id: invoice.id,
            metadata: {
                invoice_id: invoice.id,
                invoice_number: String(invoice.invoice_number),
                payment_token: token,
            },
            line_items,
            success_url: `${appUrl}/pay/${token}?session_id={CHECKOUT_SESSION_ID}&paid=1`,
            cancel_url: `${appUrl}/pay/${token}`,
        });

        res.json({ url: session.url });

    } catch (e) {
        console.error('[PAY] Stripe checkout error:', e);
        res.status(500).json({ error: e.message || 'Failed to initialize card checkout.' });
    }
});

/**
 * POST /api/pay/:token/verify-session
 * Public — verifies Stripe payment upon client return, marks invoice as paid, and notifies photographer.
 */
router.post('/:token/verify-session', async (req, res) => {
    try {
        const { token } = req.params;
        const { session_id } = req.body;

        if (!session_id) {
            return res.status(400).json({ error: 'Session ID is required.' });
        }

        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, clients(*), invoice_items(*)')
            .eq('payment_token', token)
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }

        // If already marked signed & paid, return success idempotently
        if (invoice.customer_signed_at) {
            return res.json({ ok: true, already_signed: true, signed_at: invoice.customer_signed_at });
        }

        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, stripe_publishable_key')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        const stripeKey = await decryptOrPlain(settings?.stripe_publishable_key);
        if (!stripeKey) {
            return res.status(400).json({ error: 'Studio payment configuration missing.' });
        }

        const userStripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
        const session = await userStripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment has not been completed.' });
        }

        const signedAt = new Date().toISOString();
        const customerName = session.customer_details?.name || invoice.clients?.name || 'Client';

        // Update invoice to paid
        const { error: updateError } = await supabase
            .from('invoices')
            .update({
                customer_signature: customerName,
                customer_signed_at: signedAt,
                status: 'paid',
                updated_at: signedAt,
            })
            .eq('id', invoice.id);

        if (updateError) throw updateError;

        // Calculate totals for email
        const subtotalCents = (invoice.invoice_items || []).reduce(
            (s, it) => s + (it.unit_price_cents * it.quantity), 0
        );
        const taxCents = Math.round(subtotalCents * ((invoice.tax_percent || 0) / 100));
        const discountPct = (invoice.discount_cents || 0) / 10000;
        const discountAmt = Math.round(subtotalCents * discountPct);
        const totalCents = subtotalCents + taxCents - discountAmt;

        if (settings?.email) {
            let extEventName = '';
            const displayNotes = invoice.notes || '';
            const metaMatch = displayNotes.match(/---METADATA---\nEventName: (.*)\nEventType: (.*)/);
            if (metaMatch) {
                extEventName = metaMatch[1];
            }

            await sendInvoiceApprovalEmail({
                to: settings.email,
                studioName: settings.business_name || 'Lumière Ledger',
                clientName: invoice.clients?.name || customerName,
                clientEmail: invoice.clients?.email || session.customer_details?.email || '',
                invoiceNumber: invoice.invoice_number,
                eventName: extEventName,
                totalCents,
                signedAt,
                customerSignature: `${customerName} (Paid via Stripe)`,
                paymentHandles: {
                    stripe: 'Paid with Card via Stripe Checkout',
                },
                invoiceId: invoice.id,
            });
        }

        res.json({
            ok: true,
            message: 'Payment received and verified successfully.',
            signed_at: signedAt,
            customer_signature: customerName,
        });

    } catch (e) {
        console.error('[PAY] verify-session error:', e);
        res.status(500).json({ error: e.message || 'Failed to verify payment session.' });
    }
});

/**
 * POST /api/pay/:token
 * Public — manual customer e-signature approval for peer-to-peer / cash payments.
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

        // Save signature to invoice — status remains 'sent' (photographer confirms manual payments)
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
        const discountPct = (invoice.discount_cents || 0) / 10000;
        const discountAmt = Math.round(subtotalCents * discountPct);
        const totalCents = subtotalCents + taxCents - discountAmt;

        // Fetch photographer's business email + payment handles for notification
        const { data: settings } = await supabase
            .from('settings')
            .select('business_name, email, venmo_handle, zelle_handle, cashapp_tag, stripe_publishable_key')
            .eq('user_id', invoice.user_id)
            .maybeSingle();

        const studioEmail = settings?.email;

        if (studioEmail) {
            let extEventName = '';
            const displayNotes = invoice.notes || '';
            const metaMatch = displayNotes.match(/---METADATA---\nEventName: (.*)\nEventType: (.*)/);
            if (metaMatch) {
                extEventName = metaMatch[1];
            }

            await sendInvoiceApprovalEmail({
                to: studioEmail,
                studioName: settings?.business_name || 'Lumière Ledger',
                clientName: invoice.clients?.name || 'Your Client',
                clientEmail: invoice.clients?.email || '',
                invoiceNumber: invoice.invoice_number,
                eventName: extEventName,
                totalCents,
                signedAt,
                customerSignature: signature.trim(),
                paymentHandles: {
                    venmo: settings?.venmo_handle,
                    zelle: settings?.zelle_handle,
                    cashapp: settings?.cashapp_tag,
                    stripe: settings?.stripe_publishable_key ? 'Online Card Payments (Stripe)' : null,
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
