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

  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const status = q.get('status') || '';
  const priority = q.get('priority') || '';
  const supplier = (q.get('supplier') || '').trim();
  const project = (q.get('project') || '').trim();
  const dateFrom = q.get('dateFrom') || '';
  const dateTo = q.get('dateTo') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(500, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  let query = sb.from('pm_purchase_requests')
    .select('*, pm_projects(id, project_name, customer_name), inv_products(name), inv_materials(name)', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (supplier) query = query.ilike('supplier', `%${supplier}%`);
  /* project comes from the client's exact-match dropdown (its options are
     the distinct project_name values already on-screen), but project_name
     itself lives on the joined pm_projects row, not a column of
     pm_purchase_requests — so it's resolved to project_id(s) first, same
     as any other FK-backed filter, rather than attempting an embedded-
     resource filter here. */
  if (project) {
    const { data: matchingProjects } = await sb.from('pm_projects').select('id').eq('project_name', project);
    const ids = (matchingProjects || []).map(p => p.id);
    query = ids.length ? query.in('project_id', ids) : query.eq('project_id', '00000000-0000-0000-0000-000000000000');
  }
  if (search) query = query.or(`material_description.ilike.%${search}%,supplier.ilike.%${search}%`);
  if (dateFrom) query = query.gte('request_date', dateFrom);
  if (dateTo) query = query.lte('request_date', dateTo);
  query = query.order('request_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[purchase-requests] list failed:', error.message); return json({ error: 'Could not load purchase requests.' }, 500); }
  const requests = (data || []).map(r => ({
    ...r,
    project_name: r.pm_projects?.project_name || null,
    customer_name: r.pm_projects?.customer_name || null,
    linked_item_name: r.inv_products?.name || r.inv_materials?.name || null,
    pm_projects: undefined, inv_products: undefined, inv_materials: undefined,
  }));
  return json({ purchaseRequests: requests, total: count || 0, page, pageSize });
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
