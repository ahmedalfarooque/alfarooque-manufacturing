'use strict';

/* Lightweight dashboard feed for External Assigned Users — scoped
   entirely to their own assigned projects and their own submissions.
   No totals, financials, or other-user data ever leave this route. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();

  const { data: assigneeRows } = await sb.from('pm_project_assignees').select('project_id').eq('user_id', session.sub);
  const projectIds = (assigneeRows || []).map(r => r.project_id);

  if (!projectIds.length) {
    return json({
      totalProjects: 0, running: 0, completed: 0,
      projects: [],
      purchaseRequests: { pending: 0, recent: [] },
      dailyUpdates: { today: 0, thisWeek: 0, recent: [] },
      notifications: { unread: 0 },
    });
  }

  const { data: projects } = await sb.from('pm_projects').select('id, project_name, customer_name, status, progress, start_date, end_date').in('id', projectIds);
  const projectList = projects || [];
  const running = projectList.filter(p => p.status === 'Running').length;
  const completed = projectList.filter(p => p.status === 'Completed').length;

  const { data: prs } = await sb
    .from('pm_purchase_requests')
    .select('id, project_id, material_description, status, priority, created_at, pm_projects(project_name)')
    .eq('requested_by', session.sub)
    .order('created_at', { ascending: false });
  const prList = prs || [];
  const prPending = prList.filter(r => !['Rejected', 'Cancelled', 'Payment Completed', 'Delivered'].includes(r.status)).length;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: dus } = await sb
    .from('pm_daily_updates')
    .select('id, project_id, update_date, status, created_at, pm_projects(project_name)')
    .eq('author_id', session.sub)
    .order('created_at', { ascending: false });
  const duList = dus || [];
  const duToday = duList.filter(u => u.update_date === todayStr).length;
  const duThisWeek = duList.filter(u => new Date(u.update_date) >= weekAgo).length;

  const { count: unreadCount } = await sb
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.sub)
    .eq('is_read', false);

  return json({
    totalProjects: projectList.length, running, completed,
    projects: projectList,
    purchaseRequests: {
      pending: prPending,
      recent: prList.slice(0, 5).map(r => ({ id: r.id, project_id: r.project_id, project_name: r.pm_projects?.project_name || null, material_description: r.material_description, status: r.status, priority: r.priority, created_at: r.created_at })),
    },
    dailyUpdates: {
      today: duToday, thisWeek: duThisWeek,
      recent: duList.slice(0, 5).map(u => ({ id: u.id, project_id: u.project_id, project_name: u.pm_projects?.project_name || null, update_date: u.update_date, status: u.status, created_at: u.created_at })),
    },
    notifications: { unread: unreadCount || 0 },
  });
}
