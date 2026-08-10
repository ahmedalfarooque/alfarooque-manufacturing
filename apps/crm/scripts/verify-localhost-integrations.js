'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

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

async function main() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  const token = jwt.sign({ sub: '00000000-0000-0000-0000-000000000000', email: 'localhost-verifier@alfarooque.invalid', role: 'admin', app: 'crm' }, process.env.JWT_SECRET, { expiresIn: 300 });
  const headers = { cookie: `af_crm_session=${token}` };
  const response = await fetch('http://localhost:3060/api/integrations', { headers });
  if (!response.ok) throw new Error(`Integration API returned HTTP ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const integrations = payload.integrations || [];
  const keys = integrations.map(item => item.integration_key).sort();
  const expected = ['alfarooque_erp','email','smartlife','website','whatsapp'].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error(`Unexpected top-level integrations: ${keys.join(', ')}`);
  const erp = integrations.find(item => item.integration_key === 'alfarooque_erp');
  const moduleKeys = (erp?.modules || []).map(module => module.key).sort();
  if (JSON.stringify(moduleKeys) !== JSON.stringify(['accounting','cars','crm','inventory','projects','quotation'])) throw new Error(`Unexpected ERP modules: ${moduleKeys.join(', ')}`);
  if ((erp.modules || []).some(module => module.status !== 'connected')) throw new Error('One or more internal ERP module health checks failed.');
  const detail = await fetch('http://localhost:3060/integrations/alfarooque_erp', { headers, redirect: 'manual' });
  if (detail.status !== 200) throw new Error(`ERP detail route returned HTTP ${detail.status}.`);
  const connection = await fetch('http://localhost:3060/api/integrations/alfarooque_erp/test', { method: 'POST', headers });
  const connectionResult = await connection.json();
  if (!connection.ok || !connectionResult.connected) throw new Error(`ERP connection test failed: ${connectionResult.error || connection.status}`);
  console.log(JSON.stringify({ topLevelIntegrations: keys, erpModules: erp.modules, detailRoute: detail.status, connectionTest: connectionResult.connected }, null, 2));
}

main().catch(error => { console.error(error.message); process.exit(1); });
