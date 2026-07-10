'use strict';

/* Shared spreadsheet helpers for the import/export/template endpoints.
   Reads .xlsx/.xls via exceljs and .csv via a small quote-aware parser;
   writes branded .xlsx via exceljs. */

const ExcelJS = require('exceljs');

function cellToString(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(r => r.text).join('');
    if (v.result !== undefined) return String(v.result);
    if (v.text) return String(v.text);
    if (v.hyperlink) return String(v.text || v.hyperlink);
  }
  return String(v).trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(x => x !== '')) rows.push(row);
  return rows;
}

/* → { headers: ['product id', …], rows: [{header: value}], error? }
   Header keys are lowercased/trimmed for tolerant matching. */
async function parseUpload(req) {
  let file;
  try {
    const form = await req.formData();
    file = form.get('file');
  } catch (_) { return { error: 'Could not read upload.' }; }
  if (!file || typeof file.arrayBuffer !== 'function') return { error: 'No file uploaded.' };
  const buf = Buffer.from(await file.arrayBuffer());
  const nameL = String(file.name || '').toLowerCase();

  let grid = [];
  if (nameL.endsWith('.csv')) {
    grid = parseCsv(buf.toString('utf8'));
  } else {
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(buf); } catch (_) { return { error: 'Not a valid .xlsx/.csv file (legacy .xls: re-save as .xlsx).' }; }
    const ws = wb.worksheets[0];
    if (!ws) return { error: 'Workbook has no sheets.' };
    ws.eachRow(row => {
      const arr = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => { arr[col - 1] = cellToString(cell.value); });
      grid.push(arr);
    });
  }
  if (!grid.length) return { error: 'File is empty.' };
  const headers = grid[0].map(h => String(h || '').trim().toLowerCase());
  const rows = grid.slice(1).map(arr => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = arr[i] !== undefined && arr[i] !== null ? String(arr[i]).trim() : ''; });
    return o;
  }).filter(o => Object.values(o).some(v => v !== ''));
  return { headers, rows };
}

/* pick(rowObj, ['name en','english name',…]) → first non-empty match */
function col(row, names) {
  for (const n of names) { if (row[n] !== undefined && row[n] !== '') return row[n]; }
  return '';
}
function toNum(v) { const n = parseFloat(String(v).replace(/[^\d.\-]/g, '')); return Number.isFinite(n) ? n : null; }

async function buildXlsx({ sheetName, columns, rows }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName || 'Sheet1', { views: [{ state: 'frozen', ySplit: 1 }] });
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

function csvResponse(columns, rows, filename) {
  const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [columns.map(c => esc(c.header)).join(',')];
  (rows || []).forEach(r => lines.push(columns.map(c => esc(r[c.key])).join(',')));
  return new Response('﻿' + lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' },
  });
}

module.exports = { parseUpload, col, toNum, buildXlsx, xlsxResponse, csvResponse };
