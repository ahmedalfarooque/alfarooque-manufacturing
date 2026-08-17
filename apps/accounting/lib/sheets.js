'use strict';

/* Shared Excel export helper — ported from apps/quotation/lib/sheets.js
   (the established project convention for .xlsx export: exceljs, branded
   header row, RTL-aware sheet orientation). Export-only here (Accounting
   has no import/template workflow), so parseUpload/csvResponse/col/toNum
   are intentionally omitted. */

const ExcelJS = require('exceljs');

async function buildXlsx({ sheetName, columns, rows, rtl }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName || 'Sheet1', { views: [{ state: 'frozen', ySplit: 1, rightToLeft: !!rtl }] });
  ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || Math.max(14, c.header.length + 4) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF46512F' } };
  (rows || []).forEach(r => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function xlsxResponse(buffer, filename) {
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

module.exports = { buildXlsx, xlsxResponse };
