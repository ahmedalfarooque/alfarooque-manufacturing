'use strict';

/* Single source of truth for vehicle document expiry (Insurance and
   Periodic Vehicle Inspection). Every surface — dashboard, Insurance page,
   Inspection page, Alerts page, vehicle detail, the daily email job — gets
   its numbers from here, computed server-side, so they can never disagree.

   Rules (per the fleet brief):
   - "Today" is the calendar date in the company timezone (default
     Asia/Riyadh, override with FLEET_TIMEZONE), never a hardcoded date.
   - Dates are date-only (YYYY-MM-DD); day math is done in UTC on the
     parsed parts so DST / local-clock offsets cannot shift a result.
   - 0-30 days ahead (today included) = "within 30 days".
   - Severity: 0-7 critical, 8-15 urgent, 16-30 warning, 31+ normal,
     past date = expired.
   - A missing date is "missing_date" — never treated as expired and never
     converted to a made-up date. */

const WITHIN_DAYS = 30;
const DEFAULT_TIMEZONE = 'Asia/Riyadh';

const ALERT_TYPES = { INSURANCE: 'insurance', INSPECTION: 'inspection' };
const STATUS = { VALID: 'valid', EXPIRING_SOON: 'expiring_soon', EXPIRED: 'expired', MISSING_DATE: 'missing_date', MISSING_DETAILS: 'missing_details' };
const SEVERITY = { NONE: 'none', NORMAL: 'normal', WARNING: 'warning', URGENT: 'urgent', CRITICAL: 'critical', EXPIRED: 'expired' };
/* Higher = more urgent. Used for sorting and "worst severity" rollups. */
const SEVERITY_RANK = { none: 0, normal: 1, warning: 2, urgent: 3, critical: 4, expired: 5 };

function zone() {
  return (typeof process !== 'undefined' && process.env && process.env.FLEET_TIMEZONE) || DEFAULT_TIMEZONE;
}

/* YYYY-MM-DD for `now` in the company timezone. */
function todayInZone(now, tz) {
  const d = now instanceof Date ? now : new Date(now || Date.now());
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz || zone(), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/* Strict date-only parser. Accepts YYYY-MM-DD (optionally followed by a
   time part, as Postgres timestamps serialise) and rejects impossible
   calendar dates such as 2026-02-31. Returns UTC ms or null. */
function parseDateOnly(value) {
  if (value == null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(String(value).trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

function normalizeDate(value) {
  const ms = parseDateOnly(value);
  return ms == null ? null : new Date(ms).toISOString().slice(0, 10);
}

function daysBetween(fromDate, toDate) {
  const a = parseDateOnly(fromDate), b = parseDateOnly(toDate);
  if (a == null || b == null) return null;
  return Math.round((b - a) / 86400000);
}

function severityFor(days) {
  if (days == null) return SEVERITY.NONE;
  if (days < 0) return SEVERITY.EXPIRED;
  if (days <= 7) return SEVERITY.CRITICAL;
  if (days <= 15) return SEVERITY.URGENT;
  if (days <= WITHIN_DAYS) return SEVERITY.WARNING;
  return SEVERITY.NORMAL;
}

/* Core calculation for one expiry date.
   `isActive` = the alert condition: the date is set and is 30 days away or
   closer, including already-expired. The email job keeps sending while a
   record stays active and stops only once the date is renewed/changed. */
function computeExpiry(expiryDate, { type, today, now, tz } = {}) {
  const todayStr = today || todayInZone(now, tz);
  const date = normalizeDate(expiryDate);
  if (!date) {
    return {
      alertType: type || null, expiryDate: null, hasDate: false, daysRemaining: null,
      status: STATUS.MISSING_DATE, severity: SEVERITY.NONE,
      isExpired: false, isWithin30Days: false, isActive: false,
    };
  }
  const days = daysBetween(todayStr, date);
  const isExpired = days < 0;
  const isWithin30Days = days >= 0 && days <= WITHIN_DAYS;
  return {
    alertType: type || null, expiryDate: date, hasDate: true, daysRemaining: days,
    status: isExpired ? STATUS.EXPIRED : (isWithin30Days ? STATUS.EXPIRING_SOON : STATUS.VALID),
    severity: severityFor(days),
    isExpired, isWithin30Days, isActive: isExpired || isWithin30Days,
  };
}

function blank(v) { return v == null || String(v).trim() === ''; }

/* Full expiry picture for one vehicle row (as stored in `cars`). */
function buildVehicleExpiry(vehicle, ctx) {
  const c = ctx || {};
  const today = c.today || todayInZone(c.now, c.tz);
  const insurance = computeExpiry(vehicle.insurance_expiry, { type: ALERT_TYPES.INSURANCE, today });
  const missingFields = [];
  if (blank(vehicle.insurance_company)) missingFields.push('insurance_company');
  if (blank(vehicle.insurance_number)) missingFields.push('insurance_number');
  insurance.company = blank(vehicle.insurance_company) ? null : vehicle.insurance_company;
  insurance.policyNumber = blank(vehicle.insurance_number) ? null : vehicle.insurance_number;
  insurance.startDate = normalizeDate(vehicle.insurance_start_date);
  insurance.missingFields = missingFields;
  insurance.detailsMissing = missingFields.length > 0;
  /* What the Status column shows: a policy whose date is fine but whose
     company/number were never entered is surfaced as "missing details". */
  insurance.displayStatus = insurance.status === STATUS.VALID && insurance.detailsMissing ? STATUS.MISSING_DETAILS : insurance.status;

  const inspection = computeExpiry(vehicle.periodic_inspection_expiry, { type: ALERT_TYPES.INSPECTION, today });
  inspection.lastTakenDate = normalizeDate(vehicle.periodic_inspection_last_date);
  inspection.displayStatus = inspection.status;

  return { today, insurance, inspection };
}

/* Row shape shared by the Insurance / Inspection list APIs and pages. */
function vehicleSummary(vehicle) {
  return {
    id: vehicle.id, vehicleNumber: vehicle.vehicle_number, vehicleName: vehicle.name || null,
    vehicleStatus: vehicle.status || null,
  };
}

/* One entry per ACTIVE alert (insurance and/or inspection) across the
   fleet. A vehicle with both expiring appears twice. Most urgent first
   (smallest daysRemaining; expired are the most negative). */
function collectAlerts(vehicles, ctx) {
  const c = ctx || {};
  const today = c.today || todayInZone(c.now, c.tz);
  const out = [];
  for (const v of vehicles || []) {
    const e = buildVehicleExpiry(v, { today });
    for (const rec of [e.insurance, e.inspection]) {
      if (!rec.isActive) continue;
      out.push({
        key: `${v.id}:${rec.alertType}:${rec.expiryDate}`,
        carId: v.id, vehicleNumber: v.vehicle_number, vehicleName: v.name || null, vehicleStatus: v.status || null,
        alertType: rec.alertType, expiryDate: rec.expiryDate, daysRemaining: rec.daysRemaining,
        status: rec.status, severity: rec.severity, isExpired: rec.isExpired, isWithin30Days: rec.isWithin30Days,
      });
    }
  }
  out.sort((a, b) => a.daysRemaining - b.daysRemaining || String(a.vehicleNumber).localeCompare(String(b.vehicleNumber)));
  return out;
}

const BUCKETS = ['expired', 'd0_7', 'd8_15', 'd16_30', 'd31_90', 'd91_plus', 'missing'];
function bucketFor(rec) {
  if (!rec.hasDate) return 'missing';
  const d = rec.daysRemaining;
  if (d < 0) return 'expired';
  if (d <= 7) return 'd0_7';
  if (d <= 15) return 'd8_15';
  if (d <= 30) return 'd16_30';
  if (d <= 90) return 'd31_90';
  return 'd91_plus';
}

/* Fleet-level counts + distributions for the dashboard / alerts header.
   Everything derives from the same per-vehicle records as the lists. */
function summarizeFleet(vehicles, ctx) {
  const c = ctx || {};
  const today = c.today || todayInZone(c.now, c.tz);
  const mk = () => ({ total: 0, valid: 0, expiringSoon: 0, expired: 0, missingDate: 0, missingDetails: 0, buckets: Object.fromEntries(BUCKETS.map(b => [b, 0])), severity: { critical: 0, urgent: 0, warning: 0, normal: 0, expired: 0 } });
  const ins = mk(), insp = mk();
  for (const v of vehicles || []) {
    const e = buildVehicleExpiry(v, { today });
    for (const [rec, agg] of [[e.insurance, ins], [e.inspection, insp]]) {
      agg.total++;
      if (rec.status === STATUS.VALID) agg.valid++;
      else if (rec.status === STATUS.EXPIRING_SOON) agg.expiringSoon++;
      else if (rec.status === STATUS.EXPIRED) agg.expired++;
      else agg.missingDate++;
      agg.buckets[bucketFor(rec)]++;
      if (rec.isActive) agg.severity[rec.severity]++;
    }
    if (e.insurance.detailsMissing) ins.missingDetails++;
  }
  const alerts = collectAlerts(vehicles, { today });
  const severity = { critical: 0, urgent: 0, warning: 0, normal: 0, expired: 0 };
  for (const a of alerts) severity[a.severity]++;
  return { today, withinDays: WITHIN_DAYS, insurance: ins, inspection: insp, activeAlertCount: alerts.length, severity };
}

/* Form/server validation for the date pairs on the vehicle form. Returns
   an i18n key suffix (resolved by the caller) or null when valid. */
function validateVehicleDates(v) {
  const checks = [
    ['insurance_start_date', 'insurance_expiry', 'insuranceRange'],
    ['periodic_inspection_last_date', 'periodic_inspection_expiry', 'inspectionRange'],
  ];
  const fields = ['insurance_start_date', 'insurance_expiry', 'registration_expiry', 'periodic_inspection_last_date', 'periodic_inspection_expiry'];
  for (const f of fields) {
    if (!blank(v[f]) && parseDateOnly(v[f]) == null) return { field: f, code: 'invalidDate' };
  }
  for (const [from, to, code] of checks) {
    if (blank(v[from]) || blank(v[to])) continue;
    if (parseDateOnly(v[to]) < parseDateOnly(v[from])) return { field: to, code };
  }
  return null;
}

module.exports = {
  WITHIN_DAYS, DEFAULT_TIMEZONE, ALERT_TYPES, STATUS, SEVERITY, SEVERITY_RANK, BUCKETS,
  todayInZone, parseDateOnly, normalizeDate, daysBetween, severityFor,
  computeExpiry, buildVehicleExpiry, vehicleSummary, collectAlerts, summarizeFleet, validateVehicleDates,
};
