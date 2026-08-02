'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: so, error } = await sb.from('sales_orders').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load sales order.' }, 500);
  if (!so) return json({ error: 'Sales order not found.' }, 404);

  const { data: lines } = await sb.from('sales_order_lines')
    .select('*, inv_products(name, sku), inv_materials(name, material_code), inv_warehouses(name)')
    .eq('sales_order_id', params.id);

  let quotation = null, project = null, invoice = null;
  if (so.quotation_id) { const { data } = await sb.from('qt_quotations').select('id, quote_number, status').eq('id', so.quotation_id).maybeSingle(); quotation = data || null; }
  if (so.project_id) { const { data } = await sb.from('pm_projects').select('id, project_name, status').eq('id', so.project_id).maybeSingle(); project = data || null; }
  if (so.invoice_id) { const { data } = await sb.from('acc_invoices').select('id, invoice_number, status, total_amount').eq('id', so.invoice_id).maybeSingle(); invoice = data || null; }

  return json({ salesOrder: so, lines: lines || [], quotation, project, invoice });
}

/* Reserve: for each line with an inventory item + warehouse, create an
   inv_stock_reservations row (same effect as calling Inventory's own
   POST /api/reservations — inlined here since Projects can't import
   across app boundaries, same reasoning as Accounting's Purchasing
   destination logic). */
async function reserveLines(sb, so, lines, session) {
  for (const line of lines) {
    if ((!line.inv_product_id && !line.inv_material_id) || !line.warehouse_id) continue;
    const qty = Number(line.qty) || 0;
    if (!qty) continue;

    const { data: stock } = await sb.from('inv_stock')
      .select('id, qty_on_hand, qty_reserved')
      .eq('warehouse_id', line.warehouse_id)
      .eq(line.inv_product_id ? 'product_id' : 'material_id', line.inv_product_id || line.inv_material_id)
      .maybeSingle();
    const available = stock ? Number(stock.qty_on_hand) - Number(stock.qty_reserved) : 0;
    if (!stock || available < qty) throw new Error(`Insufficient available stock for one of the line items (available: ${available}).`);

    await sb.from('inv_stock').update({ qty_reserved: Number(stock.qty_reserved) + qty, updated_at: new Date().toISOString() }).eq('id', stock.id);

    const { data: reservation } = await sb.from('inv_stock_reservations').insert({
      product_id: line.inv_product_id || null,
      material_id: line.inv_material_id || null,
      warehouse_id: line.warehouse_id,
      qty, status: 'active',
      reference_type: 'sales_order', reference_id: so.id, reference_label: so.so_number || so.id,
      reserved_by: session.sub,
    }).select().single();

    await sb.from('sales_order_lines').update({ reservation_id: reservation.id }).eq('id', line.id);
  }
}

/* Deliver: fulfills every active reservation tied to this order's lines
   (decrements qty_reserved AND qty_on_hand, writes an 'issue' movement —
   identical effect to Inventory's own reservation fulfill action). */
async function deliverLines(sb, so, lines, session) {
  for (const line of lines) {
    if (!line.reservation_id) continue;
    const { data: reservation } = await sb.from('inv_stock_reservations').select('*').eq('id', line.reservation_id).maybeSingle();
    if (!reservation || reservation.status !== 'active') continue;

    const { data: stock } = await sb.from('inv_stock')
      .select('id, qty_on_hand, qty_reserved')
      .eq('warehouse_id', reservation.warehouse_id)
      .eq(reservation.product_id ? 'product_id' : 'material_id', reservation.product_id || reservation.material_id)
      .maybeSingle();
    const qty = Number(reservation.qty);
    if (stock) {
      await sb.from('inv_stock').update({
        qty_reserved: Math.max(0, Number(stock.qty_reserved) - qty),
        qty_on_hand: Math.max(0, Number(stock.qty_on_hand) - qty),
        updated_at: new Date().toISOString(),
      }).eq('id', stock.id);
    }

    await sb.from('inv_stock_reservations').update({ status: 'fulfilled', released_at: new Date().toISOString() }).eq('id', reservation.id);

    const filter = reservation.product_id ? { product_id: reservation.product_id, material_id: null } : { material_id: reservation.material_id, product_id: null };
    await sb.from('inv_stock_movements').insert({
      warehouse_id: reservation.warehouse_id, ...filter,
      movement_type: 'issue', qty,
      reference: so.so_number || so.id, reference_type: 'sales_order', reference_id: so.id,
      created_by: session.sub,
    });

    const table = reservation.product_id ? 'inv_products' : 'inv_materials';
    const itemId = reservation.product_id || reservation.material_id;
    const { data: stockRows } = await sb.from('inv_stock').select('qty_on_hand').eq(reservation.product_id ? 'product_id' : 'material_id', itemId);
    const total = (stockRows || []).reduce((s, r) => s + Number(r.qty_on_hand || 0), 0);
    await sb.from(table).update({ qty_on_hand: total, updated_at: new Date().toISOString() }).eq('id', itemId);
  }
}

/* Invoice: creates the Accounting invoice (+ lines) directly in
   acc_invoices/acc_invoice_lines — same cross-app write pattern as
   Accounting's own Purchasing destination logic, just in the other
   direction. */
async function createInvoiceForOrder(sb, so, lines, session) {
  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const { data: invoice, error } = await sb.from('acc_invoices').insert({
    customer_name: so.customer_name,
    invoice_date: new Date().toISOString().slice(0, 10),
    currency: so.currency || 'SAR',
    subtotal,
    tax_amount: 0,
    total_amount: subtotal,
    status: 'Draft',
    notes: `Generated from Sales Order ${so.so_number || so.id}`,
    project_id: so.project_id || null,
    created_by: session.sub,
  }).select().single();
  if (error) throw new Error('Could not create invoice: ' + error.message);

  const lineRows = lines.map((l, i) => ({
    invoice_id: invoice.id,
    inv_product_id: l.inv_product_id || null,
    description: l.description,
    qty: Number(l.qty) || 1,
    unit_price: Number(l.unit_price) || 0,
    tax_rate: 0,
    line_total: (Number(l.qty) || 1) * (Number(l.unit_price) || 0),
    sort_order: i,
  }));
  if (lineRows.length > 0) await sb.from('acc_invoice_lines').insert(lineRows).catch(() => {});

  return invoice;
}

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: so } = await sb.from('sales_orders').select('*').eq('id', params.id).maybeSingle();
  if (!so) return json({ error: 'Sales order not found.' }, 404);

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  const { data: lines } = await sb.from('sales_order_lines').select('*').eq('sales_order_id', params.id);

  try {
    if (action === 'reserve') {
      if (so.status !== 'Draft') return json({ error: 'Only a Draft order can be reserved.' }, 400);
      await reserveLines(sb, so, lines || [], session);
      await sb.from('sales_orders').update({ status: 'Reserved', updated_at: new Date().toISOString() }).eq('id', params.id);
    } else if (action === 'deliver') {
      if (so.status !== 'Reserved') return json({ error: 'Only a Reserved order can be delivered.' }, 400);
      await deliverLines(sb, so, lines || [], session);
      await sb.from('sales_orders').update({ status: 'Delivered', updated_at: new Date().toISOString() }).eq('id', params.id);
    } else if (action === 'invoice') {
      if (!['Delivered', 'Draft'].includes(so.status)) return json({ error: 'Order must be Delivered (or Draft with no inventory lines) before invoicing.' }, 400);
      const invoice = await createInvoiceForOrder(sb, so, lines || [], session);
      await sb.from('sales_orders').update({ status: 'Invoiced', invoice_id: invoice.id, updated_at: new Date().toISOString() }).eq('id', params.id);
    } else if (action === 'mark-paid') {
      if (so.status !== 'Invoiced') return json({ error: 'Only an Invoiced order can be marked Paid.' }, 400);
      if (so.invoice_id) await sb.from('acc_invoices').update({ status: 'Paid' }).eq('id', so.invoice_id);
      await sb.from('sales_orders').update({ status: 'Paid', updated_at: new Date().toISOString() }).eq('id', params.id);
    } else if (action === 'cancel') {
      if (so.status === 'Reserved') {
        for (const line of lines || []) {
          if (!line.reservation_id) continue;
          const { data: reservation } = await sb.from('inv_stock_reservations').select('*').eq('id', line.reservation_id).maybeSingle();
          if (!reservation || reservation.status !== 'active') continue;
          const { data: stock } = await sb.from('inv_stock')
            .select('id, qty_reserved')
            .eq('warehouse_id', reservation.warehouse_id)
            .eq(reservation.product_id ? 'product_id' : 'material_id', reservation.product_id || reservation.material_id)
            .maybeSingle();
          if (stock) await sb.from('inv_stock').update({ qty_reserved: Math.max(0, Number(stock.qty_reserved) - Number(reservation.qty)) }).eq('id', stock.id);
          await sb.from('inv_stock_reservations').update({ status: 'released', released_at: new Date().toISOString() }).eq('id', reservation.id);
        }
      }
      await sb.from('sales_orders').update({ status: 'Cancelled', updated_at: new Date().toISOString() }).eq('id', params.id);
    } else {
      const EDITABLE = ['customer_name', 'notes', 'currency', 'total_amount'];
      const patch = {};
      EDITABLE.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
      if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);
      patch.updated_at = new Date().toISOString();
      await sb.from('sales_orders').update(patch).eq('id', params.id);
    }
  } catch (err) {
    return json({ error: err.message }, 400);
  }

  const { data: updated } = await sb.from('sales_orders').select('*').eq('id', params.id).maybeSingle();
  return json({ salesOrder: updated });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: so } = await sb.from('sales_orders').select('status').eq('id', params.id).maybeSingle();
  if (!so) return json({ error: 'Sales order not found.' }, 404);
  if (so.status !== 'Draft') return json({ error: 'Only a Draft order can be deleted.' }, 400);

  const { error } = await sb.from('sales_orders').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete sales order.' }, 500);
  return json({ ok: true });
}
