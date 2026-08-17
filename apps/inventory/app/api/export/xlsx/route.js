'use strict';

/* Generic "rows -> .xlsx" converter — same pattern/contract as
   apps/accounting/app/api/export/xlsx/route.js. No page-specific logic;
   the caller sends the exact columns/rows it already built for its own
   Print/PDF export, guaranteeing Excel always matches PDF exactly. */

const { json, requireAction } = require('@/lib/http');
const { buildXlsx, xlsxResponse } = require('@/lib/sheets');

export async function POST(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.columns) || !Array.isArray(body.rows)) {
    return json({ error: 'columns and rows are required.' }, 400);
  }
  if (body.columns.length > 50) return json({ error: 'Too many columns.' }, 400);
  if (body.rows.length > 200000) return json({ error: 'Too many rows for a single export.' }, 400);

  const sheetName = String(body.sheetName || 'Sheet1').slice(0, 31);
  const filename = String(body.filename || 'export.xlsx').replace(/[^\w.\-]/g, '_');
  const buf = await buildXlsx({
    sheetName,
    columns: body.columns.map(c => ({ key: String(c.key), header: String(c.header ?? c.key) })),
    rows: body.rows,
    rtl: body.rtl === true,
  });
  return xlsxResponse(buf, filename);
}
