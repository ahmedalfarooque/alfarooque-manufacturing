'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const {
  IntegrationConfigurationError,
  readSmartLife,
  readSmartLifeDetail,
  readAccountBalances,
  readProductBalances,
  readInventoryMovements,
  readSmartErpSnapshot,
  classifySmartErpError,
} = require('../../../../../../../shared/integrationPlatform');

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  try {
    const query = Object.fromEntries(new URL(req.url).searchParams.entries());
    /* account-balances is a verified V3 miscellaneous read endpoint rather
       than a list resource. It still flows through this one central CRM
       route and the canonical connector; Accounting never calls SmartERP
       directly.
       detail_id: fetches a single record's full detail (e.g. a purchase
       invoice's line items) via SMARTLIFE_DETAIL_RESOURCES instead of the
       list endpoint — same central connector, additive query param, no
       second route/connector created. */
    if (query.detail_id) {
      const { detail_id, ...rest } = query;
      const result = await readSmartLifeDetail(getDb(), params.resource, detail_id, rest);
      return json({ source: 'SmartERP', connected: true, resource: params.resource, record: result.record });
    }
    const result = params.resource === 'account-balances'
      ? await readAccountBalances(getDb(), query)
      : params.resource === 'product-balances'
      ? await readProductBalances(getDb(), query)
      : params.resource === 'inventory-movements'
      ? await readInventoryMovements(getDb(), query)
      : await readSmartLife(getDb(), params.resource, query);
    const provider = result.providerPayload || {};
    return json({
      source: 'SmartERP', connected: true, resource: params.resource, records: result.records,
      /* SmartERP reports the full matching count separately from the returned
         page, so the UI can show "showing N of TOTAL" instead of implying the
         page is everything. */
      total: Number(provider.total) || result.records.length,
      page: Number(provider.page) || 0,
      offset: Number(provider.offset) || Number(query.offset) || 0,
      limit: Number(provider.limit) || 0,
    });
  } catch (error) {
    if (error instanceof IntegrationConfigurationError) return json({ connected: false, error: error.message }, 503);
    /* SmartERP's own per-module permission-denied message (and every other
       distinguishable failure mode) must reach the UI verbatim — collapsing
       everything into a generic "connection unavailable" hides a real,
       actionable state (see [key]/sync's identical classifier). */
    const message = error?.message || 'Unknown error';
    const classification = classifySmartErpError(error);
    let snapshot = { records: [], total: 0, offset: 0, limit: 0, lastSyncedAt: null };
    if (['permission_required','endpoint_or_version_mismatch','connection_error'].includes(classification)) {
      try {
        const query = Object.fromEntries(new URL(req.url).searchParams.entries());
        snapshot = await readSmartErpSnapshot(getDb(), params.resource, query);
      } catch (snapshotError) {
        console.error('[smarterp-central] snapshot lookup failed:', snapshotError.message);
      }
    }
    const snapshotPayload = {
      source: snapshot.records.length ? 'synchronized_snapshot' : 'SmartERP',
      records: snapshot.records, total: snapshot.total, offset: snapshot.offset,
      limit: snapshot.limit, snapshot_available: snapshot.records.length > 0,
      last_synced_at: snapshot.lastSyncedAt,
    };
    if (classification === 'permission_required') {
      return json({ connected: false, permission_required: true, resource: params.resource, error: message, ...snapshotPayload }, 403);
    }
    if (classification === 'endpoint_or_version_mismatch') {
      return json({ connected: false, endpoint_unavailable: true, resource: params.resource, error: 'SmartERP returned an unexpected (non-JSON) response for this endpoint.', ...snapshotPayload }, 404);
    }
    if (classification === 'connection_error') {
      console.error('[smarterp-central] network failure:', message);
      return json({ connected: false, connection_error: true, resource: params.resource, error: 'Could not reach SmartERP.', ...snapshotPayload }, 502);
    }
    console.error('[smarterp-central] read failed:', message);
    return json({ connected: false, resource: params.resource, error: message }, 502);
  }
}
