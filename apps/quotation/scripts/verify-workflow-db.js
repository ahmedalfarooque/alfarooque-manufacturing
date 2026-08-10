'use strict';

const fs = require('fs');
const path = require('path');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const text = line.trim();
  if (!text || text.startsWith('#')) continue;
  const split = text.indexOf('=');
  if (split < 1) continue;
  const key = text.slice(0, split).trim();
  let value = text.slice(split + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!(key in process.env)) process.env[key] = value;
}

if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const checks = [
    ['Quotation approval requests', sb.from('project_requests').select('id,quotation_id,status').limit(1)],
    ['Project quotation correlation', sb.from('pm_projects').select('id,quotation_id').limit(1)],
    ['Quotation workflow fields', sb.from('qt_quotations').select('id,status,project_request_id,pm_project_id').limit(1)],
    ['Unified user approval state', sb.from('platform_users').select('id,is_approved').limit(1)],
    ['App-scoped delete permission', sb.from('app_permissions').select('user_id,app_id,can_delete').limit(1)],
  ];
  let failed = false;
  for (const [label, query] of checks) {
    const { error } = await query;
    if (error) { failed = true; console.error(`✗ ${label}: ${error.message}`); }
    else console.log(`✓ ${label}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch(error => { console.error('✗ ' + error.message); process.exit(1); });
