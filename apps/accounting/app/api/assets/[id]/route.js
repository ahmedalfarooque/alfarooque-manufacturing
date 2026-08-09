'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['name', 'category', 'description', 'purchase_date', 'purchase_cost', 'salvage_value', 'useful_life_years', 'depreciation_method', 'current_book_value', 'accumulated_depreciation', 'status', 'vendor_name', 'serial_number', 'location'];
const VALID_STATUSES = ['Active', 'Disposed', 'Under Maintenance', 'Fully Depreciated'];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('acc_assets').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load asset.' }, 500);
  if (!data) return json({ error: 'Asset not found.' }, 404);
  return json({ asset: data });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  EDITABLE.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (patch.status && !VALID_STATUSES.includes(patch.status)) return json({ error: 'Invalid status.' }, 400);
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_assets').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[assets] update failed:', error.message); return json({ error: 'Could not update asset.' }, 500); }
  if (!data) return json({ error: 'Asset not found.' }, 404);
  return json({ asset: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('acc_assets').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete asset.' }, 500);
  return json({ ok: true });
}
