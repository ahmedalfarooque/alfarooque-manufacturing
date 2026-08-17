'use strict';

const ExcelJS = require('exceljs');
const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

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
  const { response, session } = await requireAction(req, 'view');
  if (response) return response;
  if (session.role === 'external') return json({ error: 'Not permitted.' }, 403);

  /* Mirrors the filtering in app/api/projects/route.js — the Excel export
     must carry the same currently-filtered complete dataset the on-screen
     list is showing (search/status/assignedUser/date range), never the
     unconditional full table. */
  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const status = q.get('status') || 'All';
  const assignedUser = q.get('assignedUser') || 'All';
  const dateFrom = q.get('dateFrom');
  const dateTo = q.get('dateTo');

  const sb = getDb();

  let assignedOnlyIds = null;
  if (assignedUser !== 'All') {
    const { data: rows } = await sb.from('pm_project_assignees').select('project_id').eq('user_id', assignedUser);
    assignedOnlyIds = (rows || []).map(r => r.project_id);
    if (!assignedOnlyIds.length) assignedOnlyIds = ['__none__'];
  }

  let query = sb.from('pm_projects').select('*');
  if (assignedOnlyIds) query = query.in('id', assignedOnlyIds);
  if (search) query = query.or(`project_name.ilike.%${search}%,customer_name.ilike.%${search}%,company_name.ilike.%${search}%`);
  if (status !== 'All') query = query.eq('status', status);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59.999');
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
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
