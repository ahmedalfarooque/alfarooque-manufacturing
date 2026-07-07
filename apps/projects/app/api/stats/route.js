'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  if (session.role === 'external') return json({ error: 'Not permitted. Use /api/my-stats.' }, 403);
  const sb = getDb();

  const assignedUser = new URL(req.url).searchParams.get('assignedUser') || '';
  let scopedProjectIds = null;
  if (assignedUser) {
    const { data: rows } = await sb.from('pm_project_assignees').select('project_id').eq('user_id', assignedUser);
    scopedProjectIds = new Set((rows || []).map(r => r.project_id));
  }

  let projectsQuery = sb.from('pm_projects').select('*');
  const { data: allProjects, error } = await projectsQuery;
  if (error) { console.error('[stats] projects failed:', error.message); return json({ error: 'Could not load stats.' }, 500); }
  const projects = scopedProjectIds ? allProjects.filter(p => scopedProjectIds.has(p.id)) : allProjects;

  const total = projects.length;
  const byStatus = { Running: 0, Completed: 0, Upcoming: 0, 'On Hold': 0 };
  let totalValue = 0;
  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    totalValue += Number(p.value || 0);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const startedByMonth = Array(12).fill(0);
  const valueByMonth = Array(12).fill(0);
  for (const p of projects) {
    if (!p.start_date) continue;
    const d = new Date(p.start_date);
    if (d.getFullYear() === currentYear) {
      startedByMonth[d.getMonth()]++;
      valueByMonth[d.getMonth()] += Number(p.value || 0);
    }
  }

  const completedCount = byStatus.Completed || 0;
  const completionPct = total ? Math.round((completedCount / total) * 1000) / 10 : 0;

  const running = [...projects].filter(p => p.status === 'Running').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const completed = [...projects].filter(p => p.status === 'Completed').sort((a, b) => new Date(b.end_date || 0) - new Date(a.end_date || 0)).slice(0, 5);
  const upcoming = [...projects].filter(p => p.status === 'Upcoming').sort((a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0)).slice(0, 5);

  /* ── Purchase Requests widget ── */
  const { data: prs } = await sb.from('pm_purchase_requests').select('*, pm_projects(project_name)').order('created_at', { ascending: false });
  const prList = scopedProjectIds ? (prs || []).filter(r => scopedProjectIds.has(r.project_id)) : (prs || []);
  const prPending = prList.filter(r => r.status === 'Pending').length;
  const prApproved = prList.filter(r => r.status === 'Approved').length;
  const prUrgent = prList.filter(r => r.status === 'Pending' && (r.priority === 'Urgent' || r.priority === 'Critical')).length;
  const prRecent = prList.slice(0, 5).map(r => ({
    id: r.id, project_id: r.project_id, project_name: r.pm_projects?.project_name || null,
    material_description: r.material_description, status: r.status, priority: r.priority, created_at: r.created_at,
  }));

  /* ── Daily Updates widget ── */
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: dus } = await sb.from('pm_daily_updates').select('project_id, update_date');
  const duList = scopedProjectIds ? (dus || []).filter(u => scopedProjectIds.has(u.project_id)) : (dus || []);
  const duToday = duList.filter(u => u.update_date === todayStr).length;
  const duYesterday = duList.filter(u => u.update_date === yesterdayStr).length;
  const duThisWeek = duList.filter(u => new Date(u.update_date) >= weekAgo).length;

  const { data: assignedProjectIds } = await sb.from('pm_project_assignees').select('project_id');
  let projectsWithAssignees = new Set((assignedProjectIds || []).map(r => r.project_id));
  if (scopedProjectIds) projectsWithAssignees = new Set([...projectsWithAssignees].filter(id => scopedProjectIds.has(id)));
  const projectsWithUpdateToday = new Set(duList.filter(u => u.update_date === todayStr).map(u => u.project_id));
  const missingProjects = [...projectsWithAssignees].filter(id => !projectsWithUpdateToday.has(id)).length;

  return json({
    totalProjects: total,
    running: byStatus.Running, completedCount, upcomingCount: byStatus.Upcoming, onHoldCount: byStatus['On Hold'],
    totalValue, completionPct,
    statusBreakdown: byStatus,
    projectsStartedMonthly: MONTHS.map((m, i) => ({ month: m, count: startedByMonth[i] })),
    projectValueMonthly: MONTHS.map((m, i) => ({ month: m, value: valueByMonth[i] })),
    runningProjects: running,
    recentlyCompleted: completed,
    upcomingProjects: upcoming,
    purchaseRequests: { pending: prPending, approved: prApproved, urgent: prUrgent, recent: prRecent },
    dailyUpdates: { today: duToday, yesterday: duYesterday, thisWeek: duThisWeek, missing: missingProjects },
  });
}
