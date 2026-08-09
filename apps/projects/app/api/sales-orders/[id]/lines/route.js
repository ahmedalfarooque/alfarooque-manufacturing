'use strict';

/* Add/remove Sales Order line items — split out from the parent order route
   since lines can only be edited while the order is still in Draft (before
   reserve/deliver/invoice locks quantities in place). */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

async function recomputeTotal(sb, salesOrderId) {
  const { data: lines } = await sb.from('sales_order_lines').select('qty, unit_price').eq('sales_order_id', salesOrderId);
  const total = (lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  await sb.from('sales_orders').update({ total_amount: total, updated_at: new Date().toISOString() }).eq('id', salesOrderId);
  return total;
}

export async function POST(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: so } = await sb.from('sales_orders').select('id, status').eq('id', params.id).maybeSingle();
  if (!so) return json({ error: 'Sales order not found.' }, 404);
  if (so.status !== 'Draft') return json({ error: 'Lines can only be edited while the order is Draft.' }, 400);

  const body = await req.json().catch(() => ({}));
  if (!body.description) return json({ error: 'Description is required.' }, 400);

  const { error } = await sb.from('sales_order_lines').insert({
    sales_order_id: params.id,
    description: String(body.description),
    inv_product_id: body.inv_product_id || null,
    inv_material_id: body.inv_material_id || null,
    qty: Number(body.qty) || 1,
    unit_price: Number(body.unit_price) || 0,
    warehouse_id: body.warehouse_id || null,
  });
  if (error) return json({ error: 'Could not add line item.' }, 500);

  const total_amount = await recomputeTotal(sb, params.id);
  return json({ ok: true, total_amount }, 201);
}
