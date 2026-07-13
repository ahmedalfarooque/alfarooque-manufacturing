'use strict';

/* Recost (FR-PRD-4): compares each snapshot line that still references a
   master record (source_id) against the master's current rate/price.
   POST {apply:false} → diff preview; POST {apply:true} → update lines.  */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');

function labourRate(role, unit) {
  if (unit === 'hour') return Number(role.hourly_rate);
  if (unit === 'month') return Number(role.monthly_rate);
  return Number(role.daily_rate);
}

export async function POST(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  const apply = !!body.apply;

  const { data: lines } = await sb.from('qt_product_cost_lines')
    .select('*').eq('product_id', params.id).not('source_id', 'is', null);
  if (!lines || !lines.length) return json({ changes: [] });

  const ids = (section) => lines.filter(l => l.section === section || (section === 'material' && l.section === 'hardware')).map(l => l.source_id);
  const [mats, labs, machs, exps] = await Promise.all([
    sb.from('qt_materials').select('id, latest_price, default_waste_pct, unit').in('id', ids('material')),
    sb.from('qt_labour_roles').select('id, hourly_rate, daily_rate, monthly_rate').in('id', lines.filter(l => l.section === 'labour').map(l => l.source_id)),
    sb.from('qt_machines').select('id, hourly_cost, setup_cost').in('id', lines.filter(l => l.section === 'machine').map(l => l.source_id)),
    sb.from('qt_expense_templates').select('id, default_amount, unit').in('id', lines.filter(l => l.section === 'expense').map(l => l.source_id)),
  ]);
  const matMap = new Map((mats.data || []).map(m => [m.id, m]));
  const labMap = new Map((labs.data || []).map(m => [m.id, m]));
  const machMap = new Map((machs.data || []).map(m => [m.id, m]));
  const expMap = new Map((exps.data || []).map(m => [m.id, m]));

  const changes = [];
  for (const l of lines) {
    /* rate_locked lines keep their entered rate; unit-converted material
       lines (line unit ≠ master unit) are not comparable to the master
       price and must never be auto-refreshed. */
    if (l.extra && l.extra.rate_locked) continue;
    let next = null;
    if (l.section === 'material' || l.section === 'hardware') {
      const m = matMap.get(l.source_id);
      if (m && m.unit === l.unit && Number(m.latest_price) !== Number(l.unit_cost)) next = Number(m.latest_price);
    } else if (l.section === 'labour') {
      const r = labMap.get(l.source_id);
      if (r) {
        const rate = labourRate(r, l.unit);
        if (rate !== Number(l.unit_cost)) next = rate;
      }
    } else if (l.section === 'machine') {
      const m = machMap.get(l.source_id);
      if (m && Number(m.hourly_cost) !== Number(l.unit_cost)) next = Number(m.hourly_cost);
    } else if (l.section === 'expense') {
      const e = expMap.get(l.source_id);
      if (e && e.unit !== 'pct_production' && Number(e.default_amount) !== Number(l.unit_cost)) next = Number(e.default_amount);
    }
    if (next !== null) {
      changes.push({ id: l.id, section: l.section, name: l.name, old: Number(l.unit_cost), new: next });
    }
  }

  if (apply && changes.length) {
    for (const c of changes) {
      await sb.from('qt_product_cost_lines').update({ unit_cost: c.new }).eq('id', c.id);
    }
    await audit(sb, 'qt_product_cost_lines', params.id, 'update', null, { recost: changes.length }, session.sub);
  }
  return json({ changes, applied: apply });
}
