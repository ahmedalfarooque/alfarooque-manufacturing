'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const search = (url.searchParams.get('search') || '').trim();
  const sb = getDb();
  let query = sb.from('maintenance_shops').select('*').order('name', { ascending: true });
  if (search) query = query.or(`name.ilike.%${search}%,contact_person.ilike.%${search}%,city.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) { console.error('[shops] list failed:', error.message); return json({ error: 'Could not load shops.' }, 500); }
  return json({ shops: data || [] });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Shop name is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('maintenance_shops').insert({
    name,
    contact_person: body.contact_person || null,
    mobile: body.mobile || null,
    telephone: body.telephone || null,
    email: body.email || null,
    address: body.address || null,
    city: body.city || null,
    vat_number: body.vat_number || null,
    cr_number: body.cr_number || null,
    notes: body.notes || null,
  }).select().single();
  if (error) { console.error('[shops] create failed:', error.message); return json({ error: 'Could not add shop.' }, 500); }
  return json({ shop: data }, 201);
}
