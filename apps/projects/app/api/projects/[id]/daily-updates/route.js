'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');
const { sendEmail } = require('@/lib/email');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb
    .from('pm_daily_updates')
    .select('*, platform_users(full_name, email)')
    .eq('project_id', params.id)
    .order('update_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { console.error('[daily-updates] list failed:', error.message); return json({ error: 'Could not load daily updates.' }, 500); }

  const updates = (data || []).map(u => ({
    ...u,
    author_name: u.platform_users?.full_name || u.platform_users?.email || null,
    platform_users: undefined,
  }));
  return json({ dailyUpdates: updates });
}

export async function POST(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  if (!(await isAssignedOrAdmin(session, params.id))) {
    return json({ error: 'Only assigned users or an admin can submit a daily update for this project.' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const todaysWork = String(body.todays_work || '').trim();
  if (!todaysWork) return json({ error: "Today's Work is required." }, 400);

  const sb = getDb();
  const { data: project } = await sb.from('pm_projects').select('id, project_name').eq('id', params.id).maybeSingle();
  if (!project) return json({ error: 'Project not found.' }, 404);

  const progressPct = body.progress_pct !== undefined && body.progress_pct !== '' ? Math.max(0, Math.min(100, parseInt(body.progress_pct, 10))) : null;

  const { data: row, error } = await sb.from('pm_daily_updates').insert({
    project_id: params.id,
    author_id: session.sub,
    update_date: body.update_date || new Date().toISOString().slice(0, 10),
    weather: body.weather || null,
    progress_pct: progressPct,
    todays_work: todaysWork,
    description: body.description || null,
    issues: body.issues || null,
    tomorrow_plan: body.tomorrow_plan || null,
    remarks: body.remarks || null,
    title: body.title || null,
    need_help: !!body.need_help,
    status: 'Pending',
  }).select().single();
  if (error) { console.error('[daily-updates] create failed:', error.message); return json({ error: 'Could not save the daily update.' }, 500); }

  await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `Daily Update Added: ${todaysWork.slice(0, 120)}` });

  const origin = new URL(req.url).origin;
  const link = `${origin}/projects/${params.id}?tab=daily-updates`;
  sendEmail({
    subject: `New Daily Update — ${project.project_name}`,
    html: `
      <h2>New Daily Update</h2>
      <p><strong>Project:</strong> ${project.project_name}</p>
      <p><strong>By:</strong> ${session.email}</p>
      <p><strong>Date:</strong> ${row.update_date}</p>
      ${progressPct !== null ? `<p><strong>Progress:</strong> ${progressPct}%</p>` : ''}
      <p><strong>Today's Work:</strong> ${todaysWork}</p>
      ${body.issues ? `<p><strong>Issues:</strong> ${body.issues}</p>` : ''}
      <p><a href="${link}">View in ProTrack</a></p>
    `,
    mockLabel: 'Daily Update notification',
  }).catch(err => console.error('[daily-updates] email failed:', err.message));

  return json({ dailyUpdate: row }, 201);
}
