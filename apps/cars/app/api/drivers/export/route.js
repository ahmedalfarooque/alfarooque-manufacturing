'use strict';

const ExcelJS = require('exceljs');
const { getDb } = require('@/lib/db');
const { requireSession , requireAction } = require('@/lib/http');

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
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  /* Must reflect the CURRENTLY FILTERED list on screen — same
     search/status filters as /api/drivers — not the unconditional full
     table. */
  const url = new URL(req.url);
  const search = (url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status') || 'All';

  const sb = getDb();
  let query = sb.from('drivers').select('*').order('full_name', { ascending: true });
  if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,license_number.ilike.%${search}%,iqama_number.ilike.%${search}%,employee_id.ilike.%${search}%`);
  if (status !== 'All') query = query.eq('status', status);

  const { data, error } = await query;
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
