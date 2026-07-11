'use strict';

/* Programmatic A4 PDF generator for the "Download PDF" button — built on
   the jspdf + jspdf-autotable deps already in package.json. Produces a
   true multi-page A4 document with logo, low-opacity watermark, a
   repeating header/footer drawn on every page in a single post-pass
   (once the real page count is known), and an exact "Page X of Y".
   doc.save() triggers an immediate browser download — no print dialog,
   no preview tab.

   English-only: jsPDF's text() renderer draws Arabic glyphs in their
   isolated form (no contextual joining/shaping), which looks broken for
   real Arabic text. Rather than ship visually-broken Arabic PDFs, Arabic
   quotations keep using the existing browser Print path (perfect Arabic
   via real font rendering) — see the caller in print/page.js. */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const HEADER_H = 40;
const FOOTER_H = 18;
const GREEN = [70, 81, 47];
const GREY = [107, 107, 99];

const BANK_DETAILS = {
  bank: 'Alinma Bank',
  accountNumber: '68205594739000',
  iban: 'SA5105000068205594739000',
  accountName: 'Ismail Al Farooque Wooden Industries',
};

function money(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function dateStr(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB'); } catch (_) { return String(d); }
}

function loadLogo() {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), ratio: img.naturalWidth / img.naturalHeight });
      } catch (_) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });
}

export async function downloadQuotePdf({ doc: q, products, entity, customer, terms, qrDataUrl }) {
  const logo = await loadLogo();
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const eName = entity?.name_en || entity?.name_ar || '';
  const eAddr = entity?.address_en || entity?.address_ar || '';
  const cName = customer ? (customer.company_name_en || customer.company_name || customer.company_name_ar || '') : '—';

  const head = [['#', 'Description', 'Qty', 'Unit', 'Unit Price', 'VAT', 'Amount (SAR)']];
  const body = (products || []).map((p, i) => {
    const name = p.name_en || p.name_ar || p.name || '';
    const desc = p.description_en || p.description_ar || p.description || '';
    const line = desc ? name + '\n' + desc : name;
    const amt = p.line_total != null ? p.line_total : Number(p.qty) * Number(p.unit_price);
    return [String(i + 1), line, String(Number(p.qty)), p.unit || '', money(p.unit_price), p.taxable !== false ? 'T' : '—', money(amt)];
  });

  autoTable(pdf, {
    head, body,
    startY: HEADER_H + 22,
    margin: { top: HEADER_H, bottom: FOOTER_H, left: MARGIN, right: MARGIN },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, valign: 'top', lineColor: [216, 212, 204], lineWidth: 0.1, textColor: [26, 26, 24] },
    headStyles: { fillColor: GREEN, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 28, halign: 'right' },
    },
    theme: 'grid',
  });

  let y = pdf.lastAutoTable.finalY + 8;

  /* Estimate the height of the last-page-only block (totals, payment
     terms, bank details, terms & conditions, signatures) so it can be
     pushed to a fresh page as one atomic unit rather than splitting. */
  const hasPayment = !!(q.payment_terms && String(q.payment_terms).trim());
  const termsText = q.terms_body_override || (terms && terms.body) || '';
  const termsLines = termsText ? pdf.splitTextToSize(termsText, PAGE_W - MARGIN * 2) : [];
  const blockEstimate = 34 /* totals */
    + (hasPayment ? 16 : 0)
    + 22 /* bank details */
    + (termsText ? 10 + termsLines.length * 4 : 0)
    + 26 /* signatures */;
  if (y + blockEstimate > PAGE_H - FOOTER_H) {
    pdf.addPage();
    y = HEADER_H + 8;
  }

  /* Totals */
  const totalsW = 72;
  const totalsX = PAGE_W - MARGIN - totalsW;
  function totalRow(label, value, bold) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(9);
    pdf.text(label, totalsX, y);
    pdf.text(value, PAGE_W - MARGIN, y, { align: 'right' });
    y += 5.5;
  }
  totalRow('Subtotal', money(q.subtotal));
  if (Number(q.discount_amount) > 0) {
    totalRow('Discount' + (q.discount_type === 'pct' ? ' (' + Number(q.discount_value) + '%)' : ''), '−' + money(q.discount_amount));
  }
  totalRow('Net Total', money(q.net_total));
  totalRow('VAT ' + Number(q.vat_rate) + '%', money(q.vat_amount));
  pdf.setFillColor(...GREEN);
  pdf.rect(totalsX - 2, y - 4.2, totalsW + 2, 7, 'F');
  pdf.setTextColor(255, 255, 255);
  totalRow('GRAND TOTAL', money(q.grand_total) + ' SAR', true);
  pdf.setTextColor(26, 26, 24);
  y += 6;

  /* Payment Terms — only when the field is filled in, no empty heading */
  if (hasPayment) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5);
    pdf.text('Payment Terms', MARGIN, y);
    y += 4.5;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...GREY);
    const lines = pdf.splitTextToSize(String(q.payment_terms), PAGE_W - MARGIN * 2);
    pdf.text(lines, MARGIN, y);
    y += lines.length * 4 + 6;
    pdf.setTextColor(26, 26, 24);
  }

  /* Bank Details — bordered info box */
  const bankBoxH = 20;
  pdf.setDrawColor(216, 212, 204);
  pdf.rect(MARGIN, y, PAGE_W - MARGIN * 2, bankBoxH);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5);
  pdf.text('Bank Details', MARGIN + 4, y + 6);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
  pdf.text('Bank: ' + BANK_DETAILS.bank, MARGIN + 4, y + 12);
  pdf.text('Account Number: ' + BANK_DETAILS.accountNumber, MARGIN + 4, y + 17);
  pdf.text('IBAN: ' + BANK_DETAILS.iban, PAGE_W / 2, y + 12);
  pdf.text('Account Name: ' + BANK_DETAILS.accountName, PAGE_W / 2, y + 17);
  y += bankBoxH + 8;

  /* Terms & Conditions */
  if (termsText) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5);
    pdf.text('Terms & Conditions', MARGIN, y);
    y += 4.5;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...GREY);
    pdf.text(termsLines, MARGIN, y);
    y += termsLines.length * 4 + 8;
    pdf.setTextColor(26, 26, 24);
  }

  /* Signatures */
  const sigY = y + 14;
  const colW = (PAGE_W - MARGIN * 2) / 3;
  ['Prepared by', 'Approved by', 'Customer Acceptance'].forEach((label, i) => {
    const cx = MARGIN + colW * i;
    pdf.setDrawColor(140, 138, 128);
    pdf.line(cx + 6, sigY, cx + colW - 6, sigY);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...GREY);
    pdf.text(label, cx + colW / 2, sigY + 4.5, { align: 'center' });
    pdf.setTextColor(26, 26, 24);
  });

  /* Repeating header/footer/watermark + exact "Page X of Y" — drawn in
     one final pass now that the true page count is known. */
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);

    if (logo) {
      const wmH = 90, wmW = wmH * logo.ratio;
      pdf.saveGraphicsState();
      pdf.setGState(new pdf.GState({ opacity: 0.06 }));
      pdf.addImage(logo.dataUrl, 'PNG', (PAGE_W - wmW) / 2, (PAGE_H - wmH) / 2, wmW, wmH);
      pdf.restoreGraphicsState();
    }

    // Header
    let hx = MARGIN;
    if (logo) {
      const logoH = 14, logoW = logoH * logo.ratio;
      pdf.addImage(logo.dataUrl, 'PNG', MARGIN, 6, logoW, logoH);
      hx = MARGIN + logoW + 4;
    }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12.5); pdf.setTextColor(...GREEN);
    pdf.text(eName, hx, 12);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...GREY);
    pdf.text(eAddr, hx, 17);
    const contactBits = [];
    if (entity?.phone) contactBits.push('Tel: ' + entity.phone);
    if (entity?.cr_number) contactBits.push('CR: ' + entity.cr_number);
    if (entity?.vat_number) contactBits.push('VAT No.: ' + entity.vat_number);
    if (contactBits.length) pdf.text(contactBits.join('  ·  '), hx, 21.5);

    // QR code — first page only, a true third header column (reserves
    // its own width so the title/meta column never overlaps it), clean
    // white rounded card with a light-grey border and a very subtle
    // drop shadow. 36mm square is within the 35-40mm spec range.
    const qrOnThisPage = i === 1 && !!qrDataUrl;
    const qrSize = 36;
    const qrCardPad = 3;
    const qrCardW = qrSize + qrCardPad * 2;
    const titleRightEdge = qrOnThisPage ? PAGE_W - MARGIN - qrCardW - 6 : PAGE_W - MARGIN;

    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(26, 26, 24);
    pdf.text('QUOTATION', titleRightEdge, 12, { align: 'right' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...GREY);
    pdf.text('Quotation No.: ' + (q.quote_number || ''), titleRightEdge, 17, { align: 'right' });
    pdf.text('Date: ' + dateStr(q.quote_date) + '   Customer: ' + cName, titleRightEdge, 21.5, { align: 'right' });

    if (qrOnThisPage) {
      const cardX = PAGE_W - MARGIN - qrCardW;
      const cardY = 6;
      const cardH = qrSize + qrCardPad * 2 + 5; // + room for the caption below
      pdf.setFillColor(210, 208, 202);
      pdf.roundedRect(cardX + 0.6, cardY + 0.6, qrCardW, cardH, 2, 2, 'F'); // subtle shadow
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(220, 217, 210);
      pdf.roundedRect(cardX, cardY, qrCardW, cardH, 2, 2, 'FD');
      pdf.addImage(qrDataUrl, 'PNG', cardX + qrCardPad, cardY + qrCardPad, qrSize, qrSize);
      pdf.setFontSize(6); pdf.setTextColor(...GREY);
      pdf.text('Scan to Verify', cardX + qrCardW / 2, cardY + qrCardPad + qrSize + 3.5, { align: 'center' });
      pdf.setTextColor(26, 26, 24);
    }

    pdf.setDrawColor(...GREEN); pdf.setLineWidth(0.6);
    pdf.line(MARGIN, HEADER_H - 4, PAGE_W - MARGIN, HEADER_H - 4);
    pdf.setLineWidth(0.1);

    // Footer
    pdf.setDrawColor(216, 212, 204);
    pdf.line(MARGIN, PAGE_H - FOOTER_H + 2, PAGE_W - MARGIN, PAGE_H - FOOTER_H + 2);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.2); pdf.setTextColor(...GREY);
    const footerLine1 = [eName, eAddr, entity?.cr_number && ('CR: ' + entity.cr_number), entity?.vat_number && ('VAT No.: ' + entity.vat_number)]
      .filter(Boolean).join('  ·  ');
    const footerLine2 = [entity?.phone, entity?.email, entity?.website].filter(Boolean).join('  ·  ');
    pdf.text(footerLine1, PAGE_W / 2, PAGE_H - FOOTER_H + 7, { align: 'center' });
    if (footerLine2) pdf.text(footerLine2, PAGE_W / 2, PAGE_H - FOOTER_H + 11, { align: 'center' });
    pdf.text('Page ' + i + ' of ' + totalPages, PAGE_W / 2, PAGE_H - 4, { align: 'center' });
    pdf.setTextColor(26, 26, 24);
  }

  pdf.save((q.quote_number || 'quotation') + '.pdf');
}
