'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { cloneQuotation } = require('@/lib/quotes');

export async function POST(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const { data: qn } = await sb.from('qt_quotations').select('status').eq('id', params.id).is('deleted_at', null).single();
  if (!qn) return json({ error: 'Not found' }, 404);
  if (['draft', 'superseded', 'cancelled'].includes(qn.status)) {
    return json({ error: 'Cannot revise a quotation in status ' + qn.status }, 409);
  }
  const result = await cloneQuotation(sb, params.id, session, 'revision');
  if (result.error) return json({ error: result.error }, 400);
  return json({ id: result.id }, 201);
}
