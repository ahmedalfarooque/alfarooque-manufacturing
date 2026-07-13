'use client';

/* ═══ Standard A4 report PDF engine — shared by QuotePro, Projects and
   Car Inventory report exports. Mirrored file (keep byte-identical):
     apps/quotation/lib/reportPdf.js
     apps/projects/lib/reportPdf.js
     apps/cars/lib/reportPdf.js

   COMPLETELY SEPARATE from the quotation DOCUMENT pipeline in
   apps/quotation/lib/pdf/* — that template is intentionally untouched.
   This engine renders tabular REPORT exports only.

   Layout (A4 portrait, 210×297mm):
   - table margins: left/right 12mm, first row ≥ header band, last row
     clear of the footer band — no clipped content, no overlap
   - branded header on EVERY page:
       left   company logo
       centre company name · address · CR · VAT · phone · email
       right  report title · generation date · prepared by
   - footer on EVERY page: one company line + centred "Page X of Y"
   - table: fits page width, wraps long text, bold header row repeated
     per page, alternating row colours, grid borders, rows never split
     across pages (rowPageBreak: 'avoid')
   - lang='ar' → RTL column order, right alignment, Arabic company block.

   ── Language / Unicode rendering (the important part) ──
   jsPDF's text() cannot shape Arabic (no contextual joining, no bidi)
   and its built-in Helvetica is Latin-only — drawing an Arabic string
   with it produces mojibake ("Ø§Ù„Ø®Ø´Ø¨"). So, exactly like the
   quotation DOCUMENT pipeline (lib/pdf/arabicText.js), ANY string that
   contains Arabic characters is rendered once through the browser's
   Canvas 2D engine (which does correct shaping + bidi) to a crisp PNG
   and placed as an image — for the title, company block, footer, table
   headers AND individual table cells. Pure-Latin text (English reports,
   plus codes/dates/amounts inside an Arabic report) is still drawn with
   Helvetica text() so the English appearance is byte-for-byte unchanged.

   This makes the export match the on-screen language exactly and never
   corrupts the other script:
     • English view  → English report; any Arabic-only data value still
       renders correctly (as a shaped image), never as broken chars.
     • Arabic view   → Arabic report, fully shaped; English/numeric
       values render crisply in Helvetica.
   The embedded Noto Naskh Arabic font (public/fonts/*, OFL) is still
   loaded so jsPDF-autotable can measure Arabic column widths/heights;
   the shaped PNG is drawn on top of that measured cell. Page numbers
   stay Latin so putTotalPages() substitution keeps working. ═══ */

/* Company profile (same branding across all three apps) — values match
   the primary WW-03 entity used by the quotation documents. Every field
   can be overridden per deployment with NEXT_PUBLIC_* env vars. */
const COMPANY = {
  name_en: process.env.NEXT_PUBLIC_COMPANY_NAME_EN || 'ALFAROOQUE WOOD WORKS FACTORY',
  name_ar: process.env.NEXT_PUBLIC_COMPANY_NAME_AR || 'مصنع الفاروق للأعمال الخشبية',
  address_en: process.env.NEXT_PUBLIC_COMPANY_ADDRESS_EN || 'Bahara, Jeddah, Saudi Arabia',
  address_ar: process.env.NEXT_PUBLIC_COMPANY_ADDRESS_AR || 'بحرة، جدة، المملكة العربية السعودية',
  cr: process.env.NEXT_PUBLIC_COMPANY_CR || '4031098279',
  vat: process.env.NEXT_PUBLIC_COMPANY_VAT || '312048700900003',
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '0564466661',
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'chairman@alfarooque.com',
  website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || '',
};

const L = {
  en: { generated: 'Generated', preparedBy: 'Prepared By', cr: 'CR', vat: 'VAT', phone: 'Phone', email: 'Email', page: 'Page', of: 'of', admin: 'Administrator' },
  ar: { generated: 'تاريخ الإنشاء', preparedBy: 'إعداد', cr: 'س.ت', vat: 'الرقم الضريبي', phone: 'هاتف', email: 'بريد', page: 'Page', of: 'of', admin: 'المسؤول' },
};

/* Geometry (mm) */
const PAGE_W = 210, PAGE_H = 297;
const M_LEFT = 12, M_RIGHT = 12;
const HEADER_TOP = 12;          // header band starts here
const TABLE_TOP = 40;           // first table row on every page
const TABLE_BOTTOM = 26;        // keeps rows clear of the footer band
const FOOTER_LINE_Y = PAGE_H - 22;   // divider
const BRAND = [15, 135, 126];        // quotation-app brand teal (#0f877e)
const STRIPE = [247, 245, 241];      // existing app surface tint
const BORDER = [223, 220, 214];
const TXT = [26, 26, 24];
const MUTED = [110, 108, 100];

const cache = { logo: null, fontReg: null, fontBold: null };

/* ── Canvas-based Unicode text rendering (shaping + bidi via the
   browser), mirroring lib/pdf/arabicText.js. Used for every string that
   contains Arabic. ── */
const PX_PER_MM = 12;
const AR_STACK = "'Noto Naskh Arabic','Segoe UI',Tahoma,Arial,sans-serif";
const AR_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
function hasArabic(v) { return AR_RE.test(String(v == null ? '' : v)); }
function fontPx(pt) { return pt * 0.3527 * PX_PER_MM; }
function rgbToHex(c) {
  if (Array.isArray(c)) return '#' + c.slice(0, 3).map(n => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0')).join('');
  if (typeof c === 'number') return '#' + [c, c, c].map(n => (n & 255).toString(16).padStart(2, '0')).join('');
  return '#1a1a18';
}

/* Renders one line of text to a transparent PNG sized in mm to match a
   jsPDF setFontSize(pt) call. direction:'rtl' gives correct Arabic
   joining and bidi ordering (mixed digits included). */
function renderTextImage(text, { fontPt = 8, bold = false, color = '#1a1a18' } = {}) {
  const str = String(text == null ? '' : text);
  const font = `${bold ? '700' : '400'} ${fontPx(fontPt)}px ${AR_STACK}`;
  const m0 = document.createElement('canvas').getContext('2d');
  m0.font = font;
  const met = m0.measureText(str || ' ');
  const ink = Math.max(met.width, met.actualBoundingBoxLeft || 0, met.actualBoundingBoxRight || 0);
  const pad = Math.ceil(fontPx(fontPt) * 0.35) + 4;
  const w = Math.max(1, Math.ceil(ink) + pad * 2);
  const asc = met.actualBoundingBoxAscent || fontPx(fontPt) * 0.82;
  const desc = met.actualBoundingBoxDescent || fontPx(fontPt) * 0.22;
  const baseline = asc + Math.ceil(fontPx(fontPt) * 0.1);
  const h = Math.max(1, Math.ceil(asc + desc) + Math.ceil(fontPx(fontPt) * 0.25));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.font = font; ctx.direction = 'rtl'; ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
  ctx.fillText(str, w - pad, baseline);
  return { dataUrl: canvas.toDataURL('image/png'), wMm: w / PX_PER_MM, hMm: h / PX_PER_MM, ascentMm: baseline / PX_PER_MM };
}

async function fetchB64(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error('fetch failed: ' + url);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* Logo, downscaled once (canvas, when available) so every report isn't
   carrying the full-resolution PNG. Falls back to the raw file. */
async function loadLogo() {
  if (cache.logo) return cache.logo;
  try {
    const b64 = await fetchB64('/logo.png');
    let out = { data: 'data:image/png;base64,' + b64, w: 1, h: 1 };
    if (typeof document !== 'undefined') {
      out = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(1, 260 / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve({ data: canvas.toDataURL('image/png'), w: img.width, h: img.height });
          } catch (_) { resolve({ data: out.data, w: img.width || 1, h: img.height || 1 }); }
        };
        img.onerror = () => resolve(out);
        img.src = out.data;
      });
    }
    cache.logo = out;
    return out;
  } catch (_) { return null; }
}

async function ensureArabicFont(doc) {
  if (!cache.fontReg) cache.fontReg = await fetchB64('/fonts/NotoNaskhArabic-Regular.ttf');
  if (!cache.fontBold) cache.fontBold = await fetchB64('/fonts/NotoNaskhArabic-Bold.ttf');
  doc.addFileToVFS('NotoNaskhArabic-Regular.ttf', cache.fontReg);
  doc.addFont('NotoNaskhArabic-Regular.ttf', 'NotoNaskh', 'normal');
  doc.addFileToVFS('NotoNaskhArabic-Bold.ttf', cache.fontBold);
  doc.addFont('NotoNaskhArabic-Bold.ttf', 'NotoNaskh', 'bold');
}

function fmtCell(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return String(v);
}

function fmtDate(lang) {
  try {
    return new Date().toLocaleDateString(lang === 'ar' ? 'ar-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (_) { return new Date().toISOString().slice(0, 10); }
}

/**
 * Render + download a standardized A4 portrait report PDF.
 * @param {object} opts
 * @param {string}   opts.title       localized report title ("Projects Report")
 * @param {Array}    opts.columns     [{ key, header }]
 * @param {Array}    opts.rows        array of row objects (values read by column key)
 * @param {'en'|'ar'} [opts.lang]
 * @param {string}   [opts.generatedBy]  defaults to the signed-in user (GET /api/auth)
 * @param {string}   [opts.fileName]
 */
export async function exportReportPdf({ title, columns, rows, lang = 'en', generatedBy, fileName = 'report.pdf' }) {
  const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
  await import('jspdf-autotable');

  const ar = lang === 'ar';
  const S = L[ar ? 'ar' : 'en'];

  if (!generatedBy) {
    try {
      const res = await fetch('/api/auth', { credentials: 'same-origin' });
      const d = res.ok ? await res.json() : null;
      generatedBy = (d && d.user && (d.user.full_name || d.user.email)) || S.admin;
    } catch (_) { generatedBy = S.admin; }
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  /* Always embed the Arabic font: even an English report may contain an
     Arabic-only data value, and autotable needs the metrics to size that
     cell. Rendering itself is via canvas PNG (see drawText / didDrawCell). */
  await ensureArabicFont(doc);
  const logo = await loadLogo();
  const genDate = fmtDate(lang);
  const totalPagesExp = '{af_total_pages}';

  const company = {
    name: ar ? COMPANY.name_ar : COMPANY.name_en,
    address: ar ? COMPANY.address_ar : COMPANY.address_en,
  };

  /* Draw a single-line string at (x,y=baseline). Latin → Helvetica
     text() (unchanged English look); anything with Arabic → shaped
     canvas PNG placed to match the requested alignment. */
  function drawText(str, x, y, { align = 'left', size = 8, bold = false, color = TXT } = {}) {
    const s = String(str == null ? '' : str);
    if (!hasArabic(s)) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(s, x, y, { align });
      return;
    }
    const img = renderTextImage(s, { fontPt: size, bold, color: rgbToHex(color) });
    let left = x;
    if (align === 'center') left = x - img.wMm / 2;
    else if (align === 'right') left = x - img.wMm;
    try { doc.addImage(img.dataUrl, 'PNG', left, y - img.ascentMm, img.wMm, img.hMm); } catch (_) {}
  }

  function drawHeader() {
    /* left: logo */
    if (logo) {
      const h = 17, w = Math.min(30, h * (logo.w / logo.h || 1));
      try { doc.addImage(logo.data, 'PNG', M_LEFT, HEADER_TOP, w, h); } catch (_) {}
    }
    /* centre: company block */
    const cx = PAGE_W / 2;
    drawText(company.name, cx, HEADER_TOP + 4, { align: 'center', size: 10.5, bold: true, color: TXT });
    drawText(company.address, cx, HEADER_TOP + 8.4, { align: 'center', size: 7.3, color: MUTED });
    drawText(`${S.cr}: ${COMPANY.cr}    ${S.vat}: ${COMPANY.vat}`, cx, HEADER_TOP + 12.2, { align: 'center', size: 7.3, color: MUTED });
    drawText(`${S.phone}: ${COMPANY.phone}    ${S.email}: ${COMPANY.email}`, cx, HEADER_TOP + 16, { align: 'center', size: 7.3, color: MUTED });
    /* right: report block */
    const rx = PAGE_W - M_RIGHT;
    let afterTitle;
    if (hasArabic(title)) {
      drawText(String(title || ''), rx, HEADER_TOP + 4, { align: 'right', size: 10.5, bold: true, color: BRAND });
      afterTitle = HEADER_TOP + 4;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...BRAND);
      const titleLines = doc.splitTextToSize(String(title || ''), 58);
      doc.text(titleLines, rx, HEADER_TOP + 4, { align: 'right' });
      afterTitle = HEADER_TOP + 4 + (titleLines.length - 1) * 4.6;
    }
    drawText(`${S.generated}: ${genDate}`, rx, afterTitle + 4.4, { align: 'right', size: 7.3, color: MUTED });
    drawText(`${S.preparedBy}: ${generatedBy}`, rx, afterTitle + 8.2, { align: 'right', size: 7.3, color: MUTED });
    /* divider */
    doc.setDrawColor(...BRAND); doc.setLineWidth(0.5);
    doc.line(M_LEFT, HEADER_TOP + 21.5, PAGE_W - M_RIGHT, HEADER_TOP + 21.5);
  }

  function drawFooter() {
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.25);
    doc.line(M_LEFT, FOOTER_LINE_Y, PAGE_W - M_RIGHT, FOOTER_LINE_Y);
    const parts = [company.name, company.address, `${S.cr}: ${COMPANY.cr}`, `${S.vat}: ${COMPANY.vat}`, `${S.phone}: ${COMPANY.phone}`, `${S.email}: ${COMPANY.email}`];
    if (COMPANY.website) parts.push(COMPANY.website);
    const line = parts.join('   •   ');
    if (hasArabic(line)) {
      /* One shaped image line, shrunk to fit the content width. */
      const img = renderTextImage(line, { fontPt: 6.8, color: rgbToHex(MUTED) });
      const maxW = PAGE_W - M_LEFT - M_RIGHT;
      let w = img.wMm, h = img.hMm;
      if (w > maxW) { const s = maxW / w; w *= s; h *= s; }
      try { doc.addImage(img.dataUrl, 'PNG', PAGE_W / 2 - w / 2, FOOTER_LINE_Y + 1.8, w, h); } catch (_) {}
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...MUTED);
      const wrapped = doc.splitTextToSize(line, PAGE_W - M_LEFT - M_RIGHT);
      doc.text(wrapped.slice(0, 2), PAGE_W / 2, FOOTER_LINE_Y + 3.8, { align: 'center' });
    }
    /* centred page number — helvetica so putTotalPages substitution works */
    const page = doc.internal.getCurrentPageInfo().pageNumber;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...TXT);
    doc.text(`${S.page} ${page} ${S.of} ${totalPagesExp}`, PAGE_W / 2, PAGE_H - 9.5, { align: 'center' });
  }

  const cols = ar ? [...columns].reverse() : columns;
  const head = [cols.map(c => String(c.header ?? ''))];
  const body = (rows || []).map(r => cols.map(c => fmtCell(r[c.key])));

  const PADX = 1.8;
  doc.autoTable({
    head, body,
    startY: TABLE_TOP,
    margin: { top: TABLE_TOP, bottom: TABLE_BOTTOM, left: M_LEFT, right: M_RIGHT },
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: PADX, overflow: 'linebreak',
      textColor: TXT, lineColor: BORDER, lineWidth: 0.15,
      halign: ar ? 'right' : 'left', valign: 'middle',
    },
    headStyles: { font: 'helvetica', fontStyle: 'bold', fontSize: 8.2, fillColor: BRAND, textColor: [255, 255, 255], halign: ar ? 'right' : 'left' },
    alternateRowStyles: { fillColor: STRIPE },
    /* Any cell (head or body) containing Arabic switches to the embedded
       Noto font so autotable measures a real width/height for it; the
       glyphs it lays out are unshaped, but they get fully covered and
       replaced by a shaped canvas PNG in didDrawCell below. Pure-Latin
       cells stay Helvetica and are drawn normally (English unchanged). */
    didParseCell: (data) => {
      if (hasArabic(data.cell.raw)) { data.cell.styles.font = 'NotoNaskh'; }
    },
    didDrawCell: (data) => {
      const raw = data.cell.raw == null ? '' : String(data.cell.raw);
      if (!hasArabic(raw) || !raw.trim()) return;
      const st = data.cell.styles;
      /* cover the unshaped text with the cell's own fill (preserves grid
         borders drawn just outside this inset, and header/stripe colours) */
      const fc = st.fillColor;
      const cover = Array.isArray(fc) ? fc : (typeof fc === 'number' ? [fc, fc, fc] : [255, 255, 255]);
      doc.setFillColor(...cover);
      doc.rect(data.cell.x + 0.35, data.cell.y + 0.35, data.cell.width - 0.7, data.cell.height - 0.7, 'F');
      /* draw the shaped image, shrunk to fit the cell if needed */
      const img = renderTextImage(raw, { fontPt: st.fontSize, bold: st.fontStyle === 'bold', color: rgbToHex(st.textColor) });
      const innerW = Math.max(1, data.cell.width - PADX * 2);
      let w = img.wMm, h = img.hMm;
      if (w > innerW) { const s = innerW / w; w *= s; h *= s; }
      let x;
      if (st.halign === 'right') x = data.cell.x + data.cell.width - PADX - w;
      else if (st.halign === 'center') x = data.cell.x + (data.cell.width - w) / 2;
      else x = data.cell.x + PADX;
      const y = data.cell.y + (data.cell.height - h) / 2;
      try { doc.addImage(img.dataUrl, 'PNG', x, y, w, h); } catch (_) {}
    },
    didDrawPage: () => { drawHeader(); drawFooter(); },
  });

  if (typeof doc.putTotalPages === 'function') doc.putTotalPages(totalPagesExp);
  doc.save(fileName);
}
