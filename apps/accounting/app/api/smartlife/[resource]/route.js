'use strict';

const { json, requireSession , requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { SmartLifeConfigurationError, readSmartLife } = require('@/lib/smartlife');
const { getDb } = require('@/lib/db');

/* Purchases and Sales Invoices are already fully synchronized into
   erp_financial_source_records by the existing canonical Sync job
   (apps/crm/app/api/integrations/[key]/sync/route.js walks every
   SmartERP resource via readAllSmartLife and upserts through
   apps/shared/financialRecords.js — already running today, already
   proven idempotent). Normal page loads read that local snapshot instead
   of live-querying SmartERP on every visit: faster, and lets Postgres do
   a real ORDER BY instead of relying on SmartERP's own list endpoint
   (which silently ignores sort_by/sort_type for at least `purchases`,
   confirmed live). raw_payload stores the exact original SmartERP record
   JSON, so the response shape below is byte-identical to a live read —
   no frontend change needed. The Refresh/Sync button (unchanged) is what
   keeps this snapshot current; this route never falls back to a live
   SmartERP call, so a temporary SmartERP outage cannot blank the page —
   it just serves the last successfully synced snapshot. */
const LOCAL_FIRST_RECORD_TYPES = Object.freeze({ purchases: 'purchase_invoice', 'sales-invoices': 'sales_invoice' });

async function readLocalFirst(req, recordType) {
  const sb = getDb();
  const params = new URL(req.url).searchParams;
  const offset = Math.max(0, parseInt(params.get('offset'), 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(params.get('limit'), 10) || 100));
  const search = (params.get('search') || '').trim().replace(/[%,()]/g, '');
  let query = sb.from('erp_financial_source_records')
    .select('raw_payload', { count: 'exact' })
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', recordType);
  if (search) query = query.or(`source_reference.ilike.%${search}%,party_name.ilike.%${search}%`);
  /* Ordered by the real record timestamp stored inside raw_payload (full
     "YYYY-MM-DD HH:MM:SS" precision — the record_date COLUMN only keeps the
     date part and is populated via a UTC-converting helper, so it can't be
     trusted for same-day ordering). Lexical descending sort on this
     zero-padded ISO-like text is equivalent to a true chronological sort. */
  const { data, count, error } = await query
    .order('raw_payload->>date', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return json({
    source: 'SmartERP (local synchronized snapshot)', connected: true,
    records: (data || []).map(row => row.raw_payload),
    total: count || 0, page: Math.floor(offset / limit) + 1, offset, limit,
  });
}

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const localRecordType = LOCAL_FIRST_RECORD_TYPES[params.resource];
  if (localRecordType) {
    try { return await readLocalFirst(req, localRecordType); }
    catch (error) {
      console.error('[smartlife] local-first read failed, falling back to live SmartERP:', error && error.message);
      /* Falls through to the existing live path below — never a hard
         failure just because the local snapshot table had a transient
         issue; SmartERP itself is still the ultimate source of truth. */
    }
  }
  try {
    const cookies = parseCookies(req.headers.get('cookie'));
    const query = Object.fromEntries(new URL(req.url).searchParams.entries());
    /* Forward whichever credential the browser actually holds. requireSession
       above already accepted this request via either the app cookie or the
       parent-domain SSO cookie, so passing only the app cookie would drop a
       valid SSO-authenticated session. */
    const result = await readSmartLife(params.resource, {
      appToken: cookies[COOKIE_NAME],
      ssoToken: cookies[SSO_COOKIE_NAME],
    }, query);
    return json({
      source: 'SmartERP', connected: true, records: result.records,
      total: result.total, page: result.page, offset: result.offset, limit: result.limit,
    });
  } catch (error) {
    if (error instanceof SmartLifeConfigurationError) {
      return json({ source: 'SmartERP', connected: false, error: error.message }, 503);
    }
    if (error?.permissionRequired) {
      return json({ source: 'SmartERP', connected: false, permission_required: true, error: error.message, ...snapshotFields(error.centralPayload) }, 403);
    }
    if (error?.endpointUnavailable) {
      return json({ source: 'SmartERP', connected: false, endpoint_unavailable: true, error: error.message, ...snapshotFields(error.centralPayload) }, 404);
    }
    if (error?.connectionError) {
      console.error('[smartlife] network failure:', error.message);
      return json({ source: 'SmartERP', connected: false, connection_error: true, error: 'Could not reach SmartERP.', ...snapshotFields(error.centralPayload) }, 502);
    }
    console.error('[smartlife] read failed:', error && error.message);
    return json({ source: 'SmartERP', connected: false, error: error?.message || 'SmartERP connection unavailable.' }, 502);
  }
}

function snapshotFields(payload = {}) {
  return {
    source: payload.source || 'SmartERP', records: Array.isArray(payload.records) ? payload.records : [],
    total: Number(payload.total) || 0, offset: Number(payload.offset) || 0,
    limit: Number(payload.limit) || 0, snapshot_available: payload.snapshot_available === true,
    last_synced_at: payload.last_synced_at || null,
  };
}
