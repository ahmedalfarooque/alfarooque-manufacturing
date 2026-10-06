'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sendEmail, emailConfig } = require('./email');

/* Stub global fetch so Resend is never actually called from tests. */
function withFetch(impl, fn) {
  const orig = global.fetch;
  global.fetch = impl;
  return fn().finally(() => { global.fetch = orig; });
}
function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  return fn().finally(() => { for (const k of Object.keys(saved)) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k]; } });
}
const ok = body => ({ ok: true, status: 200, json: async () => body });
const bad = (status, body) => ({ ok: false, status, json: async () => body });

test('missing Resend configuration fails honestly (no fetch, named variables, no values)', async () => {
  await withEnv({ RESEND_API_KEY: null, EMAIL_FROM: null }, async () => {
    assert.deepEqual(emailConfig(), { provider: 'resend', configured: false, missing: ['RESEND_API_KEY', 'EMAIL_FROM'] });
    let called = false;
    await withFetch(async () => { called = true; }, async () => {
      await assert.rejects(sendEmail({ to: 'a@x.test', subject: 's', html: '<p>h</p>' }), e => e.code === 'NO_EMAIL_CONFIG' && /RESEND_API_KEY, EMAIL_FROM/.test(e.message));
    });
    assert.equal(called, false);
  });
  await withEnv({ RESEND_API_KEY: 're_test_key_not_real', EMAIL_FROM: null }, async () => {
    assert.deepEqual(emailConfig().missing, ['EMAIL_FROM']);
  });
});

test('Resend helper is called correctly and a 2xx is reported as success with the provider id', async () => {
  await withEnv({ RESEND_API_KEY: 're_test_key_not_real', EMAIL_FROM: 'TrackFleet <alerts@example.test>' }, async () => {
    let captured;
    const res = await withFetch(async (url, opt) => { captured = { url, opt }; return ok({ id: 'msg_123' }); },
      () => sendEmail({ to: 'fleet@x.test', subject: '[TEST] S', html: '<p>h</p>', text: 'h' }));
    assert.deepEqual(res, { id: 'msg_123' });
    assert.equal(captured.url, 'https://api.resend.com/emails');
    assert.equal(captured.opt.method, 'POST');
    assert.equal(captured.opt.headers.Authorization, 'Bearer re_test_key_not_real');
    const body = JSON.parse(captured.opt.body);
    assert.deepEqual(body, { from: 'TrackFleet <alerts@example.test>', to: ['fleet@x.test'], subject: '[TEST] S', html: '<p>h</p>', text: 'h' });
  });
});

test('a Resend rejection (4xx) is reported as failure, not success, and is not retried', async () => {
  await withEnv({ RESEND_API_KEY: 're_test_key_not_real', EMAIL_FROM: 'a@example.test' }, async () => {
    let calls = 0;
    await withFetch(async () => { calls++; return bad(422, { message: 'The from address is not verified' }); }, async () => {
      await assert.rejects(sendEmail({ to: 'x@x.test', subject: 's', html: 'h' }), e => e.code === 'SEND_FAILED' && e.status === 422 && /not verified/.test(e.message));
    });
    assert.equal(calls, 1);
  });
});
