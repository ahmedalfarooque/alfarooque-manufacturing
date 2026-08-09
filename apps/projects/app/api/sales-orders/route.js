'use strict';

/* Sales Orders — tracks the Quotation → Reserve Stock → Deliver → Invoice →
   Payment chain as one auditable record. Reads/writes qt_quotations,
   inv_stock_reservations, and acc_invoices directly (same Supabase
   project, same cross-app pattern already used by Accounting's
   Purchasing destination logic and CRM's Quotation/Project links). */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';

  const sb = getDb();
  let query = sb.from('sales_orders').select('*, sales_order_lines(*)').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { console.error('[sales-orders] list failed:', error.message); return json({ error: 'Could not load sales orders.' }, 500); }
  return json({ salesOrders: data || [] });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const sb = getDb();

  let customerName = body.customer_name;
  let quotationId = body.quotation_id || null;
  let projectId = body.project_id || null;
  let totalAmount = Number(body.total_amount || 0);
  let lines = Array.isArray(body.lines) ? body.lines : [];

  /* Pre-fill from an existing quotation if given — mirrors the same
     quotation → pm_projects conversion pattern used by
     app/api/quotation-requests/[id]/start-project/route.js. */
  if (quotationId) {
    const { data: qn } = await sb.from('qt_quotations')
      .select('*, customer:customers(company_name, company_name_en, company_name_ar)')
      .eq('id', quotationId).maybeSingle();
    if (qn) {
      const customer = qn.customer || {};
      customerName = customerName || customer.company_name_en || customer.company_name_ar || customer.company_name || 'Unknown Customer';
      totalAmount = totalAmount || Number(qn.grand_total || 0);
      projectId = projectId || qn.project_id || null;
    }
  }

  if (!customerName) return json({ error: 'Customer name is required.' }, 400);

  if (quotationId) {
    const { data: existing } = await sb.from('sales_orders')
      .select('id').eq('quotation_id', quotationId).neq('status', 'Cancelled').maybeSingle();
    if (existing) return json({ salesOrder: existing, existing: true });
  }

  const { data: so, error } = await sb.from('sales_orders').insert({
    so_number: body.so_number || null,
    quotation_id: quotationId,
    project_id: projectId,
    customer_name: customerName,
    currency: body.currency || 'SAR',
    total_amount: totalAmount,
    status: 'Draft',
    notes: body.notes || null,
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[sales-orders] create failed:', error.message); return json({ error: 'Could not create sales order.' }, 500); }

  if (lines.length > 0) {
    const lineRows = lines.filter(l => l && l.description).map(l => ({
      sales_order_id: so.id,
      description: String(l.description),
      inv_product_id: l.inv_product_id || null,
      inv_material_id: l.inv_material_id || null,
      qty: Number(l.qty) || 1,
      unit_price: Number(l.unit_price) || 0,
      warehouse_id: l.warehouse_id || null,
    }));
    if (lineRows.length > 0) await sb.from('sales_order_lines').insert(lineRows).catch(err => console.error('[sales-orders] lines insert failed:', err.message));
  }

  return json({ salesOrder: so }, 201);
}
