'use strict';

/* Renders the SAME DOM node the browser shows as the "PDF Preview"
   (components/QuoteDocument.js, already mounted on the print page) into
   an A4 PDF via html2canvas — instead of the old approach of
   hand-recreating the layout with jsPDF's own text()/autoTable() draw
   calls. That old approach was a SECOND, independently-maintained
   implementation of the same design, which is exactly why Download/Print
   drifted out of alignment with the preview over time (a header tweak in
   QuoteDocument.js had no effect on the jsPDF drawing code, and vice
   versa). There is now exactly ONE template — the React component you
   already see on screen — and Download / Print / every browser's "Save
   as PDF" all rasterize that same element, so they can never diverge
   again. It also makes Arabic rendering trivially correct: the browser
   has already shaped the Arabic glyphs correctly on screen, so there is
   no separate canvas-text-shaping workaround needed (lib/pdf/arabicText.js
   is no longer used by this file).

   Header and footer repeat on every generated PDF page (matching the
   original multi-page intent) by cropping those two regions out of the
   ONE captured raster and reusing the crops; the QR code is blanked out
   of the repeated header for pages after the first, since it is a
   page-1-only element in the design. The body (customer box, items
   table, totals, terms, signatures) is paginated using real DOM
   boundaries (table rows and each top-level section) as the only legal
   places to cut a page — so a page break can never fall inside a row or
   split a block in half. */

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
/* ~300 DPI equivalent (96 CSS px/inch * 3.125 = 300) — matches the
   "300 DPI, do not reduce image quality" requirement while keeping the
   generated PNG size reasonable. */
const SCALE = 300 / 96;

function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll('img'));
  const pending = imgs.map(img => img.complete
    ? Promise.resolve()
    : new Promise(res => { img.onload = res; img.onerror = res; }));
  const fontsReady = (typeof document !== 'undefined' && document.fonts && document.fonts.ready)
    ? document.fonts.ready.catch(() => {})
    : Promise.resolve();
  return Promise.all([...pending, fontsReady]);
}

/* Every y-offset (relative to bodyEl's own top, in CSS px) that is safe
   to cut a page at: the top/bottom edge of every table row, and of every
   direct child section of .qdoc-body (customer box, items table, totals
   row, payment terms, bank box, terms & conditions, signatures) — so a
   page break can only ever fall BETWEEN two of these, never through one. */
function findSafeBreaks(bodyEl) {
  const bodyTop = bodyEl.getBoundingClientRect().top;
  const offsets = new Set([0]);
  const addRect = (rect) => {
    offsets.add(rect.top - bodyTop);
    offsets.add(rect.bottom - bodyTop);
  };
  Array.from(bodyEl.children).forEach(child => {
    addRect(child.getBoundingClientRect());
    child.querySelectorAll('tr').forEach(tr => addRect(tr.getBoundingClientRect()));
  });
  offsets.add(bodyEl.getBoundingClientRect().height);
  return Array.from(offsets).filter(n => n >= 0).sort((a, b) => a - b);
}

/* Crops a sub-rectangle (given in CSS px relative to the captured
   element's own top-left) out of the single full-page html2canvas
   capture. Cheap — pure canvas-to-canvas draw, no re-render. */
function cropCanvas(sourceCanvas, topCssPx, bottomCssPx) {
  const top = Math.round(topCssPx * SCALE);
  const height = Math.max(1, Math.round((bottomCssPx - topCssPx) * SCALE));
  const out = document.createElement('canvas');
  out.width = sourceCanvas.width;
  out.height = height;
  out.getContext('2d').drawImage(sourceCanvas, 0, top, out.width, height, 0, 0, out.width, height);
  return out;
}

/* Builds the jsPDF document object without saving/printing it — the ONE
   place both downloadQuotePdf() and printQuotePdf() draw from, so
   Download, Print, and every browser's "Save as PDF" produce the exact
   same bytes, which are themselves a faithful capture of the on-screen
   preview. `rootEl` must be the mounted .qdoc element (QuoteDocument's
   own root node). */
export async function buildQuotePdfDocument(rootEl) {
  if (!rootEl) throw new Error('Quotation preview element not found.');
  await waitForImages(rootEl);

  const headerEl = rootEl.querySelector('.qdoc-header');
  const footerEl = rootEl.querySelector('.qdoc-footer');
  const bodyEl = rootEl.querySelector('.qdoc-body');
  const qrEl = rootEl.querySelector('.qdoc-qr');
  if (!headerEl || !footerEl || !bodyEl) throw new Error('Quotation preview structure not found.');

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const rootRect = rootEl.getBoundingClientRect();
  const canvas = await html2canvas(rootEl, {
    scale: SCALE,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  /* CSS-px measurements relative to rootEl's own top-left — the same
     coordinate space cropCanvas() expects. */
  const rel = (rect) => ({
    top: rect.top - rootRect.top, bottom: rect.bottom - rootRect.top,
    left: rect.left - rootRect.left, right: rect.right - rootRect.left,
  });
  const headerBox = rel(headerEl.getBoundingClientRect());
  const footerBox = rel(footerEl.getBoundingClientRect());
  const bodyBox = rel(bodyEl.getBoundingClientRect());
  const qrBox = qrEl ? rel(qrEl.getBoundingClientRect()) : null;

  const headerHeightPx = headerBox.bottom - headerBox.top;
  const footerHeightPx = footerBox.bottom - footerBox.top;

  /* Page geometry derived from the element's OWN measured width (not a
     hardcoded constant) so this stays correct regardless of the exact
     on-screen pixel width the browser rendered at any zoom level. */
  const pxPerMm = rootRect.width / PAGE_W_MM;

  /* Common case — the whole document (header+body+footer) fits on one
     A4 page: draw the ENTIRE capture as a SINGLE image with zero
     compositing. This is the only way to GUARANTEE the PDF is pixel-for-
     pixel identical to the preview (the footer lands exactly where it
     sits on screen — directly under the signatures — instead of being
     artificially pinned to the physical page's bottom edge with a large
     gap above it, which is what pinning header/body/footer separately
     produced and is NOT what the preview shows for a short document). */
  const totalContentHeightPx = footerBox.bottom; // footer is the last element in flow
  const totalContentHeightMm = totalContentHeightPx / pxPerMm;
  if (totalContentHeightMm <= PAGE_H_MM + 0.5) {
    const fullCanvas = cropCanvas(canvas, 0, totalContentHeightPx);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    pdf.addImage(fullCanvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W_MM, totalContentHeightMm, undefined, 'FAST');
    return pdf;
  }

  /* Multi-page fallback — content genuinely exceeds one A4 page. Header
     repeats at the top of every page (QR blanked out for pages after the
     first, since it's a page-1-only element by design) and footer
     repeats at the bottom of every page — standard print-pagination
     behavior, matching the original @media print repeating-header/footer
     intent for documents long enough to actually need it. */
  const headerWithQr = cropCanvas(canvas, headerBox.top, headerBox.bottom);
  const headerNoQr = cropCanvas(canvas, headerBox.top, headerBox.bottom);
  if (qrBox) {
    const ctx = headerNoQr.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      Math.round(qrBox.left * SCALE), Math.round((qrBox.top - headerBox.top) * SCALE),
      Math.round((qrBox.right - qrBox.left) * SCALE), Math.round((qrBox.bottom - qrBox.top) * SCALE),
    );
  }
  const footerCanvas = cropCanvas(canvas, footerBox.top, footerBox.bottom);

  const pageHeightPx = PAGE_H_MM * pxPerMm;
  const pageContentHeightPx = pageHeightPx - headerHeightPx - footerHeightPx;

  const breaks = findSafeBreaks(bodyEl);
  const bodyHeightPx = bodyBox.bottom - bodyBox.top;
  const slices = [];
  let cursor = 0;
  while (cursor < bodyHeightPx - 0.5) {
    const target = cursor + pageContentHeightPx;
    let chosen = null;
    for (const b of breaks) { if (b > cursor + 0.5 && b <= target + 0.01) chosen = b; }
    if (chosen == null) chosen = Math.min(target, bodyHeightPx); // a single block taller than one page — rare fallback, still no worse than clipping
    slices.push([cursor, chosen]);
    cursor = chosen;
  }
  if (!slices.length) slices.push([0, bodyHeightPx]);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const headerHeightMm = headerHeightPx / pxPerMm;
  const footerHeightMm = footerHeightPx / pxPerMm;

  slices.forEach(([from, to], i) => {
    if (i > 0) pdf.addPage();
    const headerCanvas = i === 0 ? headerWithQr : headerNoQr;
    pdf.addImage(headerCanvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W_MM, headerHeightMm, undefined, 'FAST');

    const sliceCanvas = cropCanvas(canvas, bodyBox.top + from, bodyBox.top + to);
    const sliceHeightMm = (to - from) / pxPerMm;
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, headerHeightMm, PAGE_W_MM, sliceHeightMm, undefined, 'FAST');

    pdf.addImage(footerCanvas.toDataURL('image/png'), 'PNG', 0, PAGE_H_MM - footerHeightMm, PAGE_W_MM, footerHeightMm, undefined, 'FAST');
  });

  return pdf;
}

/* "Download PDF" button — builds the document and triggers an immediate
   browser download. */
export async function downloadQuotePdf(rootEl, filename) {
  const pdf = await buildQuotePdfDocument(rootEl);
  pdf.save(filename || 'quotation.pdf');
}

/* "Print" button — builds the EXACT SAME document (same function, same
   bytes) and opens it in a new tab as a real PDF instead of calling the
   browser's native window.print() on the HTML preview. Printing an
   actual PDF is pixel-identical across Chrome/Edge/Firefox/Safari and
   Windows/macOS "Save as PDF", since every browser hands the same fixed
   PDF bytes to its own PDF viewer/printer rather than re-laying-out
   HTML. autoPrint() opens the native print dialog immediately in
   browsers whose built-in PDF viewer honors it (Chrome, Edge); elsewhere
   the PDF still opens for the user to print or Save-as-PDF from
   manually — either way it's the identical document. */
export async function printQuotePdf(rootEl) {
  const pdf = await buildQuotePdfDocument(rootEl);
  pdf.autoPrint();
  const url = pdf.output('bloburl');
  window.open(url, '_blank');
}
