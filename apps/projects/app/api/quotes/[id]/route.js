'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { QUOTE_STATUSES, hasSoftDelete, logError } = require('@/lib/ordersQuotesCore');

export async function GET(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const softDeleteEnabled = await hasSoftDelete(sb, 'quotes');
  let q = sb.from('quotes').select('*').eq('id', params.id);
  if (softDeleteEnabled) q = q.eq('is_deleted', false);
  const { data, error } = await q.maybeSingle();
  if (error) return json({ error: logError('quotes', error, 'Quotes') }, 500);
  if (!data) return json({ error: 'Quote not found.' }, 404);
  return json({ quote: data, softDeleteEnabled });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const sb = getDb();
  const softDeleteEnabled = await hasSoftDelete(sb, 'quotes');
  const patch = {};
  if (body.status !== undefined) {
    if (!QUOTE_STATUSES.includes(body.status)) return json({ error: 'Invalid status.' }, 400);
    patch.status = body.status;
  }
  if (body.admin_notes !== undefined) patch.admin_notes = String(body.admin_notes || '').slice(0, 2000);
  if (!Object.keys(patch).length) return json({ error: 'Nothing to update.' }, 400);

  let q = sb.from('quotes').update(patch).eq('id', params.id);
  if (softDeleteEnabled) q = q.eq('is_deleted', false);
  const { data, error } = await q.select().single();
  if (error) return json({ error: logError('quotes', error, 'Quotes') }, 500);
  return json({ quote: data });
}
