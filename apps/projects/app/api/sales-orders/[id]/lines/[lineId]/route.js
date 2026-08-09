'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: so } = await sb.from('sales_orders').select('id, status').eq('id', params.id).maybeSingle();
  if (!so) return json({ error: 'Sales order not found.' }, 404);
  if (so.status !== 'Draft') return json({ error: 'Lines can only be edited while the order is Draft.' }, 400);

  const { error } = await sb.from('sales_order_lines').delete().eq('id', params.lineId).eq('sales_order_id', params.id);
  if (error) return json({ error: 'Could not remove line item.' }, 500);

  const { data: lines } = await sb.from('sales_order_lines').select('qty, unit_price').eq('sales_order_id', params.id);
  const total_amount = (lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  await sb.from('sales_orders').update({ total_amount, updated_at: new Date().toISOString() }).eq('id', params.id);

  return json({ ok: true, total_amount });
}
