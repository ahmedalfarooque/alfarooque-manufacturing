'use strict';

/* Global list across all projects — backs the admin's dedicated
   "Purchase Requests" page. Filtering/sorting/pagination happen
   client-side (same convention as the existing Projects/Customers
   list pages), this just returns everything the admin is allowed to
   see (all of it) with the joined project/requester names attached. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb
    .from('pm_purchase_requests')
    .select('*, pm_projects(id, project_name, customer_name), platform_users(full_name, email)')
    .order('created_at', { ascending: false });
  if (error) { console.error('[purchase-requests] global list failed:', error.message); return json({ error: 'Could not load purchase requests.' }, 500); }

  const requests = (data || []).map(r => ({
    ...r,
    project_name: r.pm_projects?.project_name || null,
    customer_name: r.pm_projects?.customer_name || null,
    requested_by_name: r.platform_users?.full_name || r.platform_users?.email || null,
    pm_projects: undefined,
    platform_users: undefined,
  }));
  return json({ purchaseRequests: requests });
}
