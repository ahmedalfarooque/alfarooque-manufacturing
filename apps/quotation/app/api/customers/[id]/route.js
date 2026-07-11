'use strict';

/* See app/api/customers/route.js for why this maps phone <-> mobile_number
   against the shared public.customers table. */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit, applyBilingual } = require('@/lib/crud');

const UI_FIELDS = ['code', 'company_name', 'company_name_en', 'company_name_ar',
  'contact_person', 'contact_person_en', 'contact_person_ar', 'phone', 'phone2',
  'email', 'address', 'city', 'customer_type', 'vat_number', 'cr_number', 'notes', 'status'];

function toDbRow(body) {
  const out = {};
  for (const f of UI_FIELDS) {
    if (body[f] === undefined) continue;
    const col = f === 'phone' ? 'mobile_number' : f;
    out[col] = body[f] === '' ? null : body[f];
  }
  return out;
}
function fromDbRow(row) {
  if (!row) return row;
  const { mobile_number, ...rest } = row;
  return { ...rest, phone: mobile_number };
}

export async function GET(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const { data, error } = await sb.from('customers').select('*').eq('id', params.id).is('deleted_at', null).single();
  if (error || !data) return json({ error: 'Not found' }, 404);
  return json({ row: fromDbRow(data) });
}

export async function PATCH(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  const { data: before } = await sb.from('customers').select('*').eq('id', params.id).single();
  if (!before) return json({ error: 'Not found' }, 404);
  let patch = toDbRow(body);
  patch = applyBilingual(patch, ['company_name', 'contact_person'], before);
  const effCompanyName = patch.company_name !== undefined ? patch.company_name : before.company_name;
  if (!effCompanyName || !String(effCompanyName).trim()) return json({ error: '"company_name" is required.' }, 400);
  if (patch.company_name !== undefined) patch.full_name = patch.company_name;
  patch.updated_by = session.sub;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await sb.from('customers').update(patch).eq('id', params.id).select().single();
  if (error) return json({ error: error.message }, 400);
  await audit(sb, 'customers', params.id, 'update', before, data, session.sub);
  return json({ row: fromDbRow(data) });
}

export async function DELETE(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const { data: before } = await sb.from('customers').select('*').eq('id', params.id).single();
  const { error } = await sb.from('customers')
    .update({ deleted_at: new Date().toISOString(), updated_by: session.sub })
    .eq('id', params.id);
  if (error) return json({ error: error.message }, 400);
  await audit(sb, 'customers', params.id, 'delete', before, null, session.sub);
  return json({ ok: true });
}
