'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  encryptSecrets, decryptSecrets, getSmartLifeConfig, recordsFrom,
  readSmartLife, clearSmartErpTokenForTests,
  SMARTERP_WRITE_AUTHORIZATION_PHRASE, smartErpWritePermissionNotice,
  requireSmartErpWriteAuthorization, auditSmartErpWriteAuthorization,
} = require('./integrationPlatform');

const SMART_KEYS = ['SMARTLIFE_API_BASE_URL','SMARTLIFE_COMPANY','SMARTLIFE_USERNAME','SMARTLIFE_PASSWORD'];
const db = row => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row || null, error: null }) }) }) }) }) });

test.afterEach(() => {
  clearSmartErpTokenForTests();
  delete global.fetch;
  SMART_KEYS.forEach(key => delete process.env[key]);
});

test('integration credentials encrypt and decrypt without plaintext storage', () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = 'test-only-integration-key';
  const encrypted = encryptSecrets({ apiKey: 'secret-value' });
  assert.equal(encrypted.secret_ciphertext.includes('secret-value'), false);
  assert.deepEqual(decryptSecrets(encrypted), { apiKey: 'secret-value' });
});

test('central SmartERP configuration comes from the server environment', async () => {
  process.env.SMARTLIFE_API_BASE_URL = 'https://smarterp.example/api/v1.0';
  process.env.SMARTLIFE_COMPANY = 'company';
  process.env.SMARTLIFE_USERNAME = 'user';
  process.env.SMARTLIFE_PASSWORD = 'password';
  const config = await getSmartLifeConfig(db({ config: { baseUrl: 'https://ignored.example/' } }));
  assert.equal(config.baseUrl, 'https://smarterp.example/api/v1.0/');
  assert.equal(config.company, 'company');
});

test('extracts both list and single-object SmartERP data envelopes', () => {
  const list = [{ id: 'one' }];
  const single = { id: 'one' };
  assert.equal(recordsFrom({ data: list }), list);
  assert.deepEqual(recordsFrom({ data: single }), [single]);
  assert.deepEqual(recordsFrom({ unexpected: list }), []);
});

test('authenticates once and performs token/company read-only POST requests', async () => {
  process.env.SMARTLIFE_API_BASE_URL = 'https://smarterp.example/api/v1.0';
  process.env.SMARTLIFE_COMPANY = 'company';
  process.env.SMARTLIFE_USERNAME = 'user';
  process.env.SMARTLIFE_PASSWORD = 'password';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: new URL(String(url)), options });
    if (requests.length === 1) return { ok: true, json: async () => ({ error: false, company: 'company', token: 'test-token-value' }) };
    return { ok: true, json: async () => ({ error: false, data: [{ id: 'product-1' }] }) };
  };
  const first = await readSmartLife(db(), 'products');
  const second = await readSmartLife(db(), 'products');
  assert.deepEqual(first.records, [{ id: 'product-1' }]);
  assert.deepEqual(second.records, [{ id: 'product-1' }]);
  assert.equal(requests.length, 3);
  assert.equal(requests[0].url.pathname, '/api/v1.0/login');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[1].url.pathname, '/api/v1.0/products/index');
  assert.equal(requests[1].url.searchParams.get('company'), 'company');
  assert.equal(requests[1].options.method, 'POST');
  assert.equal(requests[1].options.headers.Authorization, undefined);
});

test('future SmartERP writes expose an exact red permission warning', () => {
  const notice = smartErpWritePermissionNotice({ target: 'SmartLife', record: 'Product #42', action: 'Update price' });
  assert.equal(notice.color, 'red');
  assert.equal(notice.target, 'SmartLife');
  assert.equal(notice.record, 'Product #42');
  assert.equal(notice.action, 'Update price');
  assert.equal(notice.authorizationPhrase, SMARTERP_WRITE_AUTHORIZATION_PHRASE);
});

test('ordinary edit requests cannot authorize a future SmartERP write', () => {
  assert.throws(
    () => requireSmartErpWriteAuthorization({ target: 'SmartLife', record: 'Product #42', action: 'Update price', authorization: { confirmed: true, phrase: 'please update it' } }),
    error => error.code === 'SMARTERP_WRITE_PERMISSION_REQUIRED' && error.status === 403,
  );
});

test('future SmartERP write authorization must match the exact warning context', () => {
  const request = { target: 'SmartLife', record: 'Product #42', action: 'Update price' };
  const receipt = requireSmartErpWriteAuthorization({
    ...request,
    authorization: { confirmed: true, phrase: SMARTERP_WRITE_AUTHORIZATION_PHRASE, ...request },
  });
  assert.deepEqual(receipt, { authorized: true, ...request });
  assert.throws(() => requireSmartErpWriteAuthorization({
    ...request,
    authorization: { confirmed: true, phrase: SMARTERP_WRITE_AUTHORIZATION_PHRASE, ...request, record: 'Product #43' },
  }));
});

test('verified future SmartERP write authorization is audit-ready without credentials', async () => {
  const inserted = [];
  const auditDb = { from: table => ({ insert: async row => { inserted.push({ table, row }); return { error: null }; } }) };
  const request = { target: 'SmartLife', record: 'Product #42', action: 'Update price' };
  const receipt = requireSmartErpWriteAuthorization({
    ...request,
    authorization: { confirmed: true, phrase: SMARTERP_WRITE_AUTHORIZATION_PHRASE, ...request },
  });
  await auditSmartErpWriteAuthorization(auditDb, 'integration-id', 'actor-id', receipt);
  assert.deepEqual(inserted[0], {
    table: 'crm_integration_audit_logs',
    row: {
      integration_id: 'integration-id', actor_id: 'actor-id', action: 'smarterp.write_authorization',
      details: { target: 'SmartLife', record: 'Product #42', requestedAction: 'Update price', outcome: 'authorized' },
    },
  });
  assert.equal(JSON.stringify(inserted).includes(SMARTERP_WRITE_AUTHORIZATION_PHRASE), false);
});
