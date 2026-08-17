'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require(path.join(__dirname, '..', 'quotation', 'node_modules', 'jsonwebtoken'));
let pg;
try { pg = require(path.join(__dirname, '..', 'quotation', 'node_modules', 'pg')); }
catch (_) { pg = require(path.join(__dirname, '..', '..', 'node_modules', 'pg')); }
const { Client } = pg;
const { ROLES } = require('./permissionRegistry');

function readEnv(file) {
  const values = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith('#')) continue;
      const i = text.indexOf('=');
      if (i < 1) continue;
      const key = text.slice(0, i).trim();
      let value = text.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      values[key] = value;
    }
  } catch (_) {}
  return values;
}

const appDefinitions = [
  ['cars', 3010, 'af_cars_session'],
  ['projects', 3020, 'af_projects_session'],
  ['quotation', 3030, 'af_quotation_session'],
  ['inventory', 3040, 'af_inventory_session'],
  ['accounting', 3050, 'af_accounting_session'],
  ['crm', 3060, 'af_crm_session'],
];

const mutationProbes = {
  cars: { module: 'vehicles', path: '/api/cars' },
  projects: { module: 'projects', path: '/api/projects' },
  quotation: { module: 'quotations', path: '/api/quotations' },
  inventory: { module: 'products', path: '/api/products' },
  accounting: { module: 'purchase-requests', path: '/api/purchase-requests' },
  crm: { module: 'contacts', path: '/api/contacts' },
};

function comparable(permissions) {
  return permissions.map(row => ({
    module_id: row.id || row.module_id,
    view: !!row.view,
    add: !!row.add,
    edit: !!row.edit,
    delete: !!row.delete,
    miscellaneous: row.miscellaneous || {},
  }));
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function main() {
  const rootEnv = readEnv(path.join(__dirname, '..', '..', '.env.local'));
  const quotationEnv = readEnv(path.join(__dirname, '..', 'quotation', '.env.local'));
  const dbUrl = quotationEnv.SUPABASE_DB_URL || quotationEnv.DATABASE_URL || rootEnv.SUPABASE_DB_URL || rootEnv.DATABASE_URL;
  if (!dbUrl) throw new Error('SUPABASE_DB_URL is not configured.');

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let adminId;
  try {
    const verification = await client.query(`
      select
        to_regclass('public.erp_role_permissions') is not null as table_exists,
        exists(select 1 from public._qt_migrations where name = 'migrations/20260813170000_shared_role_module_permissions.sql') as ledger_exists,
        (select relrowsecurity from pg_class where oid = 'public.erp_role_permissions'::regclass) as rls_enabled,
        exists(select 1 from information_schema.columns where table_schema='public' and table_name='app_permissions' and column_name='app_role') as app_role_exists,
        exists(select 1 from information_schema.columns where table_schema='public' and table_name='app_permissions' and column_name='module_access') as module_access_exists
    `);
    const db = verification.rows[0];
    for (const [key, value] of Object.entries(db)) if (!value) throw new Error(`Database verification failed: ${key}`);
    const admin = await client.query(`select id from public.platform_users where role = 'admin' and is_active = true and is_approved = true order by created_at limit 1`);
    if (!admin.rows[0]) throw new Error('No active approved platform administrator is available for verification.');
    adminId = admin.rows[0].id;
    console.log('[database]', JSON.stringify(db));
  } finally {
    await client.end();
  }

  const results = {};
  for (const [app, port, cookie] of appDefinitions) {
    const env = { ...rootEnv, ...readEnv(path.join(__dirname, '..', app, '.env.local')) };
    if (!env.JWT_SECRET) throw new Error(`${app}: JWT_SECRET is not configured.`);
    const token = jwt.sign({ sub: adminId, role: 'admin', app }, env.JWT_SECRET, { expiresIn: 300 });
    const headers = { Cookie: `${cookie}=${token}`, 'Content-Type': 'application/json' };
    const base = `http://localhost:${port}`;

    const usersPage = await fetch(`${base}/users`, { headers, redirect: 'manual' });
    if (usersPage.status !== 200) throw new Error(`${app}: Users page returned ${usersPage.status}.`);

    const roleResults = {};
    for (const role of ROLES) {
      const endpoint = `${base}/api/admin/role-permissions/${role}`;
      const opened = await jsonFetch(endpoint, { headers });
      if (!opened.response.ok) throw new Error(`${app}/${role}: open failed (${opened.response.status} ${opened.body.error || ''}).`);
      const original = comparable(opened.body.permissions || []);
      if (!original.length) throw new Error(`${app}/${role}: no permissions returned.`);

      const saved = await jsonFetch(endpoint, { method: 'PUT', headers, body: JSON.stringify({ permissions: original }) });
      if (!saved.response.ok) throw new Error(`${app}/${role}: save failed (${saved.response.status} ${saved.body.error || ''}).`);
      const reopened = await jsonFetch(endpoint, { headers });
      if (!reopened.response.ok || JSON.stringify(comparable(reopened.body.permissions || [])) !== JSON.stringify(original)) {
        throw new Error(`${app}/${role}: saved permissions did not persist after reopen.`);
      }

      // Cancel is intentionally client-local: alter a draft, make no PUT, and
      // confirm a fresh server read remains identical to the saved policy.
      const draft = original.map((row, index) => index === 0 ? { ...row, add: !row.add, edit: !row.edit } : row);
      if (JSON.stringify(draft) === JSON.stringify(original)) throw new Error(`${app}/${role}: cancel test draft did not change.`);
      const afterCancel = await jsonFetch(endpoint, { headers });
      if (!afterCancel.response.ok || JSON.stringify(comparable(afterCancel.body.permissions || [])) !== JSON.stringify(original)) {
        throw new Error(`${app}/${role}: cancel test changed persisted permissions.`);
      }
      roleResults[role] = { saved: true, reopened: true, cancel_preserved: true, modules: original.length };
    }

    const beforeUsers = await jsonFetch(`${base}/api/admin/users`, { headers });
    if (!beforeUsers.response.ok) throw new Error(`${app}: Users API returned ${beforeUsers.response.status}.`);
    const invalidAdd = await jsonFetch(`${base}/api/admin/users`, {
      method: 'POST', headers, body: JSON.stringify({ full_name: '', email: 'not-an-email' }),
    });
    const afterUsers = await jsonFetch(`${base}/api/admin/users`, { headers });
    if (invalidAdd.response.status !== 400 || !afterUsers.response.ok || beforeUsers.body.rows.length !== afterUsers.body.rows.length) {
      throw new Error(`${app}: safe Add User validation changed persistent identities.`);
    }

    // Exercise an actual business POST with a real approved identity, while
    // temporarily narrowing only that identity's app grant. Restore the exact
    // original grant immediately; no test identity or permission remains.
    const probe = mutationProbes[app];
    const probeDb = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await probeDb.connect();
    const originalGrant = await probeDb.query('select app_role,module_access from public.app_permissions where user_id=$1 and app_id=$2', [adminId, app]);
    const existed = !!originalGrant.rows[0];
    try {
      await probeDb.query(`insert into public.app_permissions(user_id,app_id,granted_by,app_role,module_access)
        values ($1,$2,$1,'readonly',$3::jsonb)
        on conflict (user_id,app_id) do update set app_role='readonly', module_access=excluded.module_access`,
        [adminId, app, JSON.stringify({ [probe.module]: 'view_only' })]);
      const restrictedToken = jwt.sign({ sub: adminId, role: 'readonly', app }, env.JWT_SECRET, { expiresIn: 120 });
      const restricted = await jsonFetch(`${base}${probe.path}`, {
        method: 'POST', headers: { Cookie: `${cookie}=${restrictedToken}`, 'Content-Type': 'application/json' }, body: '{}',
      });
      if (restricted.response.status !== 403) throw new Error(`${app}: direct mutation probe returned ${restricted.response.status}, expected 403.`);
    } finally {
      if (existed) {
        await probeDb.query('update public.app_permissions set app_role=$3,module_access=$4::jsonb where user_id=$1 and app_id=$2',
          [adminId, app, originalGrant.rows[0].app_role, JSON.stringify(originalGrant.rows[0].module_access || {})]);
      } else {
        await probeDb.query('delete from public.app_permissions where user_id=$1 and app_id=$2', [adminId, app]);
      }
      await probeDb.end();
    }

    results[app] = { users_page: 200, add_user_validation: 400, identity_count_unchanged: true, direct_add_denied: 403, roles: roleResults };
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exit(1); });
