'use strict';

/* Generic "rows -> .xlsx" converter. Deliberately has NO SmartLife-specific
   logic — the caller (any list page) sends exactly the columns/rows it
   already computed for its own Print/PDF export (same filtered dataset,
   guaranteed parity, no second filter implementation to maintain), and
   this just builds the branded workbook via the shared exceljs helper.
   Reusable by any future module without adding a new export route. */

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
