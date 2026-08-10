'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const type = q.get('type') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('crm_contacts').select('*', { count: 'exact' });
  if (type) query = query.eq('contact_type', type);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%,phone.ilike.%${search}%`);
  query = query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  let { data, error, count } = await query;
  if (error) { console.error('[crm/contacts] list failed:', error.message); return json({ error: 'Could not load contacts.' }, 500); }
  if (!count) {
    let legacy = sb.from('customers').select('*', { count: 'exact' }).is('deleted_at', null);
    if (type) legacy = legacy.eq('customer_type', type);
    if (search) legacy = legacy.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%,mobile_number.ilike.%${search}%`);
    const legacyRes = await legacy.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (!legacyRes.error) {
      data = (legacyRes.data || []).map(row => ({ ...row, name: row.full_name, phone: row.mobile_number, company: row.company_name, contact_type: row.customer_type || 'Customer', source_table: 'customers' }));
      count = legacyRes.count || 0;
    }
  }
  return json({ contacts: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.name) return json({ error: 'Name is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('crm_contacts').insert({
    name: String(body.name).trim(),
    email: body.email || null,
    phone: body.phone || null,
    company: body.company || null,
    job_title: body.job_title || null,
    contact_type: body.contact_type || 'Lead',
    source: body.source || null,
    address: body.address || null,
    notes: body.notes || null,
    tags: body.tags || null,
    assigned_to: body.assigned_to || session.sub,
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[crm/contacts] create failed:', error.message); return json({ error: 'Could not create contact.' }, 500); }
  await sb.from('crm_customer_identities').insert({
    crm_contact_id: data.id,
    display_name: data.name,
    normalized_email: data.email ? String(data.email).trim().toLowerCase() : null,
    normalized_phone: data.phone ? String(data.phone).replace(/\D/g, '') : null,
    company_name: data.company || null,
    created_by: session.sub,
  });
  return json({ contact: data }, 201);
}
