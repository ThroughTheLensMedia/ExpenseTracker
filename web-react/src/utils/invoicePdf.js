import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Control characters are deliberately removed from downloaded filenames.
export const invoiceFilename = (client, number) =>
    // eslint-disable-next-line no-control-regex
    `${client || 'Client'} (#${number || 'Invoice'})`.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').trim().slice(0, 180) + '.pdf';

// Suppress only identical text; never infer whether differently worded terms are redundant.
export function distinctTerms(notes, terms) {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    return Boolean(normalize(terms)) && normalize(notes) !== normalize(terms);
}

async function loadLogo(url) {
    if (!url) return null;
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        const timer = setTimeout(() => reject(new Error('Logo could not be loaded')), 10000);
        image.onload = () => {
            clearTimeout(timer);
            try {
                const canvas = document.createElement('canvas');
                const ratio = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
                canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
                canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve({ data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
            } catch (error) { reject(error); }
        };
        image.onerror = () => { clearTimeout(timer); reject(new Error('Logo could not be loaded')); };
        image.src = url;
    });
}

/** Presentation only: uses the preview's existing normalized amounts without recalculation. */
export async function buildInvoicePdf(data, settings = {}, includeTerms = true) {
    const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
    pdf.setProperties({ title: invoiceFilename(data.clientName, data.number).replace(/\.pdf$/, ''), author: settings.business_name || '' });
    const margin = 36;
    const width = 540;
    const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    const date = value => {
        if (!value) return 'Day of Photoshoot';
        // Date-only invoice fields must not shift backwards in western time zones.
        const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
        return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-US');
    };
    let y = margin;
    const logo = await loadLogo(settings.logo_url);
    if (logo) {
        const scale = Math.min(140 / logo.width, 48 / logo.height);
        pdf.addImage(logo.data, 'PNG', margin, y, logo.width * scale, logo.height * scale);
        y += logo.height * scale + 10;
    }
    pdf.setTextColor(25);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    const business = pdf.splitTextToSize(settings.business_name || 'Your Business Name', 340);
    pdf.text(business, margin, y + 16);
    pdf.setFontSize(22);
    pdf.text('INVOICE', 576, margin + 22, { align: 'right' });
    y += business.length * 19 + 12;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const details = [settings.studio_address, settings.tax_id && `Tax ID: ${settings.tax_id}`].filter(Boolean).join('\n');
    if (details) {
        const lines = pdf.splitTextToSize(details, width);
        pdf.text(lines, margin, y);
        y += lines.length * 11 + 10;
    }
    const table = (options) => {
        autoTable(pdf, {
            startY: y, margin: { left: margin, right: margin, top: margin, bottom: 48 },
            theme: 'plain', styles: { font: 'helvetica', fontSize: 10, textColor: 30, cellPadding: 5, overflow: 'linebreak' },
            ...options,
        });
        y = pdf.lastAutoTable.finalY + 14;
    };
    table({ body: [[
        ['BILL TO', data.clientName, data.clientEmail, data.clientPhone].filter(Boolean).join('\n'),
        `Invoice No.  ${data.number}\nIssued  ${date(data.date)}\nDue  ${date(data.dueDate)}`,
    ]], columnStyles: { 0: { cellWidth: 315 }, 1: { halign: 'right' } } });
    table({
        theme: 'plain', head: [['SERVICE DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL']],
        headStyles: { fillColor: [45, 45, 45], textColor: 255, fontSize: 9 },
        body: data.items.map(item => [item.description, item.quantity > 0 ? item.quantity : '', item.quantity > 0 ? money(item.unit_price) : '', item.quantity > 0 ? money(item.unit_price * item.quantity) : '']),
        styles: { fontSize: 10, cellPadding: 8, lineWidth: 0, textColor: 30 },
        columnStyles: { 0: { cellWidth: 300 }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 100, halign: 'center' }, 3: { cellWidth: 100, halign: 'center' } },
        didParseCell: cell => {
            if (cell.column.index > 0) cell.cell.styles.halign = 'center';
        },
        rowPageBreak: 'avoid',
    });
    const totals = [['Subtotal', money(data.subtotal)]];
    if (data.discountPercent > 0) totals.push([`Discount (${data.discountPercent}%)`, `-${money(data.discount)}`]);
    if (data.tax_percent > 0) totals.push([`Tax (${data.tax_percent}%)`, money(data.taxVal)]);
    totals.push(['TOTAL DUE', money(data.total)]);
    table({ body: totals, tableWidth: 240, margin: { left: 336, right: margin, top: margin, bottom: 48 }, pageBreak: 'avoid', columnStyles: { 1: { halign: 'right' } }, didParseCell: cell => {
        if (cell.row.index === totals.length - 1) { cell.cell.styles.fontStyle = 'bold'; cell.cell.styles.fontSize = 13; }
    } });
    const section = (title, content) => {
        if (!content) return;
        table({ head: [[title]], body: [[content]], headStyles: { fontStyle: 'bold', textColor: 30, fillColor: false }, rowPageBreak: 'auto' });
    };
    section('NOTES', data.notes);
    if (data.attachment && /^https?:\/\//i.test(data.attachment.url)) {
        if (y > 725) { pdf.addPage(); y = margin; }
        pdf.setFontSize(10);
        pdf.setTextColor(30, 70, 120);
        const lines = pdf.splitTextToSize(`View ${data.attachment.name}`, width);
        for (const line of lines) {
            if (y > 725) { pdf.addPage(); y = margin; }
            pdf.textWithLink(line, margin + 5, y, { url: data.attachment.url });
            y += 12;
        }
        y += 12;
    }
    if (includeTerms && distinctTerms(data.notes, settings.standard_terms)) section('TERMS', settings.standard_terms);
    section('PAYMENT INSTRUCTIONS', settings.payment_methods);
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
        pdf.setPage(page);
        pdf.setDrawColor(210);
        pdf.line(margin, 751, 576, 751);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(80);
        const footer = [settings.business_name, settings.website, settings.business_email || settings.contact_email || settings.email].filter(Boolean).join(' | ');
        const lines = pdf.splitTextToSize(footer, 465);
        pdf.text(lines.slice(0, 2), margin, 763);
        pdf.text(`${page} / ${pages}`, 576, 763, { align: 'right' });
    }
    return pdf;
}
