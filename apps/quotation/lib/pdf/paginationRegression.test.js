'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const apps = path.resolve(__dirname, '..', '..', '..');
const quoteDocument = fs.readFileSync(path.join(apps, 'quotation', 'components', 'QuoteDocument.js'), 'utf8');
const invoiceDocument = fs.readFileSync(path.join(apps, 'accounting', 'components', 'InvoiceDocument.js'), 'utf8');
const quoteRenderer = fs.readFileSync(path.join(apps, 'quotation', 'lib', 'pdf', 'renderPdfServer.js'), 'utf8');
const invoiceRenderer = fs.readFileSync(path.join(apps, 'accounting', 'lib', 'pdf', 'renderPdfServer.js'), 'utf8');

test('print documents reserve only the measured footer footprint', () => {
  for (const source of [quoteDocument, invoiceDocument]) {
    assert.match(source, /<tfoot aria-hidden="true">/);
    assert.match(source, /footer-space \{ height: 44px; \}/);
    assert.doesNotMatch(source, /\.\w*doc-body\s*\{[^}]*padding-bottom/i);
    assert.doesNotMatch(source, /padding-bottom:\s*(?:[1-9]\d{2,})px/i);
  }
});

test('QuotePro keeps each closing section atomic without forcing the whole package onto one page', () => {
  /* The closing wrapper itself must NOT be break/page-break-avoid: making
     Bank Details + Terms + Signatures one indivisible unit caused a
     borderline document (which had room for Bank Details and Terms at the
     bottom of page 1) to push the ENTIRE package to page 2 instead of just
     the piece that didn't fit — wasting space on both pages. Reproduced
     live against WW-03-2026-0045-R1 before this fix (10 items, 2 pages,
     page 2 = the whole closing package with a mostly-empty page 1 tail). */
  assert.doesNotMatch(quoteDocument, /className="qdoc-body qdoc-closing"[^\n]*(?:break|pageBreak)Inside:\s*'avoid'/);
  /* Each individual section still never splits internally. */
  assert.match(quoteDocument, /borderRadius: 8, padding: '12px 14px', marginTop: 28, fontSize: 11\.5, breakInside: 'avoid'/); // Bank Details box
  assert.match(quoteDocument, /marginTop: 28, fontSize: 11, color: '#55534c', breakInside: 'avoid'/); // Terms block
  assert.match(quoteDocument, /display: 'flex', gap: 20, marginTop: 64, breakInside: 'avoid'/); // Signature row
  assert.ok(quoteDocument.indexOf('className="qdoc-body qdoc-closing"') > quoteDocument.indexOf('{/* Items */}'));
});

test('server renderers align fixed footer containing block to A4 without sizing content', () => {
  for (const source of [quoteRenderer, invoiceRenderer]) {
    assert.match(source, /setViewport\(\{ width: 900, height: 1123, deviceScaleFactor: 2 \}\)/);
    assert.doesNotMatch(source, /setViewport\(\{[^}]*height:\s*1200/);
  }
});
