'use strict';

/* One-time backfill: recalculate every existing qt_labour_roles row's
   daily_rate and hourly_rate from its monthly_rate (the master value),
   using the company standard of 30 days/month and 8 hours/day:

     daily_rate  = monthly_rate / 30        (2 decimals)
     hourly_rate = monthly_rate / 30 / 8    (2 decimals)

   Rows with no monthly_rate (null / 0 / negative) are left untouched.
   Prints a before → after line per row. Safe to re-run (idempotent).

   Run from apps/quotation:  node scripts/recalc-labour-rates.js
   Add --dry-run to preview without writing. */

const fs = require('fs');
const path = require('path');

(function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch (_) {}
})();

if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DRY_RUN = process.argv.includes('--dry-run');
const round2 = n => Math.round(n * 100) / 100;

(async () => {
  const { data: rows, error } = await sb.from('qt_labour_roles')
    .select('id, name, monthly_rate, daily_rate, hourly_rate');
  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

  let updated = 0, skipped = 0;
  for (const r of rows || []) {
    const m = Number(r.monthly_rate);
    if (!isFinite(m) || m <= 0) { skipped++; continue; }
    const daily = round2(m / 30);
    const hourly = round2(m / 30 / 8);
    if (Number(r.daily_rate) === daily && Number(r.hourly_rate) === hourly) { skipped++; continue; }

    console.log(
      `${r.name}: monthly ${m} | daily ${r.daily_rate} → ${daily} | hourly ${r.hourly_rate} → ${hourly}` +
      (DRY_RUN ? '  [dry-run]' : '')
    );
    if (!DRY_RUN) {
      const { error: upErr } = await sb.from('qt_labour_roles')
        .update({ daily_rate: daily, hourly_rate: hourly })
        .eq('id', r.id);
      if (upErr) { console.error(`  FAILED for ${r.name}:`, upErr.message); process.exit(1); }
    }
    updated++;
  }
  console.log(`\nDone. ${updated} row(s) ${DRY_RUN ? 'would be ' : ''}updated, ${skipped} already correct or no monthly salary.`);
  process.exit(0);
})();
