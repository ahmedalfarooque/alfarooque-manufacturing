'use strict';

const fs = require('fs');
const path = require('path');

for (const file of [path.join(__dirname, '..', '.env.local')]) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith('#')) continue;
      const index = text.indexOf('=');
      if (index < 1) continue;
      const key = text.slice(0, index).trim();
      let value = text.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (_) {}
}

const { Client } = require('pg');
const TABLES = ['crm_integrations','crm_customer_identities','crm_record_mappings','crm_sync_runs','crm_sync_records','crm_sync_conflicts','crm_timeline_events','crm_webhook_endpoints','crm_webhook_events','crm_integration_audit_logs'];

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('SUPABASE_DB_URL is not configured.');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows: tables } = await client.query(`select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relname = any($1::text[])`, [TABLES]);
    if (tables.length !== TABLES.length) throw new Error(`Expected ${TABLES.length} platform tables, found ${tables.length}.`);
    if (tables.some(table => !table.relrowsecurity)) throw new Error('RLS is not enabled on every integration table.');
    const { rows: integrations } = await client.query('select integration_key,status,enabled from public.crm_integrations order by integration_key');
    const keys = new Set(integrations.map(row => row.integration_key));
    for (const key of ['alfarooque_erp','smartlife','website','email','whatsapp']) if (!keys.has(key)) throw new Error(`Missing integration seed: ${key}`);
    for (const key of ['quotation','projects','inventory','cars']) if (keys.has(key)) throw new Error(`Duplicate top-level ERP integration still exists: ${key}`);
    console.log(JSON.stringify({ tables: tables.length, rlsEnabled: true, integrations }, null, 2));
  } finally { await client.end(); }
}

main().catch(error => { console.error(error.message); process.exit(1); });
