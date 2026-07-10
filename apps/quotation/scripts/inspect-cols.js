'use strict';
const fs = require('fs');
const path = require('path');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0 && !(t.slice(0, i).trim() in process.env)) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
let pg;
try { pg = require('pg'); } catch (_) { pg = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'pg')); }
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const { rows } = await c.query(`
    select table_name, string_agg(column_name, ', ' order by ordinal_position) cols
    from information_schema.columns
    where table_name in ('qt_materials','qt_material_price_history','qt_quotations','qt_lang_backup')
    group by table_name order by table_name`);
  rows.forEach(r => console.log('▶ ' + r.table_name + ':\n  ' + r.cols + '\n'));
  await c.end();
})().catch(e => { console.error(e.message); process.exitCode = 1; });
