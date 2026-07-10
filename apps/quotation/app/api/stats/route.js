'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

/* Dashboard KPI counts. Tolerant of a not-yet-applied schema: any table
   error simply yields 0 so the Phase 0 shell still renders. */
async function count(sb, table, apply) {
  try {
    let q = sb.from(table).select('id', { count: 'exact', head: true }).is('deleted_at', null);
    if (apply) q = apply(q);
    const { count: c, error } = await q;
    if (error) return 0;
    return c || 0;
  } catch (_) { return 0; }
}

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const in3days = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [total, draft, pending, sent, accepted, expiring, customers, materials] = await Promise.all([
    count(sb, 'qt_quotations'),
    count(sb, 'qt_quotations', q => q.eq('status', 'draft')),
    count(sb, 'qt_quotations', q => q.eq('status', 'pending_approval')),
    count(sb, 'qt_quotations', q => q.eq('status', 'sent')),
    count(sb, 'qt_quotations', q => q.eq('status', 'accepted')),
    count(sb, 'qt_quotations', q => q.in('status', ['approved', 'sent']).gte('valid_until', today).lte('valid_until', in3days)),
    count(sb, 'qt_customers'),
    count(sb, 'qt_materials'),
  ]);

  let quotedMonth = 0;
  const monthly = [];
  let recent = [];
  try {
    const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);
    const { data } = await sb.from('qt_quotations')
      .select('grand_total, status, quote_date, created_at')
      .is('deleted_at', null)
      .gte('quote_date', yearAgo)
      .not('status', 'in', '(cancelled,superseded)');
    const byMonth = new Map();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      byMonth.set(d.toISOString().slice(0, 7), { month: d.toISOString().slice(0, 7), quoted: 0, accepted: 0 });
    }
    for (const r of data || []) {
      const k = String(r.quote_date || r.created_at).slice(0, 7);
      const o = byMonth.get(k);
      if (!o) continue;
      o.quoted += Number(r.grand_total || 0);
      if (r.status === 'accepted') o.accepted += Number(r.grand_total || 0);
      if (String(r.created_at) >= monthStart) quotedMonth += Number(r.grand_total || 0);
    }
    monthly.push(...byMonth.values());

    const { data: rec } = await sb.from('qt_quotations')
      .select('id, quote_number, status, grand_total, blended_margin_pct, customer:qt_customers(company_name)')
      .is('deleted_at', null).order('created_at', { ascending: false }).limit(8);
    recent = rec || [];
  } catch (_) {}

  return json({ total, draft, pending, sent, accepted, expiring, customers, materials, quotedMonth, monthly, recent });
}
