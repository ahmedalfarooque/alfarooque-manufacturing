'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response, session } = requireSession(req); // any authenticated internal user (admin or viewer) can view customers
  if (response) return response;
  if (session.role === 'external') return json({ error: 'Not permitted.' }, 403);

  const url = new URL(req.url);
  const search = (url.searchParams.get('search') || '').trim();
  const sb = getDb();
  let query = sb.from('customers').select('*').is('deleted_at', null).order('full_name', { ascending: true });
  if (search) query = query.or(`full_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,mobile_number.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) { console.error('[customers] list failed:', error.message); return json({ error: 'Could not load customers.' }, 500); }
  return json({ customers: data });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.full_name || '').trim();
  if (!fullName) return json({ error: 'Full name is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('customers').insert({
    full_name: fullName,
    company_name: body.company_name || null,
    email: body.email || null,
    mobile_number: body.mobile_number || null,
    vat_number: body.vat_number || null,
    cr_number: body.cr_number || null,
    address: body.address || null,
    city: body.city || null,
    country: body.country || null,
    notes: body.notes || null,
  }).select().single();
  if (error) { console.error('[customers] create failed:', error.message); return json({ error: 'Could not add customer.' }, 500); }
  return json({ customer: data }, 201);
}
