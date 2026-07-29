'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_suppliers').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load supplier.' }, 500);
  if (!data) return json({ error: 'Supplier not found.' }, 404);
  return json({ supplier: data });
}

export async function PUT(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

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
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  const { error } = await sb.from('inv_suppliers').update({ is_active: false }).eq('id', params.id);
  if (error) return json({ error: 'Could not deactivate supplier.' }, 500);
  return json({ ok: true });
}
