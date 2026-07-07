'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');

const VALID_STATUSES = ['Pending', 'Approved', 'Rejected', 'Ordered', 'Delivered', 'Completed'];

export async function GET(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: row, error } = await sb
    .from('pm_purchase_requests')
    .select('*, pm_projects(id, project_name, customer_name), platform_users(full_name, email)')
    .eq('id', params.id)
    .maybeSingle();
  if (error) { console.error('[purchase-requests] get failed:', error.message); return json({ error: 'Could not load the purchase request.' }, 500); }
  if (!row) return json({ error: 'Purchase request not found.' }, 404);

  if (!(await isAssignedOrAdmin(session, row.project_id))) {
    return json({ error: 'You do not have access to this purchase request.' }, 403);
  }

  const { data: attachments } = await sb
    .from('pm_purchase_request_attachments')
    .select('*')
    .eq('purchase_request_id', params.id)
    .order('created_at', { ascending: false });

  return json({
    purchaseRequest: {
      ...row,
      project_name: row.pm_projects?.project_name || null,
      customer_name: row.pm_projects?.customer_name || null,
      requested_by_name: row.platform_users?.full_name || row.platform_users?.email || null,
      pm_projects: undefined,
      platform_users: undefined,
    },
    attachments: (attachments || []).map(a => ({ ...a, url: `/api/purchase-requests/${params.id}/attachments/${a.id}` })),
  });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) return json({ error: 'Invalid status.' }, 400);
    patch.status = body.status;
  }
  ['supplier', 'material_description', 'material_list', 'quantity', 'unit', 'estimated_price',
   'required_date', 'priority', 'remarks', 'request_date'].forEach(f => {
    if (body[f] !== undefined) patch[f] = body[f];
  });
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('pm_purchase_requests').select('project_id, material_description').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Purchase request not found.' }, 404);

  const { data: row, error } = await sb.from('pm_purchase_requests').update(patch).eq('id', params.id).select().single();
  if (error) { console.error('[purchase-requests] update failed:', error.message); return json({ error: 'Could not update the purchase request.' }, 500); }

  if (patch.status) {
    await sb.from('pm_project_logs').insert({
      project_id: existing.project_id,
      activity: `Purchase Request ${patch.status}: ${existing.material_description}`,
    });
  }

  return json({ purchaseRequest: row });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: existing } = await sb.from('pm_purchase_requests').select('project_id, material_description').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Purchase request not found.' }, 404);

  const { data: attachments } = await sb.from('pm_purchase_request_attachments').select('storage_path').eq('purchase_request_id', params.id);
  if (attachments && attachments.length) {
    await sb.storage.from('project-documents').remove(attachments.map(a => a.storage_path)).catch(() => {});
  }

  const { error } = await sb.from('pm_purchase_requests').delete().eq('id', params.id);
  if (error) { console.error('[purchase-requests] delete failed:', error.message); return json({ error: 'Could not delete the purchase request.' }, 500); }

  await sb.from('pm_project_logs').insert({ project_id: existing.project_id, activity: `Purchase Request Deleted: ${existing.material_description}` });
  return json({ ok: true });
}
