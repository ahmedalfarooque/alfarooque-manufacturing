'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(file) {
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

loadEnv(path.join(__dirname, '..', '.env.local'));

const resources = ['products','customers','suppliers','sales-invoices','expenses'];

function session(app, user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured for localhost verification.');
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, app }, process.env.JWT_SECRET, { expiresIn: 300 });
}

async function verifierUser() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase server configuration is missing.');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.from('platform_users').select('id,email,role').eq('role', 'admin').limit(1).maybeSingle();
  if (error || !data) throw new Error('No admin user is available for localhost verification.');
  return data;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned HTTP ${response.status}: ${payload.error || 'request failed'}`);
  return { response, payload };
}

async function main() {
  const user = await verifierUser();
  const crmHeaders = { cookie: `af_crm_session=${session('crm', user)}` };
  const accountingHeaders = { cookie: `af_accounting_session=${session('accounting', user)}` };
  const result = { crm: {}, accounting: {}, connection: false, sync: null, customer360: null, pages: {} };

  for (const resource of resources) {
    const crm = await request(`http://localhost:3060/api/integrations/smartlife/data/${resource}`, { headers: crmHeaders });
    const accounting = await request(`http://localhost:3050/api/smartlife/${resource}`, { headers: accountingHeaders });
    result.crm[resource] = Array.isArray(crm.payload.records) ? crm.payload.records.length : 0;
    result.accounting[resource] = Array.isArray(accounting.payload.records) ? accounting.payload.records.length : 0;
    if (result.crm[resource] !== result.accounting[resource]) throw new Error(`Central resource count mismatch for ${resource}.`);
  }

  const connection = await request('http://localhost:3060/api/integrations/smartlife/test', { method: 'POST', headers: crmHeaders });
  result.connection = connection.payload.connected === true;

  const sync = await request('http://localhost:3060/api/integrations/smartlife/sync', { method: 'POST', headers: crmHeaders });
  result.sync = { status: sync.payload.status, records: sync.payload.records };

  const contacts = await request('http://localhost:3060/api/contacts', { headers: crmHeaders });
  const contact = (contacts.payload.contacts || [])[0];
  if (contact?.id) {
    const detail = await request(`http://localhost:3060/api/contacts/${contact.id}`, { headers: crmHeaders });
    const finance = detail.payload.customer360?.smartErp;
    result.customer360 = { connected: finance?.connected === true, invoices: finance?.invoices?.length || 0 };
  }

  for (const [name, url, headers] of [
    ['crmIntegrations','http://localhost:3060/integrations',crmHeaders],
    ['accountingSmartErp','http://localhost:3050/smartlife/sales-invoices',accountingHeaders],
  ]) {
    const response = await fetch(url, { headers, redirect: 'manual' });
    if (response.status !== 200) throw new Error(`${name} page returned HTTP ${response.status}.`);
    result.pages[name] = response.status;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error.message); process.exit(1); });
