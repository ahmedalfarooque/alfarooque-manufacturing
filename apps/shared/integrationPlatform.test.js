'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  encryptSecrets, decryptSecrets, getSmartLifeConfig, recordsFrom,
  readSmartLife, readAllSmartLife, clearSmartErpTokenForTests, classifySmartErpError,
  normalizeSmartErpSourceMapping,
  SMARTLIFE_RESOURCES, SmartErpReadOnlyViolation,
  SMARTERP_WRITE_AUTHORIZATION_PHRASE, smartErpWritePermissionNotice,
  requireSmartErpWriteAuthorization, auditSmartErpWriteAuthorization,
} = require('./integrationPlatform');

const SMART_KEYS = ['SMARTLIFE_API_BASE_URL','SMARTLIFE_COMPANY','SMARTLIFE_USERNAME','SMARTLIFE_PASSWORD'];
const db = row => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row || null, error: null }) }) }) }) }) });

function setV3Env() {
  process.env.SMARTLIFE_API_BASE_URL = 'https://smarterp.example/api/v3';
  process.env.SMARTLIFE_COMPANY = 'alfarooqe';
  process.env.SMARTLIFE_USERNAME = 'owner';
  process.env.SMARTLIFE_PASSWORD = 'password';
}

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
  setV3Env();
  const config = await getSmartLifeConfig(db({ config: { baseUrl: 'https://ignored.example/' } }));
  assert.equal(config.baseUrl, 'https://smarterp.example/api/v3/');
  assert.equal(config.company, 'alfarooqe');
});

test('extracts both list and single-object SmartERP data envelopes', () => {
  const list = [{ id: 'one' }];
  const single = { id: 'one' };
  assert.equal(recordsFrom({ data: list }), list);
  assert.deepEqual(recordsFrom({ data: single }), [single]);
  assert.deepEqual(recordsFrom({ unexpected: list }), []);
});

test('normalizes stable read-only SmartERP source mappings without duplicating identities', () => {
  const synchronizedAt = '2026-08-12T10:00:00.000Z';
  const first = normalizeSmartErpSourceMapping('products', { id: 42, name: 'Panel', price: 10 }, synchronizedAt);
  const changed = normalizeSmartErpSourceMapping('products', { id: 42, name: 'Panel', price: 12 }, synchronizedAt);
  assert.equal(first.source_record_id, '42');
  assert.equal(changed.source_record_id, first.source_record_id);
  assert.equal(changed.metadata.raw_payload.price, 12);
  assert.equal(changed.metadata.read_only, true);
  assert.equal(changed.source_system, 'smartlife');
  assert.equal(normalizeSmartErpSourceMapping('not-verified', { id: 42 }, synchronizedAt), null);
});

test('authenticates via V3 user/login and reads with the raw access-token header', async () => {
  setV3Env();
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: new URL(String(url)), options });
    if (requests.length === 1) return { ok: true, text: async () => JSON.stringify({ success: true, logged_in: true, access_token: 'v3-test-token', company: 'alfarooqe' }) };
    return { ok: true, text: async () => JSON.stringify({ success: true, data: [{ id: 'product-1' }], total: 1 }) };
  };
  const first = await readSmartLife(db(), 'products');
  const second = await readSmartLife(db(), 'products');
  assert.deepEqual(first.records, [{ id: 'product-1' }]);
  assert.deepEqual(second.records, [{ id: 'product-1' }]);
  assert.equal(requests.length, 3);
  assert.equal(requests[0].url.pathname, '/api/v3/user/login');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[1].url.pathname, '/api/v3/products/get_products_list');
  assert.equal(requests[1].options.method, 'GET');
  assert.equal(requests[1].options.headers.Authorization, 'v3-test-token');
  assert.equal(requests[1].options.headers['app-lang'], 'arabic');
  assert.equal(requests[1].url.searchParams.get('limit'), '100');
});

test('readAllSmartLife walks offset/limit pages until a short page ends it', async () => {
  setV3Env();
  const pages = [
    { success: true, data: Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })), total: 150 },
    { success: true, data: Array.from({ length: 50 }, (_, i) => ({ id: i + 101 })), total: 150 },
  ];
  let pageIndex = 0;
  global.fetch = async (url) => {
    if (String(url).includes('user/login')) return { ok: true, text: async () => JSON.stringify({ success: true, logged_in: true, access_token: 'tok' }) };
    const payload = pages[pageIndex]; pageIndex += 1;
    return { ok: true, text: async () => JSON.stringify(payload) };
  };
  const result = await readAllSmartLife(db(), 'products');
  assert.equal(result.records.length, 150);
  assert.equal(result.total, 150);
});

test('write verbs against SmartERP are rejected before any request is built', async () => {
  setV3Env();
  global.fetch = async () => { throw new Error('fetch must never be called for a blocked write'); };
  const mod = require('./integrationPlatform');
  const config = await mod.getSmartLifeConfig(db());
  await assert.rejects(
    () => mod.__testables.smartErpRequest(new URL('products/add', config.baseUrl), { method: 'POST' }),
    SmartErpReadOnlyViolation,
  );
});

test('an unlisted read path is rejected even as a GET', () => {
  const { __testables } = require('./integrationPlatform');
  assert.throws(() => __testables.assertAllowedReadPath('/api/v3/products/add'), SmartErpReadOnlyViolation);
  assert.doesNotThrow(() => __testables.assertAllowedReadPath('/api/v3/products/get_products_list'));
  assert.doesNotThrow(() => __testables.assertAllowedReadPath('/api/v3/products/product/42'));
});

test('every documented SmartERP resource path is on the verified V3 allow-list', () => {
  for (const path of Object.values(SMARTLIFE_RESOURCES)) assert.match(path, /^[a-z_]+\/[a-z_]+$/);
});

test('classifySmartErpError distinguishes permission/version-mismatch/connection/other errors', () => {
  const permissionError = new Error('The user is unauthorized to access the requested resource');
  permissionError.status = 401;
  assert.equal(classifySmartErpError(permissionError), 'permission_required');

  const wrongStatusSameMessage = new Error('The user is unauthorized to access the requested resource');
  wrongStatusSameMessage.status = 403;
  assert.equal(classifySmartErpError(wrongStatusSameMessage), 'other_error');

  const nonJsonError = new Error('SmartERP returned a non-JSON response (HTTP 200).');
  nonJsonError.isNonJson = true;
  assert.equal(classifySmartErpError(nonJsonError), 'endpoint_or_version_mismatch');

  const networkError = new Error('fetch failed');
  networkError.isNetworkFailure = true;
  assert.equal(classifySmartErpError(networkError), 'connection_error');

  const abortError = new Error('The operation was aborted.');
  abortError.name = 'AbortError';
  assert.equal(classifySmartErpError(abortError), 'connection_error');

  const genericServerError = new Error('SmartERP returned HTTP 500.');
  genericServerError.status = 500;
  assert.equal(classifySmartErpError(genericServerError), 'other_error');

  // Back-compat: a plain message string still classifies correctly.
  assert.equal(classifySmartErpError('The user is unauthorized to access the requested resource'), 'permission_required');
  assert.equal(classifySmartErpError('Some other failure'), 'other_error');
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
