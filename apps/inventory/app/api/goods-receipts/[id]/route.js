'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');
const { syncItemQty } = require('@/lib/stockSync');

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

  const { data: gr } = await sb.from('inv_goods_receipts').select('id, gr_number, warehouse_id').eq('id', params.id).maybeSingle();
  if (!gr) return json({ error: 'Goods receipt not found.' }, 404);

  const { data: items } = await sb.from('inv_goods_receipt_items').select('*').eq('gr_id', params.id);

  /* Reverse the stock effect this receipt originally applied — otherwise
     deleting a receipt permanently inflates on-hand stock with no way to
     correct it through the app (found by the production-readiness audit). */
  for (const it of items || []) {
    const qty = Number(it.qty_received) || 0;
    if (!qty) continue;
    const filter = it.product_id ? { product_id: it.product_id, material_id: null } : { material_id: it.material_id, product_id: null };

    const { data: stock } = await sb.from('inv_stock')
      .select('id, qty_on_hand').eq('warehouse_id', gr.warehouse_id)
      .eq(it.product_id ? 'product_id' : 'material_id', it.product_id || it.material_id)
      .maybeSingle();
    if (stock) {
      await sb.from('inv_stock').update({ qty_on_hand: Math.max(0, Number(stock.qty_on_hand) - qty), updated_at: new Date().toISOString() }).eq('id', stock.id);
    }

    await sb.from('inv_stock_movements').insert({
      warehouse_id: gr.warehouse_id, location_id: it.location_id || null, ...filter,
      movement_type: 'adjustment_out', qty, unit_cost: it.unit_cost || 0,
      reference: gr.gr_number || gr.id, reference_type: 'goods_receipt_deleted', reference_id: gr.id,
      created_by: session.sub,
    });

    await syncItemQty(sb, { productId: it.product_id || null, materialId: it.material_id || null });
  }

  await sb.from('inv_goods_receipt_items').delete().eq('gr_id', params.id);
  const { error } = await sb.from('inv_goods_receipts').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete goods receipt.' }, 500);
  return json({ ok: true });
}
