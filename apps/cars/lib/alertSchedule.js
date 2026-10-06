'use strict';

/* The daily job schedule, derived from vercel.json so the settings page
   can never drift from what Vercel Cron actually runs. */

const { DEFAULT_TIMEZONE } = require('./fleetExpiry');

const CRON = '0 4 * * *';   // keep in sync with vercel.json "crons"
const UTC_HOUR = 4;

function nextRunAt(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), UTC_HOUR, 0, 0));
  if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function describe() {
  const tz = process.env.FLEET_TIMEZONE || DEFAULT_TIMEZONE;
  const local = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(Date.UTC(2026, 0, 1, UTC_HOUR)));
  return { cron: CRON, timezone: tz, localTime: local, nextRunAt: nextRunAt(), cronSecretConfigured: !!process.env.CRON_SECRET };
}

module.exports = { CRON, nextRunAt, describe };
