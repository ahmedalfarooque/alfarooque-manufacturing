'use strict';

/* ═══════════════════════════════════════════════════════════════════
   Server-only Supabase client using the SERVICE ROLE key.
   NEVER import this from client-side code — it bypasses Row-Level
   Security entirely. Only used inside /api/admin/* serverless handlers,
   after the caller's admin session has already been verified.

   (Files in /api whose name starts with "_" are NOT routed by Vercel,
    so this module is import-only — same convention as api/_email.js.)
   ═══════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');

let _client = null;

/* supabase-js v2's client always constructs a RealtimeClient, which
   requires a native WebSocket global on Node < 22 (Vercel's runtime here
   is Node 24, so production is unaffected — this only matters for local
   `node server.js` dev on older Node). This admin client never actually
   uses realtime (plain CRUD + auth.admin calls only), so we just hand it
   a WebSocket implementation to satisfy the constructor check. */
function getWebSocketImpl() {
  if (typeof WebSocket !== 'undefined') return undefined; // native — let it use that
  try { return require('ws'); } catch (_) { return undefined; }
}

function getAdminClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const err = new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured on the server.');
    err.code = 'NO_CONFIG';
    throw err;
  }
  const ws = getWebSocketImpl();
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: ws ? { transport: ws } : undefined,
  });
  return _client;
}

module.exports = { getAdminClient };
