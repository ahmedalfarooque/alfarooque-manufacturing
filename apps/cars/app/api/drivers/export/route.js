'use strict';

const ExcelJS = require('exceljs');
const { getDb } = require('@/lib/db');
const { requireSession } = require('@/lib/http');

const COLUMNS = [
  { header: 'Full Name', key: 'full_name', width: 22 },
  { header: 'Employee ID', key: 'employee_id', width: 14 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Email', key: 'email', width: 22 },
  { header: 'Nationality', key: 'nationality', width: 14 },
  { header: 'License Number', key: 'license_number', width: 16 },
  { header: 'License Expiry', key: 'license_expiry_date', width: 14 },
  { header: 'Iqama Number', key: 'iqama_number', width: 16 },
  { header: 'Iqama Expiry', key: 'iqama_expiry_date', width: 14 },
  { header: 'Status', key: 'status', width: 12 },
];

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('drivers').select('*').order('full_name', { ascending: true });
  if (error) return new Response('Export failed', { status: 500 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Drivers');
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  for (const d of data) ws.addRow(d);

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="drivers.xlsx"',
    },
  });
}
