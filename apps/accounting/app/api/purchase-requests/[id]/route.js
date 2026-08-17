'use strict';

/* Reuses pm_purchase_requests (Projects app's own table) and
   erp_financial_connections (the existing generic Project/SmartERP
   document-connection table) — no new relationship tables. Connecting/
   disconnecting a project is a plain project_id update on the purchase
   request itself, exactly like Projects app's own POST already does when
   it sets project_id = params.id at creation time. */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');

/* The DB CHECK constraint on pm_purchase_requests.status only allows these
   6 values (see apps-schema) — validating against the same set here avoids
   ever hitting a constraint-violation 500 from this route. */
/* Superset of the original 6 statuses — kept identical to Projects' own
   VALID_STATUSES (apps/projects/app/api/purchase-requests/[id]/route.js)
   now that the real DB CHECK constraint was widened to match (both apps
   must agree on the same allowed set for the same canonical column). */
const VALID_STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'On Hold', 'Purchased', 'Delivered',
  'Cancelled', 'Payment Pending', 'Payment Approved', 'Payment Completed', 'Ordered', 'Completed'];

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { data: row, error } = await sb
    .from('pm_purchase_requests')
    .select('*, pm_projects(id, project_name, customer_name), inv_products(name), inv_materials(name)')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return json({ error: 'Could not load the purchase request.' }, 500);
  if (!row) return json({ error: 'Purchase request not found.' }, 404);

  const { data: links } = await sb
    .from('erp_financial_connections')
    .select('id, source_record_id, workflow_status, created_at, erp_financial_source_records(id, record_type, external_id, raw_payload)')
    .eq('purchase_request_id', params.id);

  return json({
    purchaseRequest: {
      ...row,
      project_name: row.pm_projects?.project_name || null,
      customer_name: row.pm_projects?.customer_name || null,
      linked_item_name: row.inv_products?.name || row.inv_materials?.name || null,
      pm_projects: undefined, inv_products: undefined, inv_materials: undefined,
    },
    connectedInvoices: (links || []).map(l => ({
      connection_id: l.id,
      source_record_id: l.source_record_id,
      record_type: l.erp_financial_source_records?.record_type,
      external_id: l.erp_financial_source_records?.external_id,
      payload: l.erp_financial_source_records?.raw_payload,
      connected_at: l.created_at,
    })),
  });
}

export async function PATCH(req, { params }) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  const { data: existing } = await getDb().from('pm_purchase_requests').select('id, project_id').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Purchase request not found.' }, 404);
  const sb = getDb();

  const patch = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) return json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, 400);
    patch.status = body.status;
  }
  ['supplier', 'material_description', 'material_list', 'quantity', 'unit', 'required_date', 'priority', 'remarks', 'request_date',
   'inv_material_id', 'inv_product_id'].forEach(f => {
    if (body[f] !== undefined) patch[f] = body[f];
  });
  if (body.estimated_price !== undefined) patch.estimated_price = body.estimated_price === '' ? null : body.estimated_price;

  /* project_id: undefined = leave alone, null = disconnect, a real id = connect (after existence check). */
  if (Object.prototype.hasOwnProperty.call(body, 'project_id')) {
    if (body.project_id) {
      const { data: project } = await sb.from('pm_projects').select('id').eq('id', body.project_id).maybeSingle();
      if (!project) return json({ error: 'Project not found.' }, 404);
    }
    patch.project_id = body.project_id || null;
  }

  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);
  const { data: row, error } = await sb.from('pm_purchase_requests').update(patch).eq('id', params.id).select().single();
  if (error) { console.error('[accounting purchase-requests] update failed:', error.message); return json({ error: 'Could not update the purchase request.' }, 500); }
  return json({ purchaseRequest: row });
}

export async function DELETE(req, { params }) {
  const { response } = await requireDelete(req);
  if (response) return response;
  const sb = getDb();
  const { data: existing } = await sb.from('pm_purchase_requests').select('id').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Purchase request not found.' }, 404);

  /* erp_financial_connections has a CHECK requiring at least one of
     project_id/purchase_request_id/purchase_order_id/goods_receipt_id to
     stay non-null — its ON DELETE SET NULL FK action fails outright
     (constraint violation) if nulling purchase_request_id would leave a
     row with all four null. Clean those rows up explicitly first: drop
     ones this was the only reference on, just clear the field on ones
     that still carry a project/PO/goods-receipt reference. */
  const { data: links } = await sb.from('erp_financial_connections').select('id, project_id, purchase_order_id, goods_receipt_id').eq('purchase_request_id', params.id);
  const orphaned = (links || []).filter(l => !l.project_id && !l.purchase_order_id && !l.goods_receipt_id).map(l => l.id);
  const stillReferenced = (links || []).filter(l => l.project_id || l.purchase_order_id || l.goods_receipt_id).map(l => l.id);
  if (orphaned.length) await sb.from('erp_financial_connections').delete().in('id', orphaned);
  if (stillReferenced.length) await sb.from('erp_financial_connections').update({ purchase_request_id: null }).in('id', stillReferenced);

  const { error } = await sb.from('pm_purchase_requests').delete().eq('id', params.id);
  if (error) { console.error('[accounting purchase-requests] delete failed:', error.message); return json({ error: 'Could not delete the purchase request.' }, 500); }
  return json({ ok: true, hadLinkedInvoices: (links || []).length });
}
