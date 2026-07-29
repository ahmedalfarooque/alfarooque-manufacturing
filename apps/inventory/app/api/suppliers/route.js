'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const offset = (page - 1) * limit;

  let q = sb.from('inv_suppliers').select('*', { count: 'exact' });
  if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  const activeParam = searchParams.get('active');
  if (activeParam !== null) q = q.eq('is_active', activeParam !== 'false');
  const { data, count, error } = await q.order('name', { ascending: true }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load suppliers.' }, 500);
  return json({ suppliers: data || [], total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Supplier name is required.' }, 400);

  const { data, error } = await sb.from('inv_suppliers').insert({
    name,
    email: body.email || null,
    phone: body.phone || null,
    address: body.address || null,
    city: body.city || null,
    country: body.country || 'Saudi Arabia',
    vat_number: body.vat_number || null,
    contact_person: body.contact_person || null,
    notes: body.notes || null,
    is_active: true,
  }).select().single();
  if (error) return json({ error: 'Could not add supplier.' }, 500);
  return json({ supplier: data }, 201);
}
