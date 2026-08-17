'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require(path.join(__dirname, '..', 'quotation', 'node_modules', 'jsonwebtoken'));

function readEnv(file) {
  const values = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const text = line.trim(); if (!text || text.startsWith('#')) continue;
      const i = text.indexOf('='); if (i < 1) continue;
      const key = text.slice(0, i).trim(); let value = text.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      values[key] = value;
    }
  } catch (_) {}
  return values;
}

const apps = [
  ['cars', 3010, 'af_cars_session'], ['projects', 3020, 'af_projects_session'],
  ['quotation', 3030, 'af_quotation_session'], ['inventory', 3040, 'af_inventory_session'],
  ['accounting', 3050, 'af_accounting_session'], ['crm', 3060, 'af_crm_session'],
];

async function main() {
  const results = {};
  for (const [app, port, cookie] of apps) {
    const env = { ...readEnv(path.join(__dirname, '..', '..', '.env.local')), ...readEnv(path.join(__dirname, '..', app, '.env.local')) };
    if (!env.JWT_SECRET) throw new Error(`${app} JWT_SECRET is not configured.`);
    const token = jwt.sign({ sub: 'users-verifier', email: 'users-verifier@localhost.invalid', role: 'admin', app }, env.JWT_SECRET, { expiresIn: 300 });
    const headers = { Cookie: `${cookie}=${token}` };
    const pages = {};
    for (const route of ['/users', '/users/roles/manager']) {
      const response = await fetch(`http://localhost:${port}${route}`, { headers, redirect: 'manual' });
      pages[route] = response.status;
    }
    const api = await fetch(`http://localhost:${port}/api/admin/users`, { headers });
    const apiBody = await api.json().catch(() => ({}));
    const roleApi = await fetch(`http://localhost:${port}/api/admin/role-permissions/manager`, { headers });
    const roleBody = await roleApi.json().catch(() => ({}));
    results[app] = { pages, usersApi: api.status, roleApi: roleApi.status, apiError: api.ok && roleApi.ok ? null : (apiBody.error || roleBody.error) };
    for (const status of Object.values(pages)) if (status !== 200) throw new Error(`${app} Users page failed with ${status}`);
  }
  console.log(JSON.stringify(results, null, 2));
}
main().catch(error => { console.error(error.message); process.exit(1); });
