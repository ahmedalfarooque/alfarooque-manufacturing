'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

/* Price history for one material, newest first, with supplier names. */
export async function GET(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const { data, error } = await sb.from('qt_material_price_history')
    .select('id, price, previous_price, source, source_ref, effective_date, created_at, supplier:qt_suppliers(name)')
    .eq('material_id', params.id)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return json({ error: error.message }, 500);
  return json({ rows: data || [] });
}
