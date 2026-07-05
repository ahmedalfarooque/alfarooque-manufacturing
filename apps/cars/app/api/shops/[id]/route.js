'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['name', 'contact_person', 'mobile', 'telephone', 'email', 'address', 'city', 'vat_number', 'cr_number', 'notes'];

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('maintenance_shops').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[shops] update failed:', error.message); return json({ error: 'Could not update shop.' }, 500); }
  if (!data) return json({ error: 'Shop not found.' }, 404);
  return json({ shop: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { count } = await sb.from('car_maintenance_records').select('id', { count: 'exact', head: true }).eq('shop_id', params.id);
  if (count) return json({ error: `Cannot delete — ${count} maintenance record(s) reference this shop.` }, 409);

  const { error } = await sb.from('maintenance_shops').delete().eq('id', params.id);
  if (error) { console.error('[shops] delete failed:', error.message); return json({ error: 'Could not delete shop.' }, 500); }
  return json({ ok: true });
}
