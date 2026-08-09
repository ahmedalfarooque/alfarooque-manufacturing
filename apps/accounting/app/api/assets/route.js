'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const category = q.get('category') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('acc_assets').select('*', { count: 'exact' });
  if (category) query = query.eq('category', category);
  query = query.order('purchase_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[assets] list failed:', error.message); return json({ error: 'Could not load assets.' }, 500); }
  return json({ assets: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.name) return json({ error: 'Asset name is required.' }, 400);
  if (!body.purchase_cost || Number(body.purchase_cost) <= 0) return json({ error: 'Purchase cost must be positive.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_assets').insert({
    name: String(body.name).trim(),
    category: body.category || 'Equipment',
    description: body.description || null,
    purchase_date: body.purchase_date || new Date().toISOString().slice(0, 10),
    purchase_cost: Number(body.purchase_cost),
    salvage_value: Number(body.salvage_value || 0),
    useful_life_years: Number(body.useful_life_years || 5),
    depreciation_method: body.depreciation_method || 'straight_line',
    current_book_value: Number(body.purchase_cost),
    accumulated_depreciation: 0,
    status: 'Active',
    vendor_name: body.vendor_name || null,
    serial_number: body.serial_number || null,
    location: body.location || null,
  }).select().single();
  if (error) { console.error('[assets] create failed:', error.message); return json({ error: 'Could not create asset.' }, 500); }
  return json({ asset: data }, 201);
}
