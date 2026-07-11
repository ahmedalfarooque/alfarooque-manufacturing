'use strict';

/* Automatic database migration runner.
   Applies every supabase/quotation-schema*.sql in order, exactly once,
   tracked in a _qt_migrations ledger — safe on a fresh database AND on
   an existing one (all files are idempotent anyway). Finishes with
   NOTIFY pgrst so PostgREST reloads its schema cache (no more
   "column not found in schema cache").

   Connection: SUPABASE_DB_URL in apps/quotation/.env.local — the
   Postgres connection string from Supabase Dashboard → Project
   Settings → Database → Connection string (URI). This is the ONLY
   credential that can run DDL; the service-role API key deliberately
   cannot (Supabase security boundary).

   Wired into `npm run dev` via predev: with SUPABASE_DB_URL set the
   app always starts fully migrated; without it, it skips with a
   warning instead of blocking development.                            */

const fs = require('fs');
const path = require('path');

/* .env.local loader (same zero-dependency pattern as server.js) */
(function loadEnv() {
  for (const file of [path.join(__dirname, '..', '.env.local')]) {
    try {
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('=');
        if (i < 1) continue;
        const k = t.slice(0, i).trim();
        let v = t.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!(k in process.env)) process.env[k] = v;
      }
    } catch (_) {}
  }
})();

/* pg lives in the monorepo root node_modules (used by the main site). */
function requirePg() {
  try { return require('pg'); } catch (_) {}
  try { return require(path.join(__dirname, '..', '..', '..', 'node_modules', 'pg')); } catch (_) {}
  return null;
}

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'supabase');
const ORDER = [
  'quotation-schema.sql',
  'quotation-schema-v2.sql',
  'quotation-schema-v5-fix.sql',   // consolidated v3 + v4 + cache reload (idempotent)
  'quotation-schema-v6-bilingual.sql', // stored bilingual columns + perf indexes
  'quotation-schema-v7-material-dims.sql', // structured height/width/length/thickness (value+unit)
  'apps-schema-v9-shared-customers.sql', // shared public.customers (also used by apps/projects) — cross-app, applied here since quotation is the only app with an automated migrator
  'quotation-schema-v8-contracted-started-status.sql', // adds 'contracted'/'started' to qt_quotations.status
  'apps-schema-v10-project-requests.sql', // project_requests table (quotation -> projects handoff) — cross-app
  'apps-schema-v11-quotation-project-sync.sql', // project_status/project_request_id/project_id sync-back columns — cross-app
  'quotation-schema-v9-ww03-rename.sql', // Wood Works entity code/quote_prefix 'WW' -> 'WW-03'
  'quotation-schema-v10-pdf-system.sql', // qt_entities.website + strip hardcoded payment clause from terms templates
];

async function main() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  const soft = process.argv.includes('--if-configured');
  if (!url) {
    const msg = '[migrate] SUPABASE_DB_URL is not set — skipping automatic migration.\n' +
      '[migrate] Add it once to apps/quotation/.env.local (Supabase Dashboard → Project Settings → Database → Connection string URI).';
    if (soft) { console.warn(msg); process.exit(0); }
    console.error(msg); process.exit(1);
  }
  const pg = requirePg();
  if (!pg) { console.error('[migrate] pg module not found (expected in repo root node_modules).'); process.exit(soft ? 0 : 1); }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`create table if not exists _qt_migrations (
      name text primary key, applied_at timestamptz not null default now())`);

    for (const name of ORDER) {
      const file = path.join(MIGRATIONS_DIR, name);
      if (!fs.existsSync(file)) { console.warn('[migrate] missing file, skipped:', name); continue; }
      const { rows } = await client.query('select 1 from _qt_migrations where name = $1', [name]);
      if (rows.length) { console.log('[migrate] already applied:', name); continue; }
      const sql = fs.readFileSync(file, 'utf8');
      process.stdout.write('[migrate] applying ' + name + ' … ');
      try {
        await client.query(sql);          // files manage their own tx/do-blocks; all idempotent
        await client.query('insert into _qt_migrations(name) values ($1) on conflict do nothing', [name]);
        console.log('OK');
      } catch (e) {
        console.log('FAILED');
        console.error('[migrate] ' + name + ': ' + e.message);
        process.exit(1);
      }
    }
    await client.query(`notify pgrst, 'reload schema'`);
    console.log('[migrate] schema cache reload requested — database is up to date.');
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error('[migrate] ' + e.message); process.exit(1); });
