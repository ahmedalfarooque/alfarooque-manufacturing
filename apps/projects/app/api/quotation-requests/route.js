'use strict';

/* Inbox of quotation-app "Send to Projects" requests — mirrors the
   purchase-requests global-list pattern. Filtering/sorting/pagination
   happen client-side, same convention as every other list page. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb
    .from('project_requests')
    .select('*, qt_quotations!quotation_id(quote_number, status, grand_total, quote_date), customers(company_name, company_name_en, company_name_ar), platform_users(full_name, email)')
    .order('created_at', { ascending: false });
  if (error) { console.error('[quotation-requests] list failed:', error.message); return json({ error: 'Could not load quotation requests.' }, 500); }

  const requests = (data || []).map(r => ({
    ...r,
    quotation_status: r.qt_quotations?.status || null,
    quote_date: r.qt_quotations?.quote_date || null,
    customer_name: r.customers?.company_name_en || r.customers?.company_name_ar || r.customers?.company_name || null,
    requested_by_name: r.platform_users?.full_name || r.platform_users?.email || null,
    qt_quotations: undefined, customers: undefined, platform_users: undefined,
  }));
  return json({ quotationRequests: requests });
}
