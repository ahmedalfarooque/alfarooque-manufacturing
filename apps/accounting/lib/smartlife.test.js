'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { endpointFor, recordsFrom, readSmartLife, SmartLifeConfigurationError } = require('./smartlife');

test.afterEach(() => { delete process.env.SMARTERP_CENTRAL_API_URL; delete global.fetch; });

test('rejects unsupported resources before contacting the central service', () => {
  assert.throws(() => endpointFor('not-a-resource'), SmartLifeConfigurationError);
});

test('routes verified account balances through the central CRM service', () => {
  process.env.SMARTERP_CENTRAL_API_URL = 'https://crm.alfarooque.example';
  assert.equal(
    endpointFor('account-balances').toString(),
    'https://crm.alfarooque.example/api/integrations/smartlife/data/account-balances',
  );
});

test('extracts records without inventing provider data', () => {
  const records = [{ id: 'sl-1' }];
  assert.equal(recordsFrom({ data: records }), records);
  assert.deepEqual(recordsFrom({ unexpected: records }), []);
});

test('uses the protected central SmartERP service without provider credentials', async () => {
  process.env.SMARTERP_CENTRAL_API_URL = 'https://crm.alfarooque.example';
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return { ok: true, json: async () => ({ connected: true, records: [{ id: 'sl-1' }] }) };
  };
  const result = await readSmartLife('sales-invoices', 'erp-session-token');
  assert.deepEqual(result.records, [{ id: 'sl-1' }]);
  assert.equal(request.url, 'https://crm.alfarooque.example/api/integrations/smartlife/data/sales-invoices');
  assert.equal(request.options.method, 'GET');
  assert.match(request.options.headers.Cookie, /^af_crm_session=/);
  assert.equal(request.options.headers.Authorization, undefined);
});

test('preserves synchronized snapshot metadata when live module permission is denied', async () => {
  process.env.SMARTERP_CENTRAL_API_URL = 'https://crm.alfarooque.example';
  global.fetch = async () => ({
    ok: false, status: 403,
    json: async () => ({
      connected: false, permission_required: true, source: 'synchronized_snapshot',
      records: [{ id: 'sale-1' }], total: 1, snapshot_available: true,
    }),
  });
  await assert.rejects(
    () => readSmartLife('sales-invoices', 'erp-session-token'),
    error => error.permissionRequired === true
      && error.centralPayload?.snapshot_available === true
      && error.centralPayload?.records?.[0]?.id === 'sale-1',
  );
});
