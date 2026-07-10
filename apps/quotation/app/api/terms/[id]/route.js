'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const { data, error } = await sb.from('qt_terms_templates')
    .select('id, title, body').eq('id', params.id).is('deleted_at', null).single();
  if (error || !data) return json({ error: 'Not found' }, 404);
  return json({ row: data });
}
