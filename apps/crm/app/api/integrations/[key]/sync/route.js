'use strict';

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { SMARTLIFE_RESOURCES, getIntegration, readAllSmartLife, auditIntegration } = require('../../../../../../shared/integrationPlatform');
const { upsertSmartErpFinancialRecords } = require('../../../../../../shared/financialRecords');

export async function POST(req, { params }) {
  const { response, session } = requireSession(req, { roles: ['admin','manager'] });
  if (response) return response;
  const sb = getDb();
  const integration = await getIntegration(sb, params.key);
  if (!integration) return json({ error: 'Integration not found.' }, 404);
  const { data: run, error } = await sb.from('crm_sync_runs').insert({ integration_id: integration.id, trigger_type: 'manual', direction: integration.sync_direction, status: 'running', started_at: new Date().toISOString(), requested_by: session.sub }).select().single();
  if (error) return json({ error: 'Could not start synchronization.' }, 500);
  try {
    let total = 0;
    if (params.key === 'smartlife') {
      for (const resource of Object.keys(SMARTLIFE_RESOURCES)) {
        const result = await readAllSmartLife(sb, resource);
        total += result.records.length;
        await upsertSmartErpFinancialRecords(sb, resource, result.records);
        const rows = result.records.map((record, index) => {
          const externalId = record?.id ?? record?.invoice_id ?? record?.payment_id ?? record?.number ?? record?.reference ?? null;
          const fingerprint = externalId == null ? crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex') : String(externalId);
          return { sync_run_id: run.id, entity_type: resource, external_id: externalId == null ? null : String(externalId), idempotency_key: crypto.createHash('sha256').update(`${run.id}:${resource}:${fingerprint}:${index}`).digest('hex'), status: 'success', processed_at: new Date().toISOString() };
        });
        for (let offset = 0; offset < rows.length; offset += 500) {
          const { error: recordError } = await sb.from('crm_sync_records').insert(rows.slice(offset, offset + 500));
          if (recordError) throw recordError;
        }
      }
    }
    const completedAt = new Date().toISOString();
    await sb.from('crm_sync_runs').update({ status: 'success', records_total: total, records_succeeded: total, completed_at: completedAt }).eq('id', run.id);
    await sb.from('crm_integrations').update({ status: 'connected', last_sync_at: completedAt, last_error: null }).eq('id', integration.id);
    await auditIntegration(sb, integration.id, session.sub, 'integration.sync_completed', { syncRunId: run.id, records: total });
    return json({ syncRunId: run.id, status: 'success', records: total });
  } catch (syncError) {
    const message = syncError?.message || 'Synchronization failed.';
    await sb.from('crm_sync_runs').update({ status: 'failed', error_summary: message, completed_at: new Date().toISOString() }).eq('id', run.id);
    await sb.from('crm_integrations').update({ status: 'error', last_error: message }).eq('id', integration.id);
    await auditIntegration(sb, integration.id, session.sub, 'integration.sync_failed', { syncRunId: run.id, error: message });
    return json({ syncRunId: run.id, status: 'failed', error: message }, 502);
  }
}
