'use strict';

/* Programmatic A4 PDF generator for the "Download PDF" button — built on
   the jspdf + jspdf-autotable deps already in package.json. Produces a
   true multi-page A4 document with logo, low-opacity watermark, a
   repeating header/footer drawn on every page in a single post-pass
   (once the real page count is known), and an exact "Page X of Y".
   doc.save() triggers an immediate browser download — no print dialog,
   no preview tab.

   ONE shared layout for both languages — English and Arabic use the
   exact same geometry (margins, header/footer height, QR size/position,
   watermark, table columns, totals/bank/terms/signature blocks). The
   only difference is text: plain Latin strings still go through
   jsPDF's native text() (fast, vector), while any string containing
   Arabic is rendered once to a small PNG via the browser's own Canvas
   2D text shaping (lib/pdf/arabicText.js) and embedded as an image —
   jsPDF's text() draws Arabic glyphs unshaped/isolated, which is why a
   separate "Arabic looks broken" implementation is exactly what this
   avoids. */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { renderArabicText, wrapArabicText } from './arabicText';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const HEADER_H = 46; // +4mm vs. before, to fit the 2-line company name and the larger logo
const FOOTER_H = 18;
const GREEN = [70, 81, 47];
const GREY = [107, 107, 99];
const DARK = [26, 26, 24];

const BANK_DETAILS = {
  bank: 'Alinma Bank',
  accountNumber: '68205594739000',
  iban: 'SA5105000068205594739000',
  accountName: 'Ismail Al Farooque Wooden Industries',
};

const L = {
  en: {
    quotation: 'QUOTATION', number: 'Quotation No.', date: 'Date', validUntil: 'Valid Until', customer: 'Customer',
    item: '#', description: 'Description', qty: 'Qty', unit: 'Unit', unitPrice: 'Unit Price',
    taxable: 'VAT', amount: 'Amount (SAR)', yes: 'T', no: '—',
    subtotal: 'Subtotal', discount: 'Discount', net: 'Net Total', vat: 'VAT', grandTotal: 'GRAND TOTAL', currency: 'SAR',
    paymentTerms: 'Payment Terms', terms: 'Terms & Conditions',
    bankDetails: 'Bank Details', bank: 'Bank', accountNumber: 'Account Number', iban: 'IBAN', accountName: 'Account Name',
    preparedBy: 'Prepared by', approvedBy: 'Approved by', customerSign: 'Customer Acceptance',
    cr: 'CR', vatNo: 'VAT No.', tel: 'Tel', scanToVerify: 'Scan to Verify', page: 'Page', of: 'of',
  },
  ar: {
    quotation: 'عرض سعر', number: 'رقم العرض', date: 'التاريخ', validUntil: 'صالح حتى', customer: 'العميل',
    item: '#', description: 'الوصف', qty: 'الكمية', unit: 'الوحدة', unitPrice: 'سعر الوحدة',
    taxable: 'ضريبة', amount: 'المبلغ (ر.س)', yes: 'نعم', no: '—',
    subtotal: 'المجموع', discount: 'الخصم', net: 'الصافي', vat: 'ضريبة القيمة المضافة', grandTotal: 'الإجمالي النهائي', currency: 'ر.س',
    paymentTerms: 'شروط الدفع', terms: 'الشروط والأحكام',
    bankDetails: 'التفاصيل البنكية', bank: 'البنك', accountNumber: 'رقم الحساب', iban: 'الآيبان', accountName: 'اسم الحساب',
    preparedBy: 'إعداد', approvedBy: 'اعتماد', customerSign: 'موافقة العميل',
    cr: 'س.ت', vatNo: 'الرقم الضريبي', tel: 'هاتف', scanToVerify: 'امسح للتحقق', page: 'صفحة', of: 'من',
  },
};

/* Known long-form prose pairs (see QuoteDocument.js for why: word-by-word
   translation scrambles full sentences, so only exact known templates
   get substituted — anything else shows in its original script). */
const PROSE_PAIRS = [
  [
    'Prices are valid for 7 days from the quotation date. Delivery period to be confirmed on order. Prices include VAT where stated.',
    'الأسعار سارية لمدة 7 أيام من تاريخ العرض. يتم تأكيد مدة التسليم عند الطلب. الأسعار تشمل الضريبة حيثما ذُكر.',
  ],
];
function hasArabicChars(s) { return /[؀-ۿ]/.test(String(s || '')); }
function locProse(v, isAr) {
  const s = v == null ? '' : String(v);
  if (!s.trim()) return s;
  if (isAr === hasArabicChars(s)) return s;
  const norm = s.trim().replace(/\s+/g, ' ');
  const hit = PROSE_PAIRS.find(([en, ar]) => (isAr ? en : ar).replace(/\s+/g, ' ') === norm);
  return hit ? (isAr ? hit[1] : hit[0]) : s;
}

function money(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function dateStr(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB'); } catch (_) { return String(d); }
}
function rgbToHex(rgb) { return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join(''); }

/* Splits the company name onto two header lines — same rule as
   components/QuoteDocument.js's splitCompanyName(), kept in sync by
   hand since this is a separate rendering engine (jsPDF, not React/DOM)
   that can't literally import a browser-only component. "AL FAROOQUE" /
   "ALFAROOQUE" (spelled however it's actually stored) is the brand line,
   everything else (the division name) is line 2; any other entity name
   falls back to a balanced word-count split. */
function splitCompanyName(name) {
  const s = String(name || '').trim();
  if (!s) return ['', ''];
  const brandMatch = s.match(/^(al\s?farooque)(\s+)(.+)$/i);
  if (brandMatch) return [brandMatch[1], brandMatch[3]];
  const words = s.split(/\s+/);
  if (words.length <= 1) return [s, ''];
  let bestIdx = Math.ceil(words.length / 2), bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return [words.slice(0, bestIdx).join(' '), words.slice(bestIdx).join(' ')];
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

/* Builds the jsPDF document object without saving/printing it — the
   ONE place both downloadQuotePdf() and printQuotePdf() draw from, so
   Download, Print, and every browser's "Save as PDF" all produce the
   exact same bytes instead of three separately-maintained renders. */
async function buildQuotePdfDocument({ doc: q, products, entity, customer, terms, qrDataUrl, lang }) {
  const isAr = lang === 'ar';
  const t = L[isAr ? 'ar' : 'en'];
  const logo = await loadLogo();
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  /* Unified text drawing: plain Latin strings use jsPDF's native
     vector text (fast, crisp); anything containing Arabic is embedded
     as a canvas-shaped image at the same font-size/position — same
     call site, same geometry, for both languages. */
  function drawText(text, x, y, { align = 'left', size = 9, bold = false, color = DARK } = {}) {
    const str = text == null ? '' : String(text);
    if (!hasArabicChars(str)) {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
      pdf.setTextColor(...color);
      pdf.text(str, x, y, { align });
      return;
    }
    const img = renderArabicText(str, { fontSize: size, bold, color: rgbToHex(color) });
    let drawX = x;
    if (align === 'right') drawX = x - img.widthMm;
    else if (align === 'center') drawX = x - img.widthMm / 2;
    pdf.addImage(img.dataUrl, 'PNG', drawX, y - img.heightMm * 0.78, img.widthMm, img.heightMm);
  }
  /* Multi-line block (Terms & Conditions / Payment Terms): wraps with
     real font metrics for whichever script the text is actually in. */
  function drawTextBlock(text, x, y, maxWidth, { size = 8, bold = false, color = GREY, lineGap = 4 } = {}) {
    const str = text == null ? '' : String(text);
    const lines = hasArabicChars(str) ? wrapArabicText(str, maxWidth, size, bold) : pdf.splitTextToSize(str, maxWidth);
    lines.forEach((line, i) => drawText(line, x, y + i * lineGap, { size, bold, color }));
    return lines.length;
  }

  const eName = isAr ? (entity?.name_ar || entity?.name_en) : (entity?.name_en || entity?.name_ar);
  const eAddr = isAr ? (entity?.address_ar || entity?.address_en) : (entity?.address_en || entity?.address_ar);
  const pick = (row, base) => row && (isAr ? (row[base + '_ar'] || row[base + '_en']) : (row[base + '_en'] || row[base + '_ar']));
  const cName = customer ? (pick(customer, 'company_name') || customer.company_name) : '—';

  const head = [[t.item, t.description, t.qty, t.unit, t.unitPrice, t.taxable, t.amount]];
  const body = (products || []).map((p, i) => {
    const name = pick(p, 'name') || p.name || '';
    const desc = pick(p, 'description') || p.description || '';
    const line = desc ? name + '\n' + desc : name;
    const amt = p.line_total != null ? p.line_total : Number(p.qty) * Number(p.unit_price);
    return [String(i + 1), line, String(Number(p.qty)), p.unit || '', money(p.unit_price), p.taxable !== false ? t.yes : t.no, money(amt)];
  });

  /* Description column's actual usable text width — must track the
     fixed columnStyles widths below (186mm table − 102mm fixed columns
     − 4.4mm padding). Needed to correctly re-wrap Arabic description
     text ourselves (autoTable's own wrap uses Latin-only metrics). */
  const DESC_COL_TEXT_WIDTH = (PAGE_W - MARGIN * 2) - (8 + 14 + 16 + 24 + 12 + 28) - 2.2 * 2;

  /* autoTable draws its own vector text per cell — fine for Latin, but
     it can't shape Arabic, and its automatic line-wrapping/row-height
     is computed from Latin-only metrics too. For any cell containing
     Arabic: didParseCell re-wraps the real content with real Arabic
     metrics and overrides cell.text with a same-length blank array so
     autoTable reserves the CORRECT row height; didDrawCell then draws
     the real (shaped) lines on top. Table grid/borders/column widths
     stay 100% autoTable-driven and identical between languages. */
  autoTable(pdf, {
    head, body,
    startY: HEADER_H + 22,
    margin: { top: HEADER_H, bottom: FOOTER_H, left: MARGIN, right: MARGIN },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, valign: 'top', lineColor: [216, 212, 204], lineWidth: 0.1, textColor: DARK },
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
    didParseCell: (data) => {
      const raw = String(data.cell.raw ?? '');
      if (!hasArabicChars(raw)) return;
      const isDescCol = data.section === 'body' && data.column.index === 1;
      const arLines = isDescCol
        ? raw.split('\n').flatMap((part, idx) => wrapArabicText(part, DESC_COL_TEXT_WIDTH, idx === 1 ? 8 : 8.5, idx === 0))
        : [raw];
      data.cell._arLines = arLines;
      data.cell.text = arLines.map(() => ''); // blank placeholders — reserves correct row height (line count), draws nothing itself
    },
    didDrawCell: (data) => {
      const arLines = data.cell._arLines;
      if (!arLines) return;
      const isDescCol = data.section === 'body' && data.column.index === 1;
      const descLineCount = isDescCol ? wrapArabicText(String(data.cell.raw ?? '').split('\n')[0], DESC_COL_TEXT_WIDTH, 8.5, true).length : 0;
      const bold = data.section === 'head';
      const size = data.section === 'head' ? 8 : 8.5;
      const color = data.section === 'head' ? [255, 255, 255] : DARK;
      const halign = data.cell.styles.halign || 'left';
      const innerX = halign === 'center' ? data.cell.x + data.cell.width / 2
        : halign === 'right' ? data.cell.x + data.cell.width - data.cell.styles.cellPadding
        : data.cell.x + data.cell.styles.cellPadding;
      arLines.forEach((line, i) => {
        const isDescLine = isDescCol && i >= descLineCount;
        drawText(line, innerX, data.cell.y + data.cell.styles.cellPadding + 3 + i * 4,
          { align: halign, size: isDescLine ? 8 : size, bold: bold && !isDescLine, color: isDescLine ? GREY : color });
      });
    },
  });

  let y = pdf.lastAutoTable.finalY + 8;

  const hasPayment = !!(q.payment_terms && String(q.payment_terms).trim());
  const termsText = locProse(q.terms_body_override || (terms && terms.body) || '', isAr);
  const measureWidth = PAGE_W - MARGIN * 2;
  const termsLineCount = termsText ? (hasArabicChars(termsText) ? wrapArabicText(termsText, measureWidth, 8) : pdf.splitTextToSize(termsText, measureWidth)).length : 0;
  const paymentText = locProse(q.payment_terms, isAr);
  const paymentLineCount = hasPayment ? (hasArabicChars(paymentText) ? wrapArabicText(paymentText, measureWidth, 8.5) : pdf.splitTextToSize(paymentText, measureWidth)).length : 0;
  const blockEstimate = 34 /* totals */
    + (hasPayment ? 10 + paymentLineCount * 4 : 0)
    + 22 /* bank details */
    + (termsText ? 10 + termsLineCount * 4 : 0)
    + 26 /* signatures */;
  if (y + blockEstimate > PAGE_H - FOOTER_H) {
    pdf.addPage();
    y = HEADER_H + 8;
  }

  /* Totals */
  const totalsW = 72;
  const totalsX = PAGE_W - MARGIN - totalsW;
  function totalRow(label, value, bold) {
    drawText(label, totalsX, y, { size: 9, bold });
    drawText(value, PAGE_W - MARGIN, y, { align: 'right', size: 9, bold });
    y += 5.5;
  }
  totalRow(t.subtotal, money(q.subtotal));
  if (Number(q.discount_amount) > 0) {
    totalRow(t.discount + (q.discount_type === 'pct' ? ' (' + Number(q.discount_value) + '%)' : ''), '−' + money(q.discount_amount));
  }
  totalRow(t.net, money(q.net_total));
  totalRow(`${t.vat} ${Number(q.vat_rate)}%`, money(q.vat_amount));
  pdf.setFillColor(...GREEN);
  pdf.rect(totalsX - 2, y - 4.2, totalsW + 2, 7, 'F');
  drawText(t.grandTotal, totalsX, y, { size: 9, bold: true, color: [255, 255, 255] });
  drawText(money(q.grand_total) + ' ' + t.currency, PAGE_W - MARGIN, y, { align: 'right', size: 9, bold: true, color: [255, 255, 255] });
  y += 5.5 + 6;

  /* Payment Terms — only when the field is filled in, no empty heading */
  if (hasPayment) {
    drawText(t.paymentTerms, MARGIN, y, { size: 9.5, bold: true });
    y += 4.5;
    const n = drawTextBlock(paymentText, MARGIN, y, measureWidth, { size: 8.5, color: GREY });
    y += n * 4 + 6;
  }

  /* Bank Details — bordered info box */
  const bankBoxH = 20;
  pdf.setDrawColor(216, 212, 204);
  pdf.rect(MARGIN, y, PAGE_W - MARGIN * 2, bankBoxH);
  drawText(t.bankDetails, MARGIN + 4, y + 6, { size: 9.5, bold: true });
  drawText(`${t.bank}: ${BANK_DETAILS.bank}`, MARGIN + 4, y + 12, { size: 8.5 });
  drawText(`${t.accountNumber}: ${BANK_DETAILS.accountNumber}`, MARGIN + 4, y + 17, { size: 8.5 });
  drawText(`${t.iban}: ${BANK_DETAILS.iban}`, PAGE_W / 2, y + 12, { size: 8.5 });
  drawText(`${t.accountName}: ${BANK_DETAILS.accountName}`, PAGE_W / 2, y + 17, { size: 8.5 });
  y += bankBoxH + 8;

  /* Terms & Conditions */
  if (termsText) {
    drawText(t.terms, MARGIN, y, { size: 9.5, bold: true });
    y += 4.5;
    const n = drawTextBlock(termsText, MARGIN, y, measureWidth, { size: 8, color: GREY });
    y += n * 4 + 8;
  }

  /* Signatures */
  const sigY = y + 14;
  const colW = (PAGE_W - MARGIN * 2) / 3;
  [t.preparedBy, t.approvedBy, t.customerSign].forEach((label, i) => {
    const cx = MARGIN + colW * i;
    pdf.setDrawColor(140, 138, 128);
    pdf.line(cx + 6, sigY, cx + colW - 6, sigY);
    drawText(label, cx + colW / 2, sigY + 4.5, { align: 'center', size: 8, color: GREY });
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

    // Header — logo +18% (14mm -> 16.5mm), company name on two lines
    // (brand / division), everything below it shifted down to match.
    let hx = MARGIN;
    if (logo) {
      const logoH = 16.5, logoW = logoH * logo.ratio;
      pdf.addImage(logo.dataUrl, 'PNG', MARGIN, 6, logoW, logoH);
      hx = MARGIN + logoW + 4;
    }
    const [nameLine1, nameLine2] = splitCompanyName(eName);
    drawText(nameLine1, hx, 11.5, { size: 12.5, bold: true, color: GREEN });
    if (nameLine2) drawText(nameLine2, hx, 16, { size: 12.5, bold: true, color: GREEN });
    drawText(eAddr, hx, 20.5, { size: 8, color: GREY });
    const contactBits = [];
    if (entity?.phone) contactBits.push(`${t.tel}: ${entity.phone}`);
    if (entity?.cr_number) contactBits.push(`${t.cr}: ${entity.cr_number}`);
    if (entity?.vat_number) contactBits.push(`${t.vatNo}: ${entity.vat_number}`);
    if (contactBits.length) drawText(contactBits.join('  ·  '), hx, 25, { size: 8, color: GREY });

    // QR code — first page only, a true third header column (reserves
    // its own width so the title/meta column never overlaps it), clean
    // white rounded card with a light-grey border and a very subtle
    // drop shadow. 36mm square is within the 35-40mm spec range.
    // Same size/position/margins for both languages, per spec.
    const qrOnThisPage = i === 1 && !!qrDataUrl;
    const qrSize = 36;
    const qrCardPad = 3;
    const qrCardW = qrSize + qrCardPad * 2;
    const titleRightEdge = qrOnThisPage ? PAGE_W - MARGIN - qrCardW - 6 : PAGE_W - MARGIN;

    drawText(t.quotation, titleRightEdge, 12, { align: 'right', size: 14, bold: true });
    drawText(`${t.number}: ${q.quote_number || ''}`, titleRightEdge, 17, { align: 'right', size: 8, color: GREY });
    drawText(`${t.date}: ${dateStr(q.quote_date)}   ${t.validUntil}: ${dateStr(q.valid_until)}`, titleRightEdge, 21.5, { align: 'right', size: 8, color: GREY });
    drawText(`${t.customer}: ${cName}`, titleRightEdge, 25.5, { align: 'right', size: 8, color: GREY });

    /* Separator line drawn BEFORE the QR card — the QR card is an
       opaque white rounded rect that extends well below this line's y
       (a fixed 36mm QR + caption is taller than the header), so drawing
       the line first and the card after means the card's own opaque
       background papers over that stretch of line instead of a solid
       green stroke cutting across the QR code, which is what happened
       when this was drawn in the opposite order. */
    pdf.setDrawColor(...GREEN); pdf.setLineWidth(0.6);
    pdf.line(MARGIN, HEADER_H - 4, PAGE_W - MARGIN, HEADER_H - 4);
    pdf.setLineWidth(0.1);

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
      drawText(t.scanToVerify, cardX + qrCardW / 2, cardY + qrCardPad + qrSize + 3.5, { align: 'center', size: 6, color: GREY });
    }

    // Footer
    pdf.setDrawColor(216, 212, 204);
    pdf.line(MARGIN, PAGE_H - FOOTER_H + 2, PAGE_W - MARGIN, PAGE_H - FOOTER_H + 2);
    const footerLine1 = [eName, eAddr, entity?.cr_number && (`${t.cr}: ${entity.cr_number}`), entity?.vat_number && (`${t.vatNo}: ${entity.vat_number}`)]
      .filter(Boolean).join('  ·  ');
    const footerLine2 = [entity?.phone, entity?.email, entity?.website].filter(Boolean).join('  ·  ');
    drawText(footerLine1, PAGE_W / 2, PAGE_H - FOOTER_H + 7, { align: 'center', size: 7.2, color: GREY });
    if (footerLine2) drawText(footerLine2, PAGE_W / 2, PAGE_H - FOOTER_H + 11, { align: 'center', size: 7.2, color: GREY });
    drawText(`${t.page} ${i} ${t.of} ${totalPages}`, PAGE_W / 2, PAGE_H - 4, { align: 'center', size: 7.2, color: GREY });
  }

  return pdf;
}

/* "Download PDF" button — builds the document and triggers an immediate
   browser download. */
export async function downloadQuotePdf(params) {
  const pdf = await buildQuotePdfDocument(params);
  pdf.save((params.doc.quote_number || 'quotation') + '.pdf');
}

/* "Print" button — builds the EXACT SAME document (same function, same
   bytes) and opens it in a new tab as a real PDF instead of calling the
   browser's native window.print() on the HTML preview. Printing an
   actual PDF is pixel-identical across Chrome/Edge/Firefox/Safari and
   Windows/macOS "Save as PDF", since every browser is just handing the
   same fixed PDF bytes to its own PDF viewer/printer rather than
   re-laying-out HTML (which is where cross-browser print differences
   actually come from). autoPrint() opens the native print dialog
   immediately in browsers whose built-in PDF viewer honors it (Chrome,
   Edge); elsewhere the PDF still opens for the user to print or
   Save-as-PDF from manually — either way it's the identical document. */
export async function printQuotePdf(params) {
  const pdf = await buildQuotePdfDocument(params);
  pdf.autoPrint();
  const url = pdf.output('bloburl');
  window.open(url, '_blank');
}
