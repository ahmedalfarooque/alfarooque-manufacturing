'use strict';

/* Excel (.xlsx) writer for the ledger reports, using exceljs (already a
   dependency — no new package). Server-side on purpose: it re-runs the SAME
   adapter query as the screen with the SAME filters, so the workbook cannot
   drift from what the user is looking at, and it covers the COMPLETE
   selected period rather than the visible page.

   Real .xlsx (not CSV renamed): typed numeric cells so totals can be
   re-summed in Excel, a frozen header row, and column widths from the
   shared report definition. */

const ExcelJS = require('exceljs');
const { formatMoney, periodLabel } = require('./ledgerReportDefs');

const BRAND = 'FF0F877E';

function metaRow(sheet, label, value) {
  const row = sheet.addRow([label, value]);
  row.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF55534C' } };
  row.getCell(2).font = { size: 9 };
  return row;
}

async function buildLedgerWorkbook({ report, rows, totals, filters, companyName, branchLabel }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = companyName || 'AL FAROOQUE ERP';
  const sheet = workbook.addWorksheet(report.title.slice(0, 31));

  const titleRow = sheet.addRow([companyName || 'AL FAROOQUE']);
  titleRow.getCell(1).font = { bold: true, size: 14 };
  const reportRow = sheet.addRow([report.title]);
  reportRow.getCell(1).font = { bold: true, size: 12, color: { argb: BRAND } };

  metaRow(sheet, 'Period', periodLabel(filters?.from, filters?.to));
  metaRow(sheet, 'Branch', branchLabel || 'All branches');
  metaRow(sheet, 'Generated', new Date().toISOString().slice(0, 10));
  metaRow(sheet, 'Source', 'Synchronized SmartERP general ledger (accounting/get_entry)');
  sheet.addRow([]);

  const headerRow = sheet.addRow(report.columns.map(col => col.label));
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    cell.alignment = { vertical: 'middle' };
  });
  sheet.views = [{ state: 'frozen', ySplit: headerRow.number }];

  for (const record of rows) {
    const row = sheet.addRow(report.columns.map(col => {
      const value = record[col.key];
      if (value == null || value === '') return null;
      /* Money stays a real number so Excel can sum it; formatting is
         applied as a cell number format, not by writing a string. */
      return col.money ? Number(value) : String(value);
    }));
    report.columns.forEach((col, index) => {
      if (col.money) {
        const cell = row.getCell(index + 1);
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  report.columns.forEach((col, index) => {
    sheet.getColumn(index + 1).width = col.width || 14;
  });

  sheet.addRow([]);
  const totalsHeading = sheet.addRow(['TOTALS']);
  totalsHeading.getCell(1).font = { bold: true, size: 10, color: { argb: BRAND } };
  for (const total of totals) {
    const row = sheet.addRow([total.label, total.value]);
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(2).alignment = { horizontal: 'left' };
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildLedgerWorkbook, formatMoney };
