'use strict';

const ExcelJS = require('exceljs');
const { getDb } = require('@/lib/db');
const { requireSession , requireAction } = require('@/lib/http');

const COLUMNS = [
  { header: 'Vehicle Number', key: 'vehicle_number', width: 16 },
  { header: 'Vehicle Name', key: 'name', width: 20 },
  { header: 'Type', key: 'type', width: 12 },
  { header: 'Fuel Type', key: 'fuel_type', width: 12 },
  { header: 'Driver', key: 'driver', width: 16 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Current KM', key: 'current_km', width: 14 },
  { header: 'Location', key: 'location', width: 18 },
  { header: 'Last Update', key: 'last_update', width: 20 },
];

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  /* Must reflect the CURRENTLY FILTERED list, not the unconditional full
     table — same search/status/type/fuelType/assignment filters as
     /api/cars (the on-screen list), so Excel export matches what the
     user is actually looking at. */
  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const status = q.get('status') || 'All';
  const type = q.get('type') || 'All';
  const fuelType = q.get('fuelType') || 'All';
  const assignment = q.get('assignment') || 'All';

  const sb = getDb();
  let query = sb.from('cars').select('*').eq('is_active', true);
  if (search) query = query.or(`vehicle_number.ilike.%${search}%,name.ilike.%${search}%,driver.ilike.%${search}%`);
  if (status !== 'All') query = query.eq('status', status);
  if (type !== 'All') query = query.eq('type', type);
  if (fuelType !== 'All') query = query.eq('fuel_type', fuelType);
  if (assignment === 'Assigned') query = query.not('driver', 'is', null).neq('driver', '');
  if (assignment === 'Unassigned') query = query.or('driver.is.null,driver.eq.');
  query = query.order('last_update', { ascending: false });

  const { data, error } = await query;
  if (error) return new Response('Export failed', { status: 500 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Vehicles');
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  for (const car of data) {
    ws.addRow({ ...car, last_update: new Date(car.last_update).toLocaleString() });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="vehicles.xlsx"',
    },
  });
}
