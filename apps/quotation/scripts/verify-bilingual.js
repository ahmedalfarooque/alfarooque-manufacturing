'use strict';
/* Verifies stored-bilingual coverage: every active row must have BOTH
   name_en and name_ar (or company_name pair). Prints per-table coverage
   and 3 sample product pairs. Exit 0 = fully bilingual.               */
const fs = require('fs');
const path = require('path');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0 && !(t.slice(0, i).trim() in process.env)) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CHECKS = [
  ['qt_catalogue_products', 'name_en', 'name_ar'],
  ['qt_materials', 'name_en', 'name_ar'],
  ['qt_customers', 'company_name_en', 'company_name_ar'],
  ['qt_suppliers', 'name_en', 'name_ar'],
  ['qt_machines', 'name_en', 'name_ar'],
  ['qt_labour_roles', 'name_en', 'name_ar'],
  ['qt_expense_templates', 'name_en', 'name_ar'],
];

(async () => {
  let failures = 0;
  for (const [table, en, ar] of CHECKS) {
    const { count: total } = await sb.from(table).select('*', { count: 'exact', head: true }).is('deleted_at', null);
    const { count: missing } = await sb.from(table).select('*', { count: 'exact', head: true })
      .is('deleted_at', null).or(`${en}.is.null,${ar}.is.null`);
    const ok = (missing || 0) === 0;
    if (!ok) failures++;
    console.log(`  ${ok ? '✓' : '✗'} ${table}: ${total} rows, ${missing || 0} missing a language`);
  }
  const { data: samples } = await sb.from('qt_catalogue_products').select('code, name_en, name_ar').limit(3);
  for (const s of samples || []) console.log(`  · ${s.code}  EN: ${String(s.name_en).slice(0, 45)}  |  AR: ${String(s.name_ar).slice(0, 45)}`);
  console.log(failures ? `✗ ${failures} tables incomplete` : '✓ All entities fully bilingual.');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error('✗ ' + e.message); process.exitCode = 1; });
