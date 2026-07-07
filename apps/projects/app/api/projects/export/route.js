'use strict';

const ExcelJS = require('exceljs');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const COLUMNS = [
  { header: 'Customer Name', key: 'customer_name', width: 18 },
  { header: 'Company', key: 'company_name', width: 18 },
  { header: 'Project Name', key: 'project_name', width: 22 },
  { header: 'Start Date', key: 'start_date', width: 14 },
  { header: 'End Date', key: 'end_date', width: 14 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Progress %', key: 'progress', width: 12 },
];

export async function GET(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  if (session.role === 'external') return json({ error: 'Not permitted.' }, 403);

  const sb = getDb();
  const { data, error } = await sb.from('pm_projects').select('*').order('created_at', { ascending: false });
  if (error) return new Response('Export failed', { status: 500 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Projects');
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  for (const p of data) ws.addRow(p);

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="projects.xlsx"',
    },
  });
}
