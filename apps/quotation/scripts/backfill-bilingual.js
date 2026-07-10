'use strict';

/* One-time bilingual backfill (idempotent — only touches rows where a
   language column is still NULL, so re-runs are cheap no-ops).

   For every bilingual entity:
     1. If qt_lang_backup holds the ORIGINAL en/ar values (backed up by
        the v5 single-language migration), restore those — best quality.
     2. Otherwise detect the script of the canonical value and fill the
        matching column, then dictionary-translate the other (offline,
        deterministic — lib/translate.js). Values save permanently:
        translation happens exactly once, never at render time.

   --if-ready: exit 0 quietly when the schema isn't migrated yet.      */

const fs = require('fs');
const path = require('path');

(function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0 && !(t.slice(0, i).trim() in process.env)) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch (_) {}
})();

if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const { translate, hasArabic } = require('../lib/translate');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const soft = process.argv.includes('--if-ready');

/* table → list of [canonical, en, ar] triples to fill */
const PLAN = [
  ['qt_catalogue_products', [['name', 'name_en', 'name_ar'],
                             ['description', 'description_en', 'description_ar'],
                             ['sub_category', 'sub_category_en', 'sub_category_ar']]],
  ['qt_quotation_products', [['name', 'name_en', 'name_ar'],
                             ['description', 'description_en', 'description_ar']]],
  ['qt_materials',          [['name', 'name_en', 'name_ar']]],
  ['qt_suppliers',          [['name', 'name_en', 'name_ar']]],
  ['qt_customers',          [['company_name', 'company_name_en', 'company_name_ar'],
                             ['contact_person', 'contact_person_en', 'contact_person_ar']]],
  ['qt_machines',           [['name', 'name_en', 'name_ar']]],
  ['qt_labour_roles',       [['name', 'name_en', 'name_ar']]],
  ['qt_expense_templates',  [['name', 'name_en', 'name_ar']]],
];

async function loadBackup() {
  /* qt_lang_backup: table_name, record_id, field, value_en, value_ar */
  const map = new Map();   // `${table}|${id}|${field}` → { en, ar }
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from('qt_lang_backup')
      .select('table_name, record_id, field, value_en, value_ar').range(from, from + 999);
    if (error || !data || !data.length) break;
    for (const r of data) map.set(`${r.table_name}|${r.record_id}|${r.field}`, { en: r.value_en, ar: r.value_ar });
    if (data.length < 1000) break;
    from += 1000;
  }
  return map;
}

function fillPair(canonical, en, ar, backup) {
  /* returns { en, ar } — never empty when canonical has a value */
  if (backup && (backup.en || backup.ar)) {
    return {
      en: backup.en || (backup.ar ? translate(backup.ar, 'en') : translate(canonical, 'en')),
      ar: backup.ar || (backup.en ? translate(backup.en, 'ar') : translate(canonical, 'ar')),
    };
  }
  const src = String(canonical || '').trim();
  if (!src) return { en: null, ar: null };
  return hasArabic(src)
    ? { en: translate(src, 'en'), ar: src }
    : { en: src, ar: translate(src, 'ar') };
}

async function backfillTable(table, triples, backup) {
  const cols = ['id', ...new Set(triples.flat())].join(', ');
  let updated = 0, from = 0;
  for (;;) {
    /* only rows still missing the primary pair */
    const [c0, e0, a0] = triples[0];
    const { data, error } = await sb.from(table).select(cols)
      .or(`${e0}.is.null,${a0}.is.null`)
      .range(from, from + 499);
    if (error) { console.error(`  ✗ ${table}: ${error.message}`); return updated; }
    if (!data || !data.length) break;

    for (const row of data) {
      const patch = {};
      for (const [canonical, enCol, arCol] of triples) {
        if (row[enCol] && row[arCol]) continue;                    // already bilingual
        if (!row[canonical] && !row[enCol] && !row[arCol]) continue; // nothing to fill
        const bk = backup.get(`${table}|${row.id}|${canonical}`);
        const pair = fillPair(row[canonical] || row[enCol] || row[arCol], row[enCol], row[arCol], bk);
        if (pair.en && !row[enCol]) patch[enCol] = pair.en;
        if (pair.ar && !row[arCol]) patch[arCol] = pair.ar;
        /* keep canonical = English (fallback Arabic) for legacy code paths */
        const canonicalValue = patch[enCol] || row[enCol] || patch[arCol] || row[arCol];
        if (canonicalValue && canonicalValue !== row[canonical]) patch[canonical] = canonicalValue;
      }
      if (Object.keys(patch).length) {
        const { error: uErr } = await sb.from(table).update(patch).eq('id', row.id);
        if (uErr) { console.error(`  ✗ ${table} ${row.id}: ${uErr.message}`); continue; }
        updated++;
      }
    }
    if (data.length < 500) break;
    /* rows we just updated fall OUT of the filter — restart the window */
    from = 0;
    if (updated > 20000) break;   // safety valve
  }
  console.log(`  ✓ ${table}: ${updated} rows backfilled`);
  return updated;
}

async function main() {
  const { error: probe } = await sb.from('qt_materials').select('name_en').limit(1);
  if (probe) {
    const msg = '[backfill] bilingual columns missing — run npm run migrate first.';
    if (soft) { console.warn(msg); process.exitCode = 0; return; }
    console.error(msg); process.exitCode = 1; return;
  }
  console.log('[backfill] loading qt_lang_backup originals…');
  const backup = await loadBackup();
  console.log(`[backfill] ${backup.size} backed-up original values available`);
  let total = 0;
  for (const [table, triples] of PLAN) total += await backfillTable(table, triples, backup);
  console.log(`[backfill] DONE — ${total} rows updated (permanent; re-runs are no-ops).`);
  process.exitCode = 0;
}

main().catch(e => { console.error('[backfill] ' + e.message); process.exitCode = 1; });
