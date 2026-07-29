'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_goods_receipts')
    .select('*, inv_suppliers(name), inv_warehouses(name), inv_goods_receipt_items(*, inv_products(name, sku), inv_materials(name, material_code))')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load goods receipt.' }, 500);
  if (!data) return json({ error: 'Goods receipt not found.' }, 404);
  return json({ receipt: data });
}

export async function DELETE(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  await sb.from('inv_goods_receipt_items').delete().eq('gr_id', params.id);
  const { error } = await sb.from('inv_goods_receipts').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete goods receipt.' }, 500);
  return json({ ok: true });
}
