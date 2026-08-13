'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  let { data, error } = await sb.from('inv_suppliers').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load supplier.' }, 500);
  if (!data) {
    const legacy = await sb.from('qt_suppliers').select('*').eq('id', params.id).is('deleted_at', null).maybeSingle();
    if (legacy.error) return json({ error: 'Could not load supplier.' }, 500);
    if (legacy.data) data = { ...legacy.data, source_table: 'qt_suppliers' };
  }
  if (!data) return json({ error: 'Supplier not found.' }, 404);
  return json({ supplier: data });
}

export async function PUT(req, { params }) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  const { error } = await sb.from('inv_suppliers').update({
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    address: body.address || null,
    city: body.city || null,
    country: body.country || null,
    vat_number: body.vat_number || null,
    contact_person: body.contact_person || null,
    notes: body.notes || null,
    is_active: body.is_active !== false,
  }).eq('id', params.id);
  if (error) return json({ error: 'Could not update supplier.' }, 500);
  return json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { response, session } = await requireDelete(req);
  if (response) return response;
  const sb = getDb();

  const { error } = await sb.from('inv_suppliers').update({ is_active: false }).eq('id', params.id);
  if (error) return json({ error: 'Could not deactivate supplier.' }, 500);
  return json({ ok: true });
}
