'use strict';

/* GET /api/warehouses — reads inv_warehouses directly (same Supabase
   project) so a Bill's purchase destination can target a specific
   warehouse without duplicating warehouse data in accounting. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('inv_warehouses').select('id, name').eq('is_active', true).order('name');
  if (error) return json({ error: 'Could not load warehouses.' }, 500);
  return json({ warehouses: data || [] });
}
