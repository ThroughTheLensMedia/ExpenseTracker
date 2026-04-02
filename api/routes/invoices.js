const express = require("express");
const z = require("zod");
const { randomUUID } = require('crypto');

const router = express.Router();
const { sendInvoiceEmail } = require("../utils/mailer");

const ClientSchema = z.object({
    name: z.string().trim().min(1),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
});

const InvoiceItemSchema = z.object({
    description: z.string().min(1),
    quantity: z.number().default(1),
    unit_price_cents: z.number().int(),
});

const InvoiceSchema = z.object({
    client_id: z.coerce.number().int(),
    invoice_number: z.string().min(1),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    status: z.enum(["draft", "sent", "paid", "void"]).default("draft"),
    notes: z.string().optional().nullable(),
    tax_percent: z.number().min(0).max(100).default(0),
    discount_cents: z.number().int().default(0),
    lead_id: z.coerce.number().int().optional().nullable(),
    items: z.array(InvoiceItemSchema).min(1),
});

// --- CLIENTS ---

router.get("/clients", async (req, res) => {
    try {
        const { data, error } = await req.sb.from("clients").select("*").order("name");
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post("/clients", async (req, res) => {
    try {
        const body = ClientSchema.parse(req.body);
        const { data, error } = await req.sb.from("clients").insert(body).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// --- INVOICES ---

router.get("/", async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from("invoices")
            .select("*, clients(name, email), invoice_items(*)")
            .order("issue_date", { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from("invoices")
            .select("*, clients(*), invoice_items(*)")
            .eq("id", req.params.id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(404).json({ error: "Invoice not found" });
    }
});

router.post("/", async (req, res) => {
    try {
        const body = InvoiceSchema.parse(req.body);
        const { items, ...invoiceData } = body;

        // 1. Insert Invoice
        const { data: invoice, error: invError } = await req.sb
            .from("invoices")
            .insert(invoiceData)
            .select()
            .single();

        if (invError) throw invError;

        if (!invoice) throw new Error("Database failed to return the new invoice record.");

        // 2. Insert Items
        const itemsWithId = items.map(item => ({ ...item, invoice_id: invoice.id }));
        const { error: itemsError } = await req.sb.from("invoice_items").insert(itemsWithId);

        if (itemsError) {
            console.error("Item insertion error:", itemsError);
            throw itemsError;
        }

        res.json(invoice);
    } catch (e) {
        console.error("CREATE INVOICE ERROR:", e);
        res.status(400).json({ error: e.message || "Unknown error creating invoice" });
    }
});

router.patch("/:id", async (req, res) => {
    try {
        const { items, pdf_base64, ...invoiceData } = req.body;
        if (pdf_base64) {
            console.log(`[INVOICE] Payload received. PDF Attachment Size: ${(pdf_base64.length / 1024).toFixed(2)} KB`);
        }

        // 1. Update Invoice Metadata
        const { data: invoice, error: invError } = await req.sb
            .from("invoices")
            .update({ ...invoiceData, updated_at: new Date() })
            .eq("id", req.params.id)
            .select()
            .single();

        if (invError) {
            console.error("Supabase Update Error:", invError);
            throw invError;
        }

        // 2. Handle Items if provided (Replace old items with new ones for simplicity in edits)
        if (items && Array.isArray(items)) {
            // Delete old items
            await req.sb.from("invoice_items").delete().eq("invoice_id", req.params.id);
            // Insert new items
            const itemsWithId = items.map(item => ({ ...item, invoice_id: req.params.id }));
            const { error: itemsError } = await req.sb.from("invoice_items").insert(itemsWithId);
            if (itemsError) throw itemsError;
        }

        // 3. Trigger Email if status changed to 'sent'
        if (invoiceData.status === 'sent') {
            // Generate a unique payment token if one doesn't exist yet
            let paymentToken = invoice.payment_token;
            if (!paymentToken) {
                paymentToken = randomUUID();
                await req.sb
                    .from('invoices')
                    .update({ payment_token: paymentToken })
                    .eq('id', req.params.id);
            }

            const [{ data: fullInvoice }, { data: settings }] = await Promise.all([
                req.sb
                    .from('invoices')
                    .select('*, clients(*), invoice_items(*)')
                    .eq('id', req.params.id)
                    .single(),
                req.sb
                    .from('settings')
                    .select('business_name, email, logo_url, phone, website, invoice_notes')
                    .maybeSingle()
            ]);

            const studioName = settings?.business_name || 'Your Photographer';
            const studioEmail = settings?.email || null;
            const appUrl = process.env.APP_URL || 'https://app.throughthelens.media';
            const payUrl = `${appUrl}/pay/${paymentToken}`;

            if (fullInvoice && fullInvoice.clients?.email) {
                const allItems = fullInvoice.invoice_items || [];
                const subtotalCents = allItems.reduce((s, it) => s + (it.unit_price_cents * it.quantity), 0);
                const taxCents = Math.round(subtotalCents * ((fullInvoice.tax_percent || 0) / 100));
                const discountPercent = (fullInvoice.discount_cents || 0) / 100;
                const discountAmt = Math.round(subtotalCents * (discountPercent / 100));
                const totalCents = subtotalCents + taxCents - discountAmt;
                const totalDollars = (totalCents / 100).toFixed(2);

                const formatMoney = cents => '$' + (cents / 100).toFixed(2);
                const formatDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Day of Shoot';

                // Build inline line items table — skip items with no qty
                const itemRowsHtml = allItems
                    .map(it => it.quantity > 0 ? `
                        <tr>
                          <td style="padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; color:#1e293b;">${it.description}</td>
                          <td style="padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; color:#64748b; text-align:center;">${it.quantity}</td>
                          <td style="padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; color:#64748b; text-align:right;">${formatMoney(it.unit_price_cents)}</td>
                          <td style="padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; font-weight:700; color:#1e293b; text-align:right;">${formatMoney(it.unit_price_cents * it.quantity)}</td>
                        </tr>` : `
                        <tr>
                          <td colspan="4" style="padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:14px; color:#64748b; font-style:italic;">${it.description}</td>
                        </tr>`).join('');

                let rawInvoiceNotes = fullInvoice.notes || '';
                let extAttName = '';
                let extAttUrl = '';
                const match = rawInvoiceNotes.match(/---ATTACHMENT---\nName: (.*)\nURL: (.*)/);
                if (match) {
                    rawInvoiceNotes = rawInvoiceNotes.replace(match[0], '').trim();
                    extAttName = match[1];
                    extAttUrl = match[2];
                }

                const formatNotes = text => text ? text.replace(/\n/g, '<br/>') : '';
                const combinedNotes = [settings?.invoice_notes, rawInvoiceNotes].filter(Boolean).map(formatNotes).join('<br/><br/>');

                const attachmentHtml = extAttUrl 
                    ? `<div style="margin-top:16px;">
                           <a href="${extAttUrl}" target="_blank" style="display:inline-block; background:#fff; color:#f97316; padding:10px 16px; border-radius:8px; font-weight:700; font-size:13px; text-decoration:none; border:1px solid #f97316;">
                             📄 View ${extAttName}
                           </a>
                       </div>`
                    : '';

                const notesHtml = (combinedNotes || attachmentHtml)
                    ? `<div style="margin-top:24px; padding:20px; background:#f8fafc; border-radius:10px; border-left:3px solid #f97316;">
                         <div style="font-size:11px; font-weight:800; color:#f97316; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">Notes from Your Photographer</div>
                         ${combinedNotes ? `<p style="margin:0; font-size:14px; color:#475569; line-height:1.6;">${combinedNotes}</p>` : ''}
                         ${attachmentHtml}
                       </div>`
                    : '';

                let logoUrlImg = settings?.logo_url;
                if (logoUrlImg && logoUrlImg.startsWith('/')) {
                    logoUrlImg = appUrl + logoUrlImg;
                }
                const logoHtml = logoUrlImg
                    ? `<img src="${logoUrlImg}" alt="${studioName}" style="max-height:60px; max-width:180px; object-fit:contain; margin-bottom:8px;">`
                    : `<div style="font-size:20px; font-weight:900; color:#1e293b; letter-spacing:-0.02em;">${studioName}</div>`;

                const emailBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px; margin:0 auto; padding:40px 20px;">

    <!-- Studio header -->
    <div style="text-align:center; margin-bottom:32px;">
      ${logoHtml}
      <div style="height:2px; width:40px; background:#f97316; margin:12px auto 0;"></div>
    </div>

    <!-- Greeting -->
    <p style="font-size:16px; color:#334155; margin:0 0 20px;">Hi ${fullInvoice.clients.name},</p>
    <p style="font-size:15px; color:#475569; margin:0 0 28px; line-height:1.6;">
      Your invoice from <strong>${studioName}</strong> is ready. Please review the details below and click <strong>Pay Now</strong> to submit your approval and payment.
    </p>

    <!-- Invoice card -->
    <div style="background:#fff; border-radius:16px; padding:28px; box-shadow:0 2px 12px rgba(0,0,0,0.06); margin-bottom:24px;">
      <table style="width:100%; margin-bottom:20px; padding-bottom:16px; border-bottom:2px solid #f1f5f9; border-collapse:collapse;">
        <tr>
          <td style="text-align:left; vertical-align:top;">
            <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">Invoice Number</div>
            <div style="font-size:20px; font-weight:900; color:#1e293b;">#${fullInvoice.invoice_number}</div>
          </td>
          <td style="text-align:right; vertical-align:top;">
            <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">Due Date</div>
            <div style="font-size:15px; font-weight:700; color:#1e293b;">${formatDate(fullInvoice.due_date)}</div>
          </td>
        </tr>
      </table>

      <!-- Line items -->
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="text-align:left; padding:8px 0; font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; font-weight:800; width:50%;">Description</th>
            <th style="text-align:center; padding:8px 0; font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; font-weight:800; width:10%;">Qty</th>
            <th style="text-align:right; padding:8px 0; font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; font-weight:800; width:20%;">Price</th>
            <th style="text-align:right; padding:8px 0; font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; font-weight:800; width:20%;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRowsHtml}</tbody>
      </table>

      <!-- Totals -->
      <table style="width:100%; margin-top:20px; padding-top:16px; border-top:2px solid #f1f5f9; border-collapse:collapse;">
        ${taxCents > 0 ? `<tr><td style="font-size:13px; color:#94a3b8; padding-bottom:6px;">Tax (${fullInvoice.tax_percent}%)</td><td style="font-size:13px; color:#94a3b8; text-align:right; padding-bottom:6px;">${formatMoney(taxCents)}</td></tr>` : ''}
        ${discountAmt > 0 ? `<tr><td style="font-size:13px; color:#94a3b8; padding-bottom:6px;">Discount</td><td style="font-size:13px; color:#94a3b8; text-align:right; padding-bottom:6px;">-${formatMoney(discountAmt)}</td></tr>` : ''}
        <tr>
          <td style="font-size:18px; font-weight:900; color:#1e293b; padding-top:8px;">Total Due</td>
          <td style="font-size:18px; font-weight:900; color:#f97316; text-align:right; padding-top:8px;">$${totalDollars}</td>
        </tr>
      </table>

      ${notesHtml}
    </div>

    <!-- Pay Now CTA -->
    <div style="text-align:center; margin-bottom:32px;">
      <a href="${payUrl}" style="display:inline-block; background:#f97316; color:#fff; padding:18px 48px; border-radius:12px; font-weight:900; font-size:16px; text-decoration:none; letter-spacing:0.02em;">Pay Now &rarr;</a>
      <p style="font-size:12px; color:#94a3b8; margin:12px 0 0;">Or paste this link in your browser:<br><span style="color:#64748b;">${payUrl}</span></p>
    </div>

    <!-- Footer -->
    <div style="text-align:center; padding-top:24px; border-top:1px solid #e2e8f0;">
      <p style="font-size:12px; color:#94a3b8; margin:0;">${studioName}${settings?.email ? ` &middot; ${settings.email}` : ''}${settings?.phone ? ` &middot; ${settings.phone}` : ''}</p>
      <p style="font-size:11px; color:#cbd5e1; margin:8px 0 0;">This invoice was sent via Studio Tracker</p>
    </div>
  </div>
</body>
</html>`;

                const emailAttachments = [];
                if (req.body.pdf_base64) {
                    emailAttachments.push({
                        filename: `Invoice_${fullInvoice.invoice_number}.pdf`,
                        content: req.body.pdf_base64
                    });
                }

                const result = await sendInvoiceEmail({
                    to: fullInvoice.clients.email,
                    subject: `Invoice #${fullInvoice.invoice_number} from ${studioName} — $${totalDollars} Due`,
                    body: emailBody,
                    attachments: emailAttachments
                });

                if (!result.success) {
                    throw new Error(`Email failed: ${result.error}`);
                }
            } else if (invoiceData.status === 'sent') {
                throw new Error('Cannot send invoice: Client email is missing.');
            }
        }

        res.json(invoice);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const { error } = await req.sb.from("invoices").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
