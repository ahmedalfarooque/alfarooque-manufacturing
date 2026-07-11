'use strict';

/* Settings administration (admin only).
   GET → { entities: [...], settings: {key: value} }
   PUT → { entities?: [{id, ...fields}], settings?: {key: value} }     */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { audit } = require('@/lib/crud');

const ENTITY_FIELDS = ['name_en', 'name_ar', 'cr_number', 'vat_number', 'address_en', 'address_ar',
  'phone', 'email', 'website', 'default_vat_rate', 'quote_prefix', 'next_seq', 'is_active'];
const SETTING_KEYS = ['profit_defaults', 'approval_thresholds', 'defaults', 'translation', 'numbering'];

export async function GET(req) {
  const { session, response } = requireSession(req, { adminOnly: true });
  if (!session) return response;
  const sb = getDb();
  const { data: entities } = await sb.from('qt_entities').select('*').order('code');
  const { data: settings } = await sb.from('qt_settings').select('key, value').is('entity_id', null);
  const map = {};
  (settings || []).forEach(s => { map[s.key] = s.value; });
  return json({ entities: entities || [], settings: map });
}

export async function PUT(req) {
  const { session, response } = requireSession(req, { adminOnly: true });
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));

  if (Array.isArray(body.entities)) {
    for (const e of body.entities) {
      if (!e.id) continue;
      const patch = {};
      for (const f of ENTITY_FIELDS) if (e[f] !== undefined) patch[f] = e[f] === '' ? null : e[f];
      if (patch.next_seq !== undefined && patch.next_seq !== null) patch.next_seq = parseInt(patch.next_seq, 10) || 1;
      if (patch.default_vat_rate !== undefined && patch.default_vat_rate !== null) patch.default_vat_rate = Number(patch.default_vat_rate) || 15;
      patch.updated_at = new Date().toISOString();
      const { error } = await sb.from('qt_entities').update(patch).eq('id', e.id);
      if (error) return json({ error: error.message }, 400);
      await audit(sb, 'qt_entities', e.id, 'update', null, patch, session.sub);
    }
  }

  if (body.settings && typeof body.settings === 'object') {
    for (const key of Object.keys(body.settings)) {
      if (!SETTING_KEYS.includes(key)) continue;
      const value = body.settings[key];
      const { data: existing } = await sb.from('qt_settings').select('id').eq('key', key).is('entity_id', null).maybeSingle();
      if (existing) {
        await sb.from('qt_settings').update({ value, updated_by: session.sub, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await sb.from('qt_settings').insert({ entity_id: null, key, value, updated_by: session.sub });
      }
      await audit(sb, 'qt_settings', existing ? existing.id : null, 'update', null, { key, value }, session.sub);
    }
  }
  return json({ ok: true });
}
