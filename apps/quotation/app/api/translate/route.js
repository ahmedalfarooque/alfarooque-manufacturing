'use strict';

/* Batch data-translation endpoint used by the client tr() layer and
   server-rendered documents. POST { texts: [...], to: 'ar'|'en' } →
   { map: { source: translated } }. Results are cached in
   qt_translations (shared across users, manual corrections win over
   dictionary output). Dictionary engine = lib/translate.js — swap in a
   real MT API here later without touching any consumer.              */

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { translate, hasArabic } = require('@/lib/translate');

const md5 = (s) => crypto.createHash('md5').update(String(s).toLowerCase().trim()).digest('hex');

export async function POST(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const body = await req.json().catch(() => ({}));
  const to = body.to === 'ar' ? 'ar' : 'en';
  const texts = [...new Set((Array.isArray(body.texts) ? body.texts : [])
    .map(t => String(t || '').trim()).filter(t => t && t.length <= 500))].slice(0, 500);
  if (!texts.length) return json({ map: {} });

  const map = {};
  const need = [];
  for (const t of texts) {
    /* Already in the target language → passthrough, no cache row. */
    if ((to === 'ar') === hasArabic(t)) { map[t] = t; continue; }
    need.push(t);
  }

  const sb = getDb();
  if (need.length) {
    const hashes = need.map(md5);
    const { data: cached } = await sb.from('qt_translations')
      .select('source_hash, translated').eq('target_lang', to).in('source_hash', hashes);
    const cacheMap = new Map((cached || []).map(c => [c.source_hash, c.translated]));
    const fresh = [];
    for (const t of need) {
      const hit = cacheMap.get(md5(t));
      if (hit) { map[t] = hit; continue; }
      const tr = translate(t, to);
      map[t] = tr;
      fresh.push({ source_hash: md5(t), target_lang: to, source_text: t, translated: tr, source: 'dictionary' });
    }
    if (fresh.length) {
      await sb.from('qt_translations').upsert(fresh, { onConflict: 'source_hash,target_lang', ignoreDuplicates: true }).then(() => {}, () => {});
    }
  }
  return json({ map });
}
