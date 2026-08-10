'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

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

async function main() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  const token = jwt.sign({
    sub: '00000000-0000-0000-0000-000000000001',
    email: 'permission-probe.invalid@localhost', role: 'viewer', app: 'projects',
  }, process.env.JWT_SECRET, { expiresIn: 60 });
  const response = await fetch('http://localhost:3020/api/quotation-requests/00000000-0000-0000-0000-000000000000', {
    method: 'DELETE', headers: { Cookie: `af_projects_session=${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== 403) throw new Error(`Expected 403, received ${response.status}: ${body.error || 'unknown response'}`);
  console.log('✓ Authenticated unauthorized Quotation Approval DELETE returned 403.');
  console.log('✓ Nonexistent IDs were used; no business record was modified.');
}

main().catch(error => { console.error('✗ ' + error.message); process.exit(1); });
