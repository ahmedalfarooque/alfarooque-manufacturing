'use strict';

/* Global list across all projects — backs the admin's dedicated
   "Purchase Requests" page. Filtering/sorting/pagination happen
   client-side (same convention as the existing Projects/Customers
   list pages), this just returns everything the admin is allowed to
   see (all of it) with the joined project/requester names attached. */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const sb = getDb();
  const unassignedOnly = new URL(req.url).searchParams.get('unassigned') === '1';
  let query = sb
    .from('pm_purchase_requests')
    .select('*, pm_projects(id, project_name, customer_name), platform_users(full_name, email), inv_products(name), inv_materials(name)')
    .order('created_at', { ascending: false });
  if (unassignedOnly) query = query.is('project_id', null);
  const { data, error } = await query;
  if (error) { console.error('[purchase-requests] global list failed:', error.message); return json({ error: 'Could not load purchase requests.' }, 500); }

  const requests = (data || []).map(r => ({
    ...r,
    project_name: r.pm_projects?.project_name || null,
    customer_name: r.pm_projects?.customer_name || null,
    requested_by_name: r.platform_users?.full_name || r.platform_users?.email || null,
    linked_item_name: r.inv_products?.name || r.inv_materials?.name || null,
    pm_projects: undefined,
    platform_users: undefined, inv_products: undefined, inv_materials: undefined,
  }));
  return json({ purchaseRequests: requests });
}
