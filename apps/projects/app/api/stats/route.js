'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();

  const { data: projects, error } = await sb.from('pm_projects').select('*');
  if (error) { console.error('[stats] projects failed:', error.message); return json({ error: 'Could not load stats.' }, 500); }

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
  });
}
