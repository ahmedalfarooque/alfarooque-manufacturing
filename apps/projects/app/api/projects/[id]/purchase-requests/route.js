'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');
const { sendEmail } = require('@/lib/email');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb
    .from('pm_purchase_requests')
    .select('*, platform_users(full_name, email)')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('[purchase-requests] list failed:', error.message); return json({ error: 'Could not load purchase requests.' }, 500); }

  const requests = (data || []).map(r => ({
    ...r,
    requested_by_name: r.platform_users?.full_name || r.platform_users?.email || null,
    platform_users: undefined,
  }));
  return json({ purchaseRequests: requests });
}

export async function POST(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  if (!(await isAssignedOrAdmin(session, params.id))) {
    return json({ error: 'Only assigned users or an admin can submit a purchase request for this project.' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const materialDescription = String(body.material_description || '').trim();
  if (!materialDescription) return json({ error: 'Material description is required.' }, 400);
  const priority = ['Normal', 'Urgent', 'Critical'].includes(body.priority) ? body.priority : 'Normal';

  const sb = getDb();
  const { data: project } = await sb.from('pm_projects').select('id, project_name, customer_name').eq('id', params.id).maybeSingle();
  if (!project) return json({ error: 'Project not found.' }, 404);

  const { data: row, error } = await sb.from('pm_purchase_requests').insert({
    project_id: params.id,
    requested_by: session.sub,
    request_date: body.request_date || new Date().toISOString().slice(0, 10),
    supplier: body.supplier || null,
    material_description: materialDescription,
    material_list: body.material_list || null,
    quantity: body.quantity || null,
    unit: body.unit || null,
    estimated_price: body.estimated_price || null,
    required_date: body.required_date || null,
    expected_date: body.expected_date || null,
    priority,
    remarks: body.remarks || null,
  }).select().single();
  if (error) { console.error('[purchase-requests] create failed:', error.message); return json({ error: 'Could not create the purchase request.' }, 500); }

  await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `Purchase Request Created: ${materialDescription}` });

  const origin = new URL(req.url).origin;
  const link = `${origin}/projects/${params.id}?tab=purchase-requests`;

  const { data: admins } = await sb.from('platform_users').select('id').eq('role', 'admin');
  if (admins?.length) {
    await sb.from('notifications').insert(admins.map(a => ({
      user_id: a.id, type: 'purchase_request', title: 'New Purchase Request',
      body: `${materialDescription} — ${project.project_name}`, link,
    }))).catch(() => {});
  }
  sendEmail({
    subject: `New Purchase Request — ${project.project_name}`,
    html: `
      <h2>New Purchase Request</h2>
      <p><strong>Project:</strong> ${project.project_name} (${project.customer_name || ''})</p>
      <p><strong>Requested By:</strong> ${session.email}</p>
      <p><strong>Date:</strong> ${row.request_date}</p>
      <p><strong>Priority:</strong> ${priority}</p>
      <p><strong>Materials:</strong> ${materialDescription}</p>
      <p><a href="${link}">View in ProTrack</a></p>
    `,
    mockLabel: 'Purchase Request notification',
  }).catch(err => console.error('[purchase-requests] email failed:', err.message));

  return json({ purchaseRequest: row }, 201);
}
