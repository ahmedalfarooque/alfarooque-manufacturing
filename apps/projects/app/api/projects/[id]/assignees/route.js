'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { sendEmail } = require('@/lib/email');

function assignmentEmailHtml({ userName, projectName, customerName, companyName, position, adminName, assignedDate, loginLink }) {
  return '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e293b;">' +
    '<h2 style="color:#0f877e;margin:0 0 16px;">You Have Been Assigned to a New Project</h2>' +
    '<p style="font-size:14px;line-height:1.6;">Hello ' + escapeHtml(userName) + ',</p>' +
    '<p style="font-size:14px;line-height:1.6;">You have been assigned to a project by Alfarooque Wood Works Factory.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">' +
      row('Project Name', projectName) +
      row('Customer', customerName) +
      row('Company', companyName) +
      row('Assigned Position', position) +
      row('Assigned By', adminName) +
      row('Assignment Date', assignedDate) +
    '</table>' +
    '<p style="font-size:14px;line-height:1.6;">You can log in to the Project Management System to view your assigned project, submit Daily Updates, and create Purchase Requests.</p>' +
    '<div style="text-align:center;margin:28px 0;">' +
      '<a href="' + loginLink + '" style="display:inline-block;background:#0f877e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">Login to Dashboard</a>' +
    '</div>' +
    '<p style="font-size:13px;color:#475569;">Thank you,<br/>Alfarooque Wood Works Factory<br/>Project Management Department</p>' +
  '</div>';
}
function row(label, value) {
  if (!value) return '';
  return '<tr><td style="padding:4px 0;color:#64748b;">' + escapeHtml(label) + '</td><td style="padding:4px 0;text-align:right;font-weight:600;">' + escapeHtml(String(value)) + '</td></tr>';
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb
    .from('pm_project_assignees')
    .select('project_id, assigned_at, platform_users(id, full_name, email, position, role)')
    .eq('project_id', params.id)
    .order('assigned_at', { ascending: true });
  if (error) { console.error('[assignees] list failed:', error.message); return json({ error: 'Could not load assigned users.' }, 500); }

  const assignees = (data || [])
    .filter(r => r.platform_users)
    .map(r => ({ ...r.platform_users, assigned_at: r.assigned_at }));
  return json({ assignees });
}

export async function POST(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const userId = String(body.user_id || '').trim();
  if (!userId) return json({ error: 'user_id is required.' }, 400);

  const sb = getDb();
  const { data: project } = await sb.from('pm_projects').select('id, project_name, customer_name, company_name').eq('id', params.id).maybeSingle();
  if (!project) return json({ error: 'Project not found.' }, 404);

  const { data: user } = await sb.from('platform_users').select('id, full_name, email, position').eq('id', userId).maybeSingle();
  if (!user) return json({ error: 'User not found.' }, 404);

  // Check membership BEFORE the upsert so we only email/notify on a genuinely new assignment, never a re-save of an existing one.
  const { data: existingRow } = await sb.from('pm_project_assignees').select('project_id').eq('project_id', params.id).eq('user_id', userId).maybeSingle();
  const isNewAssignment = !existingRow;

  const { error } = await sb.from('pm_project_assignees').upsert({
    project_id: params.id, user_id: userId, assigned_by: session.sub,
  }, { onConflict: 'project_id,user_id' });
  if (error) { console.error('[assignees] add failed:', error.message); return json({ error: 'Could not assign the user.' }, 500); }

  if (!isNewAssignment) return json({ ok: true, isNew: false }, 200);

  await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `User Assigned: ${user.full_name || user.email}` });

  const { data: admin } = await sb.from('platform_users').select('full_name, email').eq('id', session.sub).maybeSingle();
  const adminName = admin?.full_name || admin?.email || 'Admin';
  const assignedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const origin = new URL(req.url).origin;
  const loginLink = origin + '/login';
  const projectLink = origin + '/projects/' + params.id;

  await sb.from('notifications').insert({
    user_id: userId, type: 'project_assigned', project_id: params.id,
    title: 'Project Assigned',
    body: `You were assigned to Project "${project.project_name}"`,
    link: projectLink,
  }).catch(() => {}); // table only exists once apps-schema-v7.sql has been run

  sendEmail({
    to: user.email,
    subject: 'You Have Been Assigned to a New Project – Alfarooque Wood Works Factory',
    html: assignmentEmailHtml({
      userName: user.full_name || user.email,
      projectName: project.project_name,
      customerName: project.customer_name,
      companyName: project.company_name,
      position: user.position,
      adminName,
      assignedDate,
      loginLink,
    }),
    mockLabel: 'Project assignment notification',
  }).catch(err => console.error('[assignees] email failed:', err.message));

  return json({ ok: true, isNew: true }, 201);
}
