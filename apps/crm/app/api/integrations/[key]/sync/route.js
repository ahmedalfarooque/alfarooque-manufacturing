'use strict';

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { SMARTLIFE_RESOURCES, getIntegration, readAllSmartLife, upsertSmartErpSourceMappings, auditIntegration, classifySmartErpError } = require('../../../../../../shared/integrationPlatform');
const { upsertSmartErpFinancialRecords } = require('../../../../../../shared/financialRecords');

async function upsertModuleStatus(sb, integrationId, moduleKey, patch) {
  await sb.from('crm_integration_module_status').upsert({
    tenant_id: 'alfarooque', integration_id: integrationId, module_key: moduleKey,
    last_attempted_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...patch,
  }, { onConflict: 'tenant_id,integration_id,module_key' });
}

export async function POST(req, { params }) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();
  const integration = await getIntegration(sb, params.key);
  if (!integration) return json({ error: 'Integration not found.' }, 404);
  const { data: run, error } = await sb.from('crm_sync_runs').insert({ integration_id: integration.id, trigger_type: 'manual', direction: integration.sync_direction, status: 'running', started_at: new Date().toISOString(), requested_by: session.sub }).select().single();
  if (error) return json({ error: 'Could not start synchronization.' }, 500);
  try {
    let total = 0;
    const moduleErrors = [];
    let anyModuleConnected = false;
    if (params.key === 'smartlife') {
      /* Each resource is synchronized independently — a module the account has
         no permission for (or one that fails outright) must never abort the
         resources that DO work. */
      for (const resource of Object.keys(SMARTLIFE_RESOURCES)) {
        try {
          const result = await readAllSmartLife(sb, resource);
          total += result.records.length;
          await upsertSmartErpFinancialRecords(sb, resource, result.records);
          /* The existing mapping table is the cross-app source identity store.
             Persist the current read-only payload there so Accounting, CRM,
             Inventory, Projects and QuotePro can all resolve the same stable
             SmartERP record without creating parallel customer/product tables. */
          await upsertSmartErpSourceMappings(sb, resource, result.records);
          const rows = result.records.map((record, index) => {
            const externalId = record?.id ?? record?.invoice_id ?? record?.payment_id ?? record?.number ?? record?.reference ?? null;
            const fingerprint = externalId == null ? crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex') : String(externalId);
            return { sync_run_id: run.id, entity_type: resource, external_id: externalId == null ? null : String(externalId), idempotency_key: crypto.createHash('sha256').update(`${run.id}:${resource}:${fingerprint}:${index}`).digest('hex'), status: 'success', processed_at: new Date().toISOString() };
          });
          for (let offset = 0; offset < rows.length; offset += 500) {
            const { error: recordError } = await sb.from('crm_sync_records').insert(rows.slice(offset, offset + 500));
            if (recordError) throw recordError;
          }
          anyModuleConnected = true;
          await upsertModuleStatus(sb, integration.id, resource, {
            status: 'connected', records_read: result.records.length, records_inserted: result.records.length,
            last_synced_at: new Date().toISOString(), last_error: null,
          });
        } catch (moduleError) {
          const message = moduleError?.message || 'Synchronization failed.';
          /* Fine-grained classification (permission_required / endpoint_or_version_mismatch /
             connection_error / other_error) travels in the response and audit log; the
             module_status table's `status` column only distinguishes connected/permission_required/
             error, so anything else is stored as 'error' with the real classification prefixed
             onto last_error rather than widening the schema for a distinction only the live
             classifier needs moment-to-moment. */
          const classification = classifySmartErpError(moduleError);
          const dbStatus = classification === 'permission_required' ? 'permission_required' : 'error';
          moduleErrors.push({ resource, status: classification, message });
          await upsertModuleStatus(sb, integration.id, resource, { status: dbStatus, last_error: classification === 'other_error' ? message : `[${classification}] ${message}` });
        }
      }
    }
    const completedAt = new Date().toISOString();
    const hardFailures = moduleErrors.filter(m => m.status !== 'permission_required');
    const runStatus = hardFailures.length && !anyModuleConnected ? 'failed' : (moduleErrors.length ? 'partial' : 'success');
    await sb.from('crm_sync_runs').update({
      status: runStatus, records_total: total, records_succeeded: total, records_failed: moduleErrors.length,
      error_summary: moduleErrors.length ? moduleErrors.map(m => `${m.resource}: ${m.status}`).join('; ') : null,
      completed_at: completedAt,
    }).eq('id', run.id);
    await sb.from('crm_integrations').update({
      status: anyModuleConnected ? 'connected' : (hardFailures.length ? 'error' : 'warning'),
      last_sync_at: completedAt,
      last_error: moduleErrors.length ? `${moduleErrors.length} module(s) need attention: ${moduleErrors.map(m => m.resource).join(', ')}` : null,
    }).eq('id', integration.id);
    await auditIntegration(sb, integration.id, session.sub, 'integration.sync_completed', { syncRunId: run.id, records: total, moduleErrors });
    return json({ syncRunId: run.id, status: runStatus, records: total, moduleErrors });
  } catch (syncError) {
    const message = syncError?.message || 'Synchronization failed.';
    await sb.from('crm_sync_runs').update({ status: 'failed', error_summary: message, completed_at: new Date().toISOString() }).eq('id', run.id);
    await sb.from('crm_integrations').update({ status: 'error', last_error: message }).eq('id', integration.id);
    await auditIntegration(sb, integration.id, session.sub, 'integration.sync_failed', { syncRunId: run.id, error: message });
    return json({ syncRunId: run.id, status: 'failed', error: message }, 502);
  }
}
