'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action; // 'release' | 'fulfill'
  if (!['release', 'fulfill'].includes(action)) return json({ error: 'action must be release or fulfill.' }, 400);

  const { data: reservation } = await sb.from('inv_stock_reservations').select('*').eq('id', params.id).maybeSingle();
  if (!reservation) return json({ error: 'Reservation not found.' }, 404);
  if (reservation.status !== 'active') return json({ error: 'Reservation is not active.' }, 400);

  const { data: stock } = await sb.from('inv_stock')
    .select('id, qty_on_hand, qty_reserved')
    .eq('warehouse_id', reservation.warehouse_id)
    .eq(reservation.product_id ? 'product_id' : 'material_id', reservation.product_id || reservation.material_id)
    .maybeSingle();

  const now = new Date().toISOString();
  const qty = Number(reservation.qty);

  if (stock) {
    const newReserved = Math.max(0, Number(stock.qty_reserved) - qty);
    const patch = { qty_reserved: newReserved, updated_at: now };
    if (action === 'fulfill') patch.qty_on_hand = Math.max(0, Number(stock.qty_on_hand) - qty);
    await sb.from('inv_stock').update(patch).eq('id', stock.id);
  }

  await sb.from('inv_stock_reservations').update({
    status: action === 'fulfill' ? 'fulfilled' : 'released',
    released_at: now,
  }).eq('id', params.id);

  if (action === 'fulfill') {
    const filter = reservation.product_id
      ? { product_id: reservation.product_id, material_id: null }
      : { material_id: reservation.material_id, product_id: null };
    await sb.from('inv_stock_movements').insert({
      warehouse_id: reservation.warehouse_id,
      ...filter,
      movement_type: 'issue',
      qty,
      reference: reservation.reference_label || reservation.id,
      reference_type: 'reservation_fulfilled',
      reference_id: reservation.id,
      created_by: session.sub,
    });
  }

  return json({ ok: true });
}
