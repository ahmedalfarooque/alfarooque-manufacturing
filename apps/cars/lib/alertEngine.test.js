'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runExpiryAlertJob, runTestNotification } = require('./alertEngine');
const { buildExpiryDigest } = require('./expiryEmail');

/* In-memory twin of lib/alertStore.js with the same claim semantics:
   a (alert, recipient, day) row can be claimed once; failed rows (and
   mocked rows when going live) can be re-claimed. */
/* `recipients`: plain emails subscribe to BOTH types; { email, types } for
   one type. `settings`: per-type overrides, e.g. { insurance: { enabled: false } }. */
function memoryStore({ settings = {}, recipients = [] } = {}) {
  let seq = 0;
  const base = { enabled: true, auto_notify_enabled: true, email_language: 'en' };
  const s = {
    settings: { insurance: { ...base, ...(settings.insurance || {}) }, inspection: { ...base, ...(settings.inspection || {}) } },
    recipients: recipients.flatMap(r => (typeof r === 'string' ? [{ email: r, types: ['insurance', 'inspection'] }] : [r])
      .flatMap(r => r.types.map(t => ({ id: r.email + ':' + t, email: r.email, alert_type: t, enabled: r.enabled !== false })))),
    alerts: [], deliveries: [], runs: [], testSends: [],
  };
  const find = (c, t, d) => s.alerts.find(a => a.car_id === c && a.alert_type === t && a.expiry_date === d);
  const del = (id, r, day) => s.deliveries.find(x => x.alert_id === id && x.recipient === r && x.sent_on === day);
  return Object.assign(s, {
    async getSettings() { return s.settings; },
    async listRecipients() { return s.recipients; },
    async listActiveAlertStates() { return s.alerts.filter(a => a.state === 'active'); },
    async findAlert(c, t, d) { return find(c, t, d) || null; },
    async upsertActiveAlert({ car_id, alert_type, expiry_date, today }) {
      let a = find(car_id, alert_type, expiry_date);
      if (!a) { a = { id: 'al' + (++seq), car_id, alert_type, expiry_date, state: 'active', first_detected_on: today, last_sent_on: null }; s.alerts.push(a); }
      else if (a.state === 'resolved') Object.assign(a, { state: 'active', resolved_on: null, resolved_reason: null });
      return a;
    },
    async resolveAlert(id, today, reason) { Object.assign(s.alerts.find(a => a.id === id), { state: 'resolved', resolved_on: today, resolved_reason: reason }); },
    async claimDelivery({ alertId, recipient, day }) {
      const row = del(alertId, recipient, day);
      if (!row) { s.deliveries.push({ alert_id: alertId, recipient, sent_on: day, status: 'pending' }); return true; }
      if (row.status === 'failed') { row.status = 'pending'; return true; }
      return false;
    },
    async finishDelivery({ alertId, recipient, day, status, error }) { Object.assign(del(alertId, recipient, day), { status, error: error || null }); },
    async isDelivered(alertId, recipient, day) { const r = del(alertId, recipient, day); return !!r && r.status === 'sent'; },
    async markSent(id, day) { s.alerts.find(a => a.id === id).last_sent_on = day; },
    async startRun({ trigger, today }) { s.runs.push({ id: 'r' + s.runs.length, trigger, today, status: 'running' }); return 'r' + (s.runs.length - 1); },
    async finishRun(id, report, err) { Object.assign(s.runs.find(r => r.id === id), { status: err ? 'failed' : report.emailsFailed ? 'partial' : 'ok', sent: report.emailsSent }); },
    async lastRun() { return s.runs[s.runs.length - 1] || null; },
    async recordTestSend(row) { s.testSends.push(row); },
    async lastTestSend(t) { return s.testSends.filter(x => x.alertType === t).pop() || null; },
  });
}

/* Day N of the scenario, as a Riyadh-noon instant so the date is unambiguous. */
const day = n => new Date(Date.UTC(2026, 9, 6 + n, 9, 0, 0));
const iso = n => new Date(Date.UTC(2026, 9, 6 + n)).toISOString().slice(0, 10);

function harness(vehicles, storeOpts) {
  const store = memoryStore(storeOpts);
  const sent = [];
  let failFor = new Set();
  const send = async m => { if (failFor.has(m.to)) throw new Error('provider down'); sent.push(m); return { id: 'm' + sent.length }; };
  const run = (n, extra = {}) => runExpiryAlertJob({ store, vehicles, send, now: day(n), ...extra });
  return { store, sent, run, vehicles, fail: (...r) => { failFor = new Set(r); } };
}

const car = (over = {}) => ({ id: 'c1', vehicle_number: '7245 ب ص ن', name: 'Suzuki Pickup', insurance_expiry: iso(25), periodic_inspection_expiry: null, ...over });

test('insurance 25 days out → one email today to every enabled recipient', async () => {
  const h = harness([car()], { recipients: ['a@x.com', 'b@x.com'] });
  const r = await h.run(0);
  assert.equal(r.emailsSent, 2);
  assert.deepEqual(h.sent.map(m => m.to).sort(), ['a@x.com', 'b@x.com']);
  assert.match(h.sent[0].subject, /^Vehicle Insurance Expiry Alert — 7245/);
  assert.match(h.sent[0].html, /25 days/);
});

test('16 same alert cannot send twice on the same day (re-run, overlapping cron)', async () => {
  const h = harness([car()], { recipients: ['a@x.com'] });
  await h.run(0);
  const again = await h.run(0);
  assert.equal(again.emailsSent, 0);
  assert.equal(again.duplicatesSkipped, 1);
  assert.equal(h.sent.length, 1);
  // two concurrent runs: only one can claim
  const h2 = harness([car()], { recipients: ['a@x.com'] });
  await Promise.all([h2.run(0), h2.run(0)]);
  assert.equal(h2.sent.length, 1);
});

test('17 daily reminder resumes the next day and keeps counting down', async () => {
  const h = harness([car()], { recipients: ['a@x.com'] });
  await h.run(0); await h.run(1); await h.run(2);
  assert.equal(h.sent.length, 3);
  assert.match(h.sent[0].html, /25 days/);
  assert.match(h.sent[1].html, /24 days/);
  assert.match(h.sent[2].html, /23 days/);
});

test('outside the 30-day window nothing is sent; entering it starts the mails', async () => {
  const h = harness([car({ insurance_expiry: iso(33) })], { recipients: ['a@x.com'] });
  assert.equal((await h.run(0)).emailsSent, 0);   // 33 days
  assert.equal((await h.run(2)).emailsSent, 0);   // 31 days
  assert.equal((await h.run(3)).emailsSent, 1);   // 30 days
});

test('expired records keep emailing daily until the record is updated', async () => {
  const h = harness([car({ insurance_expiry: iso(-3) })], { recipients: ['a@x.com'] });
  await h.run(0); await h.run(1);
  assert.equal(h.sent.length, 2);
  assert.match(h.sent[0].html, /Expired 3 days ago/);
});

test('12/18 renewing the insurance date resolves the old alert and stops the mails', async () => {
  const h = harness([car({ insurance_expiry: iso(10) })], { recipients: ['a@x.com'] });
  await h.run(0);
  h.vehicles[0].insurance_expiry = '2027-10-20';   // user renews
  const r = await h.run(1);
  assert.equal(r.emailsSent, 0);
  assert.deepEqual(r.resolved.map(x => x.reason), ['renewed']);
  assert.equal(h.store.alerts[0].state, 'resolved');
  assert.equal((await h.run(2)).emailsSent, 0);
});

test('13 renewing the inspection date resolves independently of insurance', async () => {
  const h = harness([car({ insurance_expiry: iso(10), periodic_inspection_expiry: iso(10) })], { recipients: ['a@x.com'] });
  await h.run(0);
  assert.match(h.sent[0].html, /Periodic Vehicle Inspection/);
  h.vehicles[0].periodic_inspection_expiry = '2027-06-01';
  const r = await h.run(1);
  assert.equal(r.resolved.length, 1);
  assert.equal(r.resolved[0].alertType, 'inspection');
  assert.equal(r.emailsSent, 1);                       // insurance still active
  assert.doesNotMatch(h.sent[1].html, /Periodic Vehicle Inspection/);
});

test('changing to a different date inside the window = fresh alert state, old one resolved', async () => {
  const h = harness([car({ insurance_expiry: iso(10) })], { recipients: ['a@x.com'] });
  await h.run(0);
  h.vehicles[0].insurance_expiry = iso(20);
  const r = await h.run(0);   // same day: new key → fresh state → sends (not a duplicate of the old key)
  assert.equal(r.resolved[0].reason, 'renewed');
  assert.equal(h.store.alerts.filter(a => a.state === 'active').length, 1);
  assert.equal(h.store.alerts.find(a => a.state === 'active').expiry_date, iso(20));
});

test('removing the date resolves the alert and never emails a "missing date" alert', async () => {
  const h = harness([car({ insurance_expiry: iso(10) })], { recipients: ['a@x.com'] });
  await h.run(0);
  h.vehicles[0].insurance_expiry = null;
  const r = await h.run(1);
  assert.deepEqual(r.resolved.map(x => x.reason), ['date_removed']);
  assert.equal(r.emailsSent, 0);
  assert.equal(h.sent.length, 1);
});

test('11 both documents expiring → ONE digest per recipient listing both', async () => {
  const h = harness([car({ insurance_expiry: iso(20), periodic_inspection_expiry: iso(5) })], { recipients: ['a@x.com'] });
  const r = await h.run(0);
  assert.equal(r.emailsSent, 1);
  assert.match(h.sent[0].subject, /Fleet Expiry Alerts — 2 items/);
  assert.match(h.sent[0].html, /Vehicle Insurance/);
  assert.match(h.sent[0].html, /Periodic Vehicle Inspection/);
});

test('14 multiple recipients: disabled ones are skipped, each gets their own message', async () => {
  const h = harness([car()], { recipients: ['a@x.com', 'b@x.com', 'c@x.com'] });
  for (const r of h.store.recipients) if (r.email === 'b@x.com') r.enabled = false;
  await h.run(0);
  assert.deepEqual(h.sent.map(m => m.to).sort(), ['a@x.com', 'c@x.com']);
  assert.ok(h.sent.every(m => !m.html.includes('b@x.com') && !m.text.includes('c@x.com')), 'recipients never see each other');
});

test('settings: auto-notify off sends nothing; disabling a type drops it from the digest', async () => {
  let h = harness([car({ periodic_inspection_expiry: iso(5) })], { recipients: ['a@x.com'], settings: { insurance: { auto_notify_enabled: false }, inspection: { auto_notify_enabled: false } } });
  let r = await h.run(0);
  assert.equal(r.emailsSent, 0); assert.ok(r.reasonsNotSent.includes('auto_notify_disabled'));
  assert.equal(h.store.alerts.filter(a => a.state === 'active').length, 2, 'still tracked when only auto-notify is off');
  h = harness([car({ periodic_inspection_expiry: iso(5) })], { recipients: ['a@x.com'], settings: { insurance: { enabled: false } } });
  await h.run(0);
  assert.doesNotMatch(h.sent[0].html, /Vehicle Insurance</);
  assert.match(h.sent[0].subject, /Periodic Vehicle Inspection Expiry Alert/);
});

test('no recipients / no alerts → nothing sent, reason reported', async () => {
  let r = await harness([car()], { recipients: [] }).run(0);
  assert.ok(r.reasonsNotSent.includes('no_enabled_recipients'));
  r = await harness([car({ insurance_expiry: iso(200) })], { recipients: ['a@x.com'] }).run(0);
  assert.ok(r.reasonsNotSent.includes('no_active_alerts'));
});

test('provider failure for one recipient: others still sent; same-day retry only resends the failure', async () => {
  const h = harness([car()], { recipients: ['a@x.com', 'b@x.com'] });
  h.fail('b@x.com');
  let r = await h.run(0);
  assert.equal(r.emailsSent, 1); assert.equal(r.emailsFailed, 1);
  assert.equal(r.errors[0].to, 'b***@x.com');          // masked
  h.fail();                                              // provider recovers
  r = await h.run(0);
  assert.equal(r.emailsSent, 1);
  assert.deepEqual(h.sent.map(m => m.to), ['a@x.com', 'b@x.com']);   // a not re-sent
});

test('deactivated vehicle: its alerts resolve, nothing is sent', async () => {
  const h = harness([car()], { recipients: ['a@x.com'] });
  await h.run(0);
  h.vehicles.length = 0;
  const r = await h.run(1);
  assert.deepEqual(r.resolved.map(x => x.reason), ['vehicle_inactive']);
  assert.equal(h.sent.length, 1);
});

test('dry run computes the plan but writes and sends nothing', async () => {
  const h = harness([car()], { recipients: ['a@x.com'] });
  const r = await h.run(0, { dryRun: true });
  assert.equal(h.sent.length, 0);
  assert.equal(h.store.alerts.length, 0);
  assert.equal(h.store.deliveries.length, 0);
  assert.deepEqual(r.plan, [{ to: 'a***@x.com', items: 1 }]);
});

test('provider not configured: nothing is ever reported as sent; retry works once configured', async () => {
  const h = harness([car()], { recipients: ['a@x.com'] });
  const notConfigured = async () => { const e = new Error('Email is not configured (missing RESEND_API_KEY).'); e.code = 'NO_EMAIL_CONFIG'; throw e; };
  let r = await runExpiryAlertJob({ store: h.store, vehicles: h.vehicles, send: notConfigured, now: day(0) });
  assert.deepEqual([r.emailsSent, r.emailsFailed], [0, 1]);
  assert.match(r.errors[0].message, /not configured/);
  assert.equal(h.store.deliveries[0].status, 'failed');
  assert.equal(h.store.alerts[0].last_sent_on, null);          // never marked as notified
  r = await runExpiryAlertJob({ store: h.store, vehicles: h.vehicles, send: async () => ({ id: 'real' }), now: day(0) });
  assert.equal(r.emailsSent, 1);                                // same day, failed row re-claimed
  assert.equal(h.store.deliveries[0].status, 'sent');
});

test('email template: Arabic is RTL, bilingual has both, HTML is escaped', () => {
  const item = { carId: 'c1', vehicleNumber: '<b>1</b>', vehicleName: 'x', alertType: 'insurance', expiryDate: '2026-10-30', daysRemaining: 24, status: 'expiring_soon', severity: 'warning' };
  const ar = buildExpiryDigest([item], { language: 'ar', baseUrl: 'https://cars.example.com' });
  assert.match(ar.html, /dir="rtl"/);
  assert.match(ar.subject, /تنبيه انتهاء تأمين المركبة/);
  assert.match(ar.html, /24 يوم/);
  assert.doesNotMatch(ar.html, /<b>1<\/b>/);
  assert.match(ar.html, /\/vehicles\/c1/);
  const both = buildExpiryDigest([item], { language: 'both' });
  assert.match(both.html, /dir="ltr"/); assert.match(both.html, /dir="rtl"/);
  assert.doesNotMatch(buildExpiryDigest([item]).html, /RESEND|SMTP|secret/i);
});

test('per-type recipients: an inspection-only recipient never receives insurance alerts', async () => {
  const h = harness([car({ insurance_expiry: iso(10), periodic_inspection_expiry: iso(5) })], { recipients: [{ email: 'ins@x.com', types: ['insurance'] }, { email: 'insp@x.com', types: ['inspection'] }, 'both@x.com'] });
  const r = await h.run(0);
  assert.equal(r.emailsSent, 3);
  const by = Object.fromEntries(h.sent.map(m => [m.to, m.html]));
  assert.match(by['ins@x.com'], /Vehicle Insurance/); assert.doesNotMatch(by['ins@x.com'], /Periodic Vehicle Inspection/);
  assert.match(by['insp@x.com'], /Periodic Vehicle Inspection/); assert.doesNotMatch(by['insp@x.com'], /Vehicle Insurance</);
  assert.match(by['both@x.com'], /Vehicle Insurance/); assert.match(by['both@x.com'], /Periodic Vehicle Inspection/);
  assert.equal(r.byType.insurance.recipients, 2); assert.equal(r.byType.inspection.recipients, 2);
});

test('per-type language: Arabic inspection + English insurance → bilingual combined digest', async () => {
  const h = harness([car({ insurance_expiry: iso(10), periodic_inspection_expiry: iso(5) })], { recipients: ['a@x.com'], settings: { inspection: { email_language: 'ar' } } });
  await h.run(0);
  assert.match(h.sent[0].html, /dir="rtl"/); assert.match(h.sent[0].html, /dir="ltr"/);
});

test('test notification: real template marked TEST, type recipients only, logged separately, no delivery rows', async () => {
  const h = harness([car({ insurance_expiry: iso(10) })], { recipients: [{ email: 'ins@x.com', types: ['insurance'] }, { email: 'insp@x.com', types: ['inspection'] }], settings: { insurance: { email_language: 'ar' } } });
  const send = async m => { h.sent.push(m); return { id: 't1' }; };
  let r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send, alertType: 'insurance', now: day(0), sentBy: 'admin@x.com' });
  assert.deepEqual([r.sent, r.failed, r.usedSample, r.recipients], [1, 0, false, 1]);
  assert.equal(h.sent[0].to, 'ins@x.com');
  assert.match(h.sent[0].subject, /^\[اختبار\]/);
  assert.match(h.sent[0].html, /اختبار/); assert.match(h.sent[0].text, /\[اختبار\]/);
  assert.equal(h.store.deliveries.length, 0); assert.equal(h.store.alerts.length, 0);
  assert.equal(h.store.testSends.length, 1); assert.equal(h.store.testSends[0].status, 'sent'); assert.equal(h.store.testSends[0].providerId, 't1');
  assert.equal(r.results[0].providerId, 't1');
  // inspection has no real alert → clearly-marked sample, still no writes to real state
  r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send, alertType: 'inspection', now: day(0) });
  assert.equal(r.usedSample, true); assert.match(h.sent[1].html, /TEST-0000/); assert.match(h.sent[1].html, /sample for layout only/);
  assert.doesNotMatch(h.sent[1].html, /\/vehicles\/null/);
  // a real run afterwards is unaffected by the test sends
  const real = await h.run(0);
  assert.equal(real.emailsSent, 1);
});

test('test notification: provider failure is reported honestly, no recipients → reason', async () => {
  const h = harness([car()], { recipients: ['a@x.com'] });
  const r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send: async () => { throw new Error('boom'); }, alertType: 'insurance', now: day(0) });
  assert.deepEqual([r.sent, r.failed], [0, 1]); assert.equal(r.results[0].to, 'a***@x.com');
  const none = await runTestNotification({ store: memoryStore(), vehicles: [], send: async () => ({}), alertType: 'insurance', now: day(0) });
  assert.equal(none.reason, 'no_enabled_recipients');
});

test('test notification: recipientIds restricts the send; disabled ids are still skipped', async () => {
  const h = harness([car({ insurance_expiry: iso(10) })], { recipients: [{ email: 'a@x.com', types: ['insurance'] }, { email: 'b@x.com', types: ['insurance'] }, { email: 'c@x.com', types: ['insurance'], enabled: false }] });
  const send = async m => { h.sent.push(m); return { id: 'x' }; };
  let r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send, alertType: 'insurance', now: day(0), recipientIds: ['b@x.com:insurance'] });
  assert.deepEqual([r.sent, r.recipients, h.sent.map(m => m.to)], [1, 1, ['b@x.com']]);
  r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send, alertType: 'insurance', now: day(0), recipientIds: ['c@x.com:insurance'] });
  assert.equal(r.reason, 'no_enabled_recipients'); assert.equal(h.sent.length, 1);
  r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send, alertType: 'insurance', now: day(0) });
  assert.equal(r.sent, 2);                                     // no subset → all enabled
});

test('test notification: multiple selected ids send to exactly those; duplicates collapse to one email', async () => {
  const h = harness([car({ insurance_expiry: iso(10) })], { recipients: [{ email: 'a@x.com', types: ['insurance'] }, { email: 'b@x.com', types: ['insurance'] }, { email: 'c@x.com', types: ['insurance'] }] });
  const send = async m => { h.sent.push(m); return { id: 'x' }; };
  const r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send, alertType: 'insurance', now: day(0), recipientIds: ['a@x.com:insurance', 'c@x.com:insurance', 'a@x.com:insurance'] });
  assert.deepEqual([r.sent, h.sent.map(m => m.to).sort()], [2, ['a@x.com', 'c@x.com']]);
});

test('test notification: ids from another alert type or stale/unknown ids never add a recipient', async () => {
  const h = harness([car({ insurance_expiry: iso(10) })], { recipients: [{ email: 'a@x.com', types: ['insurance'] }, { email: 'insp@x.com', types: ['inspection'] }] });
  const send = async m => { h.sent.push(m); return { id: 'x' }; };
  let r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send, alertType: 'insurance', now: day(0), recipientIds: ['insp@x.com:inspection'] });
  assert.equal(r.reason, 'no_enabled_recipients');
  r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send, alertType: 'insurance', now: day(0), recipientIds: ['00000000-0000-0000-0000-000000000000', 'attacker@evil.com'] });
  assert.equal(r.reason, 'no_enabled_recipients');
  r = await runTestNotification({ store: h.store, vehicles: h.vehicles, send, alertType: 'insurance', now: day(0), recipientIds: ['insp@x.com:inspection', 'a@x.com:insurance'] });
  assert.deepEqual([r.sent, h.sent.map(m => m.to)], [1, ['a@x.com']]);
});

test('parseRecipientIds: validates shape, trims, dedupes, rejects empty', () => {
  const { parseRecipientIds } = require('./alertSettings');
  assert.deepEqual(parseRecipientIds(undefined), { ids: null });
  assert.deepEqual(parseRecipientIds(['a', ' b ', 'a']), { ids: ['a', 'b'] });
  assert.deepEqual(parseRecipientIds([]), { error: 'EMPTY' });
  assert.deepEqual(parseRecipientIds(['', 'a']), { error: 'INVALID' });
  assert.deepEqual(parseRecipientIds('a'), { error: 'INVALID' });
  assert.deepEqual(parseRecipientIds([1]), { error: 'INVALID' });
  assert.deepEqual(parseRecipientIds([{ email: 'x@y.com' }]), { error: 'INVALID' });
});

test('test-send cooldown: 30 s guard per alert type, tolerant of missing/invalid timestamps', () => {
  const { isWithinCooldown, TEST_COOLDOWN_MS } = require('./alertSettings');
  const now = Date.UTC(2026, 9, 6, 12, 0, 0);
  assert.equal(TEST_COOLDOWN_MS, 30000);
  assert.equal(isWithinCooldown({ created_at: new Date(now - 5000).toISOString() }, now), true);
  assert.equal(isWithinCooldown({ created_at: new Date(now - 31000).toISOString() }, now), false);
  assert.equal(isWithinCooldown(null, now), false);
  assert.equal(isWithinCooldown({ created_at: 'garbage' }, now), false);
});
