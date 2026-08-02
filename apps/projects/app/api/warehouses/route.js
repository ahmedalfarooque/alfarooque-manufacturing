'use strict';

/* GET /api/warehouses — lists inv_warehouses directly (same Supabase
   project) so the Sales Order line-item picker can assign a warehouse. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data } = await sb.from('inv_warehouses').select('id, name').order('name');
  return json({ warehouses: data || [] });
}
