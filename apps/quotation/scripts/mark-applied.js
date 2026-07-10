'use strict';
/* One-time: records migrations already applied via the Dashboard SQL
   editor into the _qt_migrations ledger so migrate.js won't re-run them. */
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
  await c.query('create table if not exists _qt_migrations (name text primary key, applied_at timestamptz not null default now())');
  for (const n of ['quotation-schema.sql', 'quotation-schema-v2.sql', 'quotation-schema-v5-fix.sql'])
    await c.query('insert into _qt_migrations(name) values ($1) on conflict do nothing', [n]);
  const { rows } = await c.query('select name from _qt_migrations order by name');
  console.log('ledger:', rows.map(r => r.name).join(' | '));
  await c.end();
})().catch(e => { console.error('ERR: ' + e.message); process.exitCode = 1; });
