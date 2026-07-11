'use strict';

/* jsPDF's text() draws each glyph in isolated form — no contextual
   joining, no bidi reordering — so real Arabic looks broken. The
   browser's own Canvas 2D text engine DOES perform correct Arabic
   shaping/joining and bidi ordering (ctx.direction='rtl' + fillText()),
   so instead of a separate Arabic PDF implementation, every Arabic
   string is rendered once to a small transparent PNG here and embedded
   into the SAME jsPDF page geometry used for English — one shared
   layout, only the text content differs.

   PX_PER_MM is a fixed, invertible supersampling ratio (chosen for
   crisp print output) so mm↔px conversion is exact and simple —
   needed for word-wrapping long-form text (Terms & Conditions,
   Payment Terms) to a target mm width. */

const PX_PER_MM = 12;
const FONT_STACK = "'Noto Naskh Arabic','Segoe UI',Tahoma,Arial,sans-serif";

function fontPx(fontSizePt) { return fontSizePt * 0.3527 * PX_PER_MM; }

function makeCtx(fontSizePt, bold) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${bold ? '700' : '400'} ${fontPx(fontSizePt)}px ${FONT_STACK}`;
  return ctx;
}

/* Renders `text` to a PNG sized in mm to visually match a jsPDF
   pdf.setFontSize(fontSize) call (1pt = 0.3527mm), keeping the same
   font-size hierarchy as the English text() calls. */
function renderArabicText(text, { fontSize = 9, bold = false, color = '#1a1a18' } = {}) {
  const str = text == null ? '' : String(text);
  const ctx0 = makeCtx(fontSize, bold);
  const metrics = ctx0.measureText(str || ' ');
  /* Arabic's contextual joining/ligatures can make the actual ink
     extend further than the nominal advance width (metrics.width) —
     using actualBoundingBoxLeft (when available) and generous padding
     avoids clipping the start of the (RTL, right-anchored) text. */
  const inkWidth = Math.max(metrics.width, metrics.actualBoundingBoxLeft || 0, metrics.actualBoundingBoxRight || 0);
  const padPx = Math.ceil(fontPx(fontSize) * 0.35) + 4;
  const width = Math.max(1, Math.ceil(inkWidth) + padPx * 2);
  const ascent = metrics.actualBoundingBoxAscent || fontPx(fontSize) * 0.82;
  const descent = metrics.actualBoundingBoxDescent || fontPx(fontSize) * 0.22;
  const height = Math.max(1, Math.ceil(ascent + descent) + Math.ceil(fontPx(fontSize) * 0.25));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.font = `${bold ? '700' : '400'} ${fontPx(fontSize)}px ${FONT_STACK}`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(str, width - padPx, ascent + Math.ceil(fontPx(fontSize) * 0.1));

  return { dataUrl: canvas.toDataURL('image/png'), widthMm: width / PX_PER_MM, heightMm: height / PX_PER_MM, isBlank: !str.trim() };
}

/* Greedy word-wrap using real canvas metrics for the Arabic font, at a
   target mm width — the equivalent of jsPDF's splitTextToSize() but
   measured against a font jsPDF itself can't lay out. */
function wrapArabicText(text, maxWidthMm, fontSize = 8, bold = false) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const ctx = makeCtx(fontSize, bold);
  const maxWidthPx = maxWidthMm * PX_PER_MM;
  const lines = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? line + ' ' + w : w;
    if (line && ctx.measureText(candidate).width > maxWidthPx) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

module.exports = { renderArabicText, wrapArabicText };
