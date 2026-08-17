'use strict';

/* Accounting-side entry point for the SAME pm_purchase_requests table the
   Projects app already owns — no duplicate table, no duplicate model.
   A Purchase Request created here may have project_id = null (schema
   change in 20260813120000_purchase_request_project_optional.sql) and be
   connected to a project later via PATCH on the [id] route. */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb
    .from('pm_purchase_requests')
    .select('*, pm_projects(id, project_name, customer_name), inv_products(name), inv_materials(name)')
    .order('created_at', { ascending: false });
  if (error) return json({ error: 'Could not load purchase requests.' }, 500);
  const requests = (data || []).map(r => ({
    ...r,
    project_name: r.pm_projects?.project_name || null,
    customer_name: r.pm_projects?.customer_name || null,
    linked_item_name: r.inv_products?.name || r.inv_materials?.name || null,
    pm_projects: undefined, inv_products: undefined, inv_materials: undefined,
  }));
  return json({ purchaseRequests: requests });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  const materialDescription = String(body.material_description || '').trim();
  if (!materialDescription) return json({ error: 'Material description is required.' }, 400);
  const priority = ['Normal', 'Urgent', 'Critical'].includes(body.priority) ? body.priority : 'Normal';
  const sb = getDb();

  if (body.project_id) {
    const { data: project } = await sb.from('pm_projects').select('id').eq('id', body.project_id).maybeSingle();
    if (!project) return json({ error: 'Project not found.' }, 404);
  }

  const { data: row, error } = await sb.from('pm_purchase_requests').insert({
    project_id: body.project_id || null,
    requested_by: session.sub,
    request_date: body.request_date || new Date().toISOString().slice(0, 10),
    supplier: body.supplier || null,
    material_description: materialDescription,
    material_list: body.material_list || null,
    quantity: body.quantity || null,
    unit: body.unit || null,
    /* Deliberately left null when unknown — never defaulted to 0. A null
       estimated_price means "no estimate", not "free". */
    estimated_price: body.estimated_price === undefined || body.estimated_price === '' ? null : body.estimated_price,
    required_date: body.required_date || null,
    priority,
    remarks: body.remarks || null,
    inv_material_id: body.inv_material_id || null,
    inv_product_id: body.inv_product_id || null,
  }).select().single();
  if (error) { console.error('[accounting purchase-requests] create failed:', error.message); return json({ error: 'Could not create the purchase request.' }, 500); }
  return json({ purchaseRequest: row }, 201);
}
