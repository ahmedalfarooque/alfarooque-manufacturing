'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const status = q.get('status') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('acc_bills').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`bill_number.ilike.%${search}%,vendor_name.ilike.%${search}%`);
  query = query.order('bill_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[bills] list failed:', error.message); return json({ error: 'Could not load bills.' }, 500); }
  return json({ bills: data || [], total: count || 0, page, pageSize });
}

const DESTINATIONS = ['warehouse', 'project', 'asset'];

/* Purchasing destination logic:
   - warehouse: each bill line with an inv_product_id/inv_material_id
     increases Inventory stock directly (inv_stock + inv_stock_movements,
     plus the denormalized qty_on_hand on inv_products/inv_materials —
     mirrors apps/inventory/lib/stockSync.js since accounting can't import
     across app boundaries).
   - project: no inventory change; project_id already tags the bill.
   - asset: registers a new fixed asset from the bill's total. */
async function applyPurchaseDestination(sb, bill, lineRows) {
  if (bill.destination_type === 'warehouse' && bill.destination_warehouse_id) {
    for (const line of lineRows) {
      if (!line.inv_product_id && !line.inv_material_id) continue;
      const filter = line.inv_product_id
        ? { product_id: line.inv_product_id, material_id: null }
        : { material_id: line.inv_material_id, product_id: null };

      const { data: existing } = await sb.from('inv_stock')
        .select('id, qty_on_hand, avg_cost')
        .eq('warehouse_id', bill.destination_warehouse_id)
        .eq(line.inv_product_id ? 'product_id' : 'material_id', line.inv_product_id || line.inv_material_id)
        .maybeSingle();

      const qty = Number(line.qty) || 0;
      const unitCost = Number(line.unit_price) || 0;
      if (existing) {
        const oldQty = Number(existing.qty_on_hand) || 0;
        const oldCost = Number(existing.avg_cost) || 0;
        const newQty = oldQty + qty;
        const newAvgCost = newQty > 0 ? ((oldQty * oldCost) + (qty * unitCost)) / newQty : unitCost;
        await sb.from('inv_stock').update({ qty_on_hand: newQty, avg_cost: newAvgCost, last_cost: unitCost, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await sb.from('inv_stock').insert({
          warehouse_id: bill.destination_warehouse_id, ...filter,
          qty_on_hand: qty, qty_reserved: 0, avg_cost: unitCost, last_cost: unitCost,
        });
      }

      await sb.from('inv_stock_movements').insert({
        warehouse_id: bill.destination_warehouse_id, ...filter,
        movement_type: 'receipt', qty, unit_cost: unitCost,
        reference: bill.bill_number || bill.id, reference_type: 'acc_bill', reference_id: bill.id,
        created_by: bill.created_by,
      });

      const table = line.inv_product_id ? 'inv_products' : 'inv_materials';
      const id = line.inv_product_id || line.inv_material_id;
      const { data: stockRows } = await sb.from('inv_stock').select('qty_on_hand').eq(line.inv_product_id ? 'product_id' : 'material_id', id);
      const total = (stockRows || []).reduce((s, r) => s + Number(r.qty_on_hand || 0), 0);
      await sb.from(table).update({ qty_on_hand: total, updated_at: new Date().toISOString() }).eq('id', id);
    }
  }

  if (bill.destination_type === 'asset') {
    await sb.from('acc_assets').insert({
      name: `${bill.vendor_name} — ${bill.bill_number || bill.id.slice(0, 8)}`,
      category: bill.asset_category || 'Equipment',
      description: bill.notes || null,
      purchase_date: bill.bill_date,
      purchase_cost: Number(bill.total_amount) || 0,
      current_book_value: Number(bill.total_amount) || 0,
      accumulated_depreciation: 0,
      status: 'Active',
      vendor_name: bill.vendor_name,
    }).catch(err => console.error('[bills] asset registration failed:', err.message));
  }
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.vendor_name) return json({ error: 'Vendor name is required.' }, 400);
  if (body.destination_type && !DESTINATIONS.includes(body.destination_type)) return json({ error: 'Invalid purchase destination.' }, 400);
  if (body.destination_type === 'warehouse' && !body.destination_warehouse_id) return json({ error: 'A warehouse is required for this destination.' }, 400);

  const lines = Array.isArray(body.lines) ? body.lines.filter(l => l && l.description) : [];
  let subtotal = Number(body.subtotal || 0);
  let taxAmount = Number(body.tax_amount || 0);
  let totalAmount = Number(body.total_amount || 0);
  if (lines.length > 0) {
    subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 1) * (Number(l.unit_price) || 0), 0);
    taxAmount = lines.reduce((s, l) => s + ((Number(l.qty) || 1) * (Number(l.unit_price) || 0)) * ((Number(l.tax_rate) || 0) / 100), 0);
    totalAmount = subtotal + taxAmount;
  }

  const sb = getDb();
  const { data, error } = await sb.from('acc_bills').insert({
    bill_number: body.bill_number || null,
    vendor_name: String(body.vendor_name).trim(),
    vendor_email: body.vendor_email || null,
    vendor_address: body.vendor_address || null,
    bill_date: body.bill_date || new Date().toISOString().slice(0, 10),
    due_date: body.due_date || null,
    currency: body.currency || 'SAR',
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    status: 'Draft',
    notes: body.notes || null,
    project_id: body.project_id || null,
    destination_type: body.destination_type || null,
    destination_warehouse_id: body.destination_type === 'warehouse' ? body.destination_warehouse_id : null,
    asset_category: body.destination_type === 'asset' ? (body.asset_category || null) : null,
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[bills] create failed:', error.message); return json({ error: 'Could not create bill.' }, 500); }

  let lineRows = [];
  if (lines.length > 0) {
    lineRows = lines.map((l, i) => {
      const qty = Number(l.qty) || 1;
      const unitPrice = Number(l.unit_price) || 0;
      const taxRate = Number(l.tax_rate) || 0;
      const lineTotal = qty * unitPrice * (1 + taxRate / 100);
      return {
        bill_id: data.id,
        inv_product_id: l.inv_product_id || null,
        inv_material_id: l.inv_material_id || null,
        description: String(l.description),
        qty, unit_price: unitPrice, tax_rate: taxRate,
        line_total: lineTotal,
        sort_order: i,
      };
    });
    await sb.from('acc_bill_lines').insert(lineRows).catch(err => console.error('[bills] lines insert failed:', err.message));
  }

  if (data.destination_type) {
    await applyPurchaseDestination(sb, data, lineRows).catch(err => console.error('[bills] destination logic failed:', err.message));
  }

  return json({ bill: data }, 201);
}
