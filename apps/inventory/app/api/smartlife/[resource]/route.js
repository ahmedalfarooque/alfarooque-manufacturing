'use strict';

const { json, requireSession , requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { SmartLifeConfigurationError, readSmartLife } = require('@/lib/smartlife');
const { getDb } = require('@/lib/db');

/* crm_record_mappings already holds every SmartLife SMARTLIFE_RESOURCES
   entry (categories/units/brands/warehouses/tax/suppliers/customers/etc,
   same canonical sync job as Products/Purchases/Sales Invoices/Account
   Balances) — reusing it here the same way Inventory's own Products route
   does, so a normal page load for any Inventory SmartLife-backed list
   never full-fetches SmartERP live. Falls back to a live read if the local
   snapshot genuinely has no rows yet (never synced) or the local query
   itself fails. */
async function readLocalFirst(resource, query) {
  const sb = getDb();
  const offset = Math.max(0, parseInt(query.offset, 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit, 10) || 100));
  const search = String(query.search || '').trim().replace(/[%,()]/g, '');
  let q = sb.from('crm_record_mappings').select('metadata', { count: 'exact' })
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('entity_type', resource);
  if (search) q = q.or(`metadata->>source_name.ilike.%${search}%,metadata->>source_reference.ilike.%${search}%`);
  const { data, count, error } = await q.order('metadata->>source_name', { ascending: true }).range(offset, offset + limit - 1);
  if (error) throw error;
  if (!count) return null;
  return {
    source: 'SmartERP (local synchronized snapshot)', connected: true,
    records: (data || []).map(row => row.metadata?.raw_payload).filter(Boolean),
    total: count, page: Math.floor(offset / limit) + 1, offset, limit,
  };
}

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const localQuery = Object.fromEntries(new URL(req.url).searchParams.entries());
  const local = await readLocalFirst(params.resource, localQuery).catch(() => null);
  if (local) return json(local);
  try {
    const cookies = parseCookies(req.headers.get('cookie'));
    const query = Object.fromEntries(new URL(req.url).searchParams.entries());
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
