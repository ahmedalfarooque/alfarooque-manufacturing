'use strict';

const ExcelJS = require('exceljs');
const { getDb } = require('@/lib/db');
const { requireSession } = require('@/lib/http');

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
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('cars').select('*').eq('is_active', true).order('last_update', { ascending: false });
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
