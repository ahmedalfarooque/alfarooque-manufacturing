'use strict';

/* Server-only Supabase client using the SERVICE ROLE key — same pattern
   as the main site's api/_supabaseAdmin.js. Never import from client
   components. This app only ever touches its own isolated tables
   (cars, car_maintenance, car_maintenance_log, car_alerts, car_trips,
   platform_users/otp_codes/sessions) — see supabase/apps-schema.sql. */

/* Node <22 has no global WebSocket; @supabase/supabase-js's realtime
   client throws at construction time without one, even though this app
   never uses realtime subscriptions. Polyfill with `ws`. */
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');

const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getDb() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const err = new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured.');
    err.code = 'NO_CONFIG';
    throw err;
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

module.exports = { getDb };
