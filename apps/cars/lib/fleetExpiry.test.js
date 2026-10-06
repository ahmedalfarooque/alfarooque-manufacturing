'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('./fleetExpiry');
const { normalizeEmail, isValidEmail } = require('./alertSettings');

/* Fixed clock: 2026-10-06 12:00 in Riyadh. */
const NOW = new Date('2026-10-06T09:00:00Z');
const TODAY = '2026-10-06';
const plus = n => new Date(Date.UTC(2026, 9, 6 + n)).toISOString().slice(0, 10);
const ins = date => fx.computeExpiry(date, { type: 'insurance', today: TODAY });

test('today is the company-timezone calendar date, not UTC', () => {
  assert.equal(fx.todayInZone(NOW, 'Asia/Riyadh'), '2026-10-06');
  assert.equal(fx.todayInZone(new Date('2026-10-06T21:30:00Z'), 'Asia/Riyadh'), '2026-10-07'); // 00:30 next day in KSA
  assert.equal(fx.todayInZone(new Date('2026-10-06T21:30:00Z'), 'UTC'), '2026-10-06');
});

test('1 insurance expiring in exactly 30 days is within the window', () => {
  const r = ins(plus(30));
  assert.equal(r.daysRemaining, 30);
  assert.equal(r.status, 'expiring_soon');
  assert.equal(r.severity, 'warning');
  assert.equal(r.isWithin30Days, true);
  assert.equal(r.isActive, true);
});

test('31 days is valid / normal and not active', () => {
  const r = ins(plus(31));
  assert.deepEqual([r.status, r.severity, r.isWithin30Days, r.isActive], ['valid', 'normal', false, false]);
});

test('severity bands: 0-7 critical, 8-15 urgent, 16-30 warning', () => {
  const sev = n => ins(plus(n)).severity;
  assert.deepEqual([0, 7, 8, 15, 16, 30].map(sev), ['critical', 'critical', 'urgent', 'urgent', 'warning', 'warning']);
});

test('2 insurance expiring in 7 days is critical', () => {
  const r = ins(plus(7));
  assert.deepEqual([r.daysRemaining, r.severity, r.status], [7, 'critical', 'expiring_soon']);
});

test('expiring today is critical, within 30 days, not expired', () => {
  const r = ins(TODAY);
  assert.deepEqual([r.daysRemaining, r.severity, r.isExpired, r.isWithin30Days], [0, 'critical', false, true]);
});

test('3 expired insurance', () => {
  const r = ins(plus(-1));
  assert.deepEqual([r.daysRemaining, r.status, r.severity, r.isExpired, r.isWithin30Days, r.isActive], [-1, 'expired', 'expired', true, false, true]);
});

test('5 missing / blank / invalid dates are "missing_date", never expired, never a fake date', () => {
  for (const v of [null, undefined, '', '   ', 'garbage', '2026-02-31', '2026-13-01']) {
    const r = ins(v);
    assert.equal(r.status, 'missing_date', String(v));
    assert.equal(r.daysRemaining, null);
    assert.equal(r.expiryDate, null);
    assert.equal(r.isExpired, false);
    assert.equal(r.isActive, false);
  }
});

test('Postgres timestamp strings parse to their calendar date', () => {
  assert.equal(fx.normalizeDate('2026-10-30T00:00:00.000Z'), '2026-10-30');
  assert.equal(fx.normalizeDate('2026-10-30'), '2026-10-30');
});

test('leap day / year boundary day math', () => {
  assert.equal(fx.daysBetween('2027-12-31', '2028-03-01'), 61); // 2028 is a leap year
  assert.equal(fx.daysBetween('2026-12-31', '2027-01-01'), 1);
});

test('4 valid insurance far in the future; 12 updated date', () => {
  assert.equal(ins('2027-10-20').status, 'valid');
});

test('insurance details: displayStatus reflects missing company / policy number', () => {
  const v = { id: 'a', vehicle_number: 'V1', insurance_expiry: plus(200), insurance_company: '', insurance_number: 'P-1' };
  const e = fx.buildVehicleExpiry(v, { today: TODAY });
  assert.equal(e.insurance.status, 'valid');
  assert.equal(e.insurance.displayStatus, 'missing_details');
  assert.deepEqual(e.insurance.missingFields, ['insurance_company']);
  const full = fx.buildVehicleExpiry({ ...v, insurance_company: 'Tawuniya' }, { today: TODAY });
  assert.equal(full.insurance.displayStatus, 'valid');
  // an expiring policy keeps its expiry status even if details are missing
  const exp = fx.buildVehicleExpiry({ ...v, insurance_expiry: plus(10) }, { today: TODAY });
  assert.equal(exp.insurance.displayStatus, 'expiring_soon');
});

test('6-10 inspection mirrors the same rules and carries last-taken date', () => {
  const mk = d => fx.buildVehicleExpiry({ id: 'x', vehicle_number: 'X', periodic_inspection_expiry: d, periodic_inspection_last_date: '2025-10-01' }, { today: TODAY }).inspection;
  assert.equal(mk(plus(30)).status, 'expiring_soon');
  assert.equal(mk(plus(7)).severity, 'critical');
  assert.equal(mk(plus(-3)).status, 'expired');
  assert.equal(mk(plus(120)).status, 'valid');
  assert.equal(mk(null).status, 'missing_date');
  assert.equal(mk(plus(5)).lastTakenDate, '2025-10-01');
});

const FLEET = [
  { id: 'c1', vehicle_number: 'A-1', name: 'One', insurance_expiry: plus(25), periodic_inspection_expiry: plus(5) },   // 11 both expiring
  { id: 'c2', vehicle_number: 'A-2', name: 'Two', insurance_expiry: plus(-2), periodic_inspection_expiry: plus(400) }, // insurance expired
  { id: 'c3', vehicle_number: 'A-3', name: 'Three', insurance_expiry: plus(300), periodic_inspection_expiry: null },  // valid / missing
  { id: 'c4', vehicle_number: 'A-4', name: 'Four', insurance_expiry: null, periodic_inspection_expiry: plus(30) },    // missing / 30d
  { id: 'c5', vehicle_number: 'A-5', name: 'Five', insurance_expiry: plus(31), periodic_inspection_expiry: plus(-40) },
];

test('11 a vehicle with both expiring appears twice, most urgent first', () => {
  const alerts = fx.collectAlerts(FLEET, { today: TODAY });
  const c1 = alerts.filter(a => a.carId === 'c1');
  assert.equal(c1.length, 2);
  assert.deepEqual(alerts.map(a => a.daysRemaining), [...alerts.map(a => a.daysRemaining)].sort((a, b) => a - b));
  assert.equal(alerts[0].daysRemaining, -40); // expired first
  assert.ok(!alerts.some(a => a.carId === 'c3'), 'valid + missing vehicle produces no alert');
});

test('19 summary counts equal what the lists derive (dashboard == tables)', () => {
  const s = fx.summarizeFleet(FLEET, { today: TODAY });
  const rows = FLEET.map(v => fx.buildVehicleExpiry(v, { today: TODAY }));
  const count = (kind, status) => rows.filter(r => r[kind].status === status).length;
  assert.equal(s.insurance.expiringSoon, count('insurance', 'expiring_soon'));
  assert.equal(s.insurance.expired, count('insurance', 'expired'));
  assert.equal(s.insurance.missingDate, count('insurance', 'missing_date'));
  assert.equal(s.inspection.expiringSoon, count('inspection', 'expiring_soon'));
  assert.equal(s.inspection.expired, count('inspection', 'expired'));
  assert.equal(s.inspection.missingDate, count('inspection', 'missing_date'));
  assert.equal(s.activeAlertCount, fx.collectAlerts(FLEET, { today: TODAY }).length);
  assert.equal(Object.values(s.insurance.buckets).reduce((a, b) => a + b, 0), FLEET.length);
  assert.equal(s.insurance.expiringSoon, 1);   // only c1 (25d); c5 is 31d
  assert.equal(s.inspection.expiringSoon, 2);  // c1 (5d) + c4 (30d)
  assert.equal(s.insurance.expired, 1);
  assert.equal(s.inspection.expired, 1);
});

test('no vehicles → zeros, never NaN', () => {
  const s = fx.summarizeFleet([], { today: TODAY });
  assert.equal(s.activeAlertCount, 0);
  assert.equal(s.insurance.total, 0);
});

test('date validation: invalid dates and end-before-start are rejected', () => {
  assert.equal(fx.validateVehicleDates({}), null);
  assert.equal(fx.validateVehicleDates({ periodic_inspection_last_date: '2026-05-01', periodic_inspection_expiry: '2027-05-01' }), null);
  assert.deepEqual(fx.validateVehicleDates({ periodic_inspection_last_date: '2026-05-01', periodic_inspection_expiry: '2026-04-30' }), { field: 'periodic_inspection_expiry', code: 'inspectionRange' });
  assert.deepEqual(fx.validateVehicleDates({ insurance_start_date: '2026-05-01', insurance_expiry: '2026-01-01' }), { field: 'insurance_expiry', code: 'insuranceRange' });
  assert.deepEqual(fx.validateVehicleDates({ insurance_expiry: '2026-02-31' }), { field: 'insurance_expiry', code: 'invalidDate' });
  assert.equal(fx.validateVehicleDates({ periodic_inspection_expiry: '2027-05-01' }), null); // last-taken optional
});

test('14/15 recipient normalisation and validation', () => {
  assert.equal(normalizeEmail('  Ops@Alfarooque.COM '), 'ops@alfarooque.com');
  for (const ok of ['a@b.co', 'first.last+tag@sub.domain.com']) assert.equal(isValidEmail(ok), true, ok);
  for (const bad of ['', 'nope', 'a@b', 'a b@c.com', 'a@b..com', 'a@@b.com', 'a@b.com, c@d.com', '<x@y.com>', 'a@b.c']) assert.equal(isValidEmail(bad), false, bad);
});
