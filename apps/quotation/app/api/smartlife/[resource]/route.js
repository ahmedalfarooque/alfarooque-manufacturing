'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { QUOTEPRO_SMARTLIFE_RESOURCES, normalizeSmartLifeMaster } = require('@/lib/smartlifeMasterData');
const {
  IntegrationConfigurationError, readSmartLife, readSmartErpSnapshot,
  upsertSmartErpSourceMappings, classifySmartErpError,
} = require('../../../../../shared/integrationPlatform');

async function localIdsBySource(sb, resource, records) {
  const ids = records.map(row => row?.source_record_id).filter(Boolean);
  if (!ids.length) return new Map();
  const { data, error } = await sb.from('crm_record_mappings').select('source_record_id,local_record_id')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('entity_type', resource).in('source_record_id', ids);
  if (error) throw error;
  return new Map((data || []).map(row => [String(row.source_record_id), row.local_record_id || null]));
}

async function responseRecords(sb, resource, records) {
  const normalized = (records || []).map(row => normalizeSmartLifeMaster(resource, row)).filter(Boolean);
  const localIds = await localIdsBySource(sb, resource, normalized);
  return normalized.map(row => ({ ...row, local_record_id: localIds.get(row.source_record_id) || null }));
}

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  if (!QUOTEPRO_SMARTLIFE_RESOURCES.includes(params.resource)) {
    return json({ source: 'SmartERP', connected: false, error: 'Unsupported SmartERP read-only master-data resource.' }, 404);
  }
  const sb = getDb();
  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  try {
    const result = await readSmartLife(sb, params.resource, query);
    await upsertSmartErpSourceMappings(sb, params.resource, result.records);
    const records = await responseRecords(sb, params.resource, result.records);
    const provider = result.providerPayload || {};
    return json({
      source: 'LIVE', connected: true, read_only: true, resource: params.resource, records,
      total: Number(provider.total) || records.length, offset: Number(provider.offset) || Number(query.offset) || 0,
      limit: Number(provider.limit) || Number(query.limit) || records.length,
    });
  } catch (error) {
    if (error instanceof IntegrationConfigurationError) return json({ source: 'LOCAL', connected: false, error: error.message, records: [] }, 503);
    const classification = classifySmartErpError(error);
    let snapshot = { records: [], total: 0, offset: 0, limit: 0, lastSyncedAt: null };
    try { snapshot = await readSmartErpSnapshot(sb, params.resource, query); }
    catch (snapshotError) { console.error('[quotation-smartlife] snapshot lookup failed:', snapshotError.message); }
    const records = await responseRecords(sb, params.resource, snapshot.records);
    const base = {
      source: records.length ? 'SNAPSHOT' : 'PERMISSION REQUIRED', connected: false, read_only: true,
      resource: params.resource, records, total: snapshot.total, offset: snapshot.offset, limit: snapshot.limit,
      snapshot_available: records.length > 0, last_synced_at: snapshot.lastSyncedAt,
    };
    if (classification === 'permission_required') return json({ ...base, permission_required: true, error: error.message }, 403);
    if (classification === 'endpoint_or_version_mismatch') return json({ ...base, endpoint_unavailable: true, error: 'SmartERP returned an unexpected response for this verified endpoint.' }, 404);
    if (classification === 'connection_error') return json({ ...base, connection_error: true, error: 'Could not reach SmartERP.' }, 502);
    return json({ ...base, error: error?.message || 'SmartERP connection unavailable.' }, 502);
  }
}
