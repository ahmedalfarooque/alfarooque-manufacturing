'use strict';

/* Bulk price update (FR-MAT-8): POST
   { mode: 'pct'|'fixed', value, kind?, category_id?, preview? }
   preview → { matched, sample:[{name, old, new}] } without writing.
   apply  → updates latest_price + appends price history (source 'bulk'). */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { r2 } = require('@/lib/costing');

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === 'fixed' ? 'fixed' : 'pct';
  const value = Number(body.value);
  if (!Number.isFinite(value) || value === 0) return json({ error: 'A non-zero value is required.' }, 400);

  let q = sb.from('qt_materials').select('id, name, latest_price').is('deleted_at', null).eq('status', 'active');
  if (body.kind) q = q.eq('kind', body.kind);
  if (body.category_id) q = q.eq('category_id', body.category_id);
  const { data: rows, error } = await q.limit(10000);
  if (error) return json({ error: error.message }, 500);

  const changes = (rows || []).map(m => ({
    id: m.id, name: m.name,
    old: Number(m.latest_price),
    new: Math.max(0, r2(mode === 'pct' ? Number(m.latest_price) * (1 + value / 100) : Number(m.latest_price) + value)),
  })).filter(c => c.new !== c.old);

  if (body.preview) {
    return json({ matched: changes.length, sample: changes.slice(0, 10) });
  }

  let applied = 0;
  for (const c of changes) {
    const { error: uErr } = await sb.from('qt_materials')
      .update({ latest_price: c.new, updated_by: session.sub, updated_at: new Date().toISOString() })
      .eq('id', c.id);
    if (uErr) continue;
    applied++;
  }
  if (changes.length) {
    for (let i = 0; i < changes.length; i += 500) {
      await sb.from('qt_material_price_history').insert(changes.slice(i, i + 500).map(c => ({
        material_id: c.id, price: c.new, previous_price: c.old, source: 'bulk',
        source_ref: mode === 'pct' ? value + '%' : String(value), created_by: session.sub,
      })));
    }
  }
  await audit(sb, 'qt_materials', null, 'update', null, { bulk_price: { mode, value, applied } }, session.sub);
  return json({ applied });
}
