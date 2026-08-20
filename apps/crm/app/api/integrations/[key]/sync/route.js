'use strict';

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { SMARTLIFE_RESOURCES, getIntegration, readAllSmartLife, readAccountBalances, totalFrom, upsertSmartErpSourceMappings, auditIntegration, classifySmartErpError } = require('../../../../../../shared/integrationPlatform');
const { upsertSmartErpFinancialRecords } = require('../../../../../../shared/financialRecords');
const { upsertSmartErpAccountBalances } = require('../../../../../../shared/accountBalanceSnapshot');
const { recordDailySnapshot } = require('../../../../../../shared/accountBalanceHistory');
const { syncJournalEntries } = require('../../../../../../shared/journalEntries');

/* account-balances is a SMARTLIFE_MISC_READ endpoint, not one of the
   generic list resources in SMARTLIFE_RESOURCES, so readAllSmartLife
   (which only knows that map) can't walk it directly — this mirrors its
   own page-walking logic (short-page-or-reported-total stop condition)
   for this one endpoint using the existing readAccountBalances/totalFrom
   helpers. Not a second connector: same auth, same rate limits, same
   underlying readSmartLifePath() call. */
async function readAllAccountBalances(sb, { maxPages = 100 } = {}) {
  const limit = 100;
  let offset = 0; let total = null; const records = []; const seen = new Set();
  for (let page = 0; page < maxPages; page += 1) {
    const result = await readAccountBalances(sb, { offset: String(offset), limit: String(limit) });
    const batch = result.records || [];
    const reported = totalFrom(result.providerPayload);
    if (reported !== null && reported > 0) total = reported;
    for (const record of batch) {
      const key = String(record?.id ?? '');
      if (!key || seen.has(key)) continue;
      seen.add(key); records.push(record);
    }
    if (!batch.length || batch.length < limit) break;
    if (total !== null && records.length >= total) break;
    offset += limit;
  }
  return { records, total: total ?? records.length };
}

async function upsertModuleStatus(sb, integrationId, moduleKey, patch) {
  await sb.from('crm_integration_module_status').upsert({
    tenant_id: 'alfarooque', integration_id: integrationId, module_key: moduleKey,
    last_attempted_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...patch,
  }, { onConflict: 'tenant_id,integration_id,module_key' });
}

/* Central lock + freshness window — this route is the ONE place every app's
   sync proxy ultimately calls (Accounting today; any sibling app's own
   proxy would land here too), so guarding here protects against duplicate
   concurrent full syncs regardless of which app/tab/browser triggered it,
   with no per-app coordination needed.
     - Freshness: a 'background' trigger (the automatic once-per-tab login
       trigger — see components/Shell.js) is skipped if the integration
       synced successfully within SMARTLIFE_SYNC_FRESH_MS. An explicit
       'manual' trigger (the existing Refresh/Sync button) always runs,
       matching prior behavior exactly — a user who explicitly asks for a
       refresh should get one.
     - Lock: acquired via a single atomic conditional UPDATE ... WHERE ...
       RETURNING on crm_integrations.sync_lock_at (added by migration
       add_sync_lock_to_crm_integrations — the one schema change this
       required; extends the existing integration row rather than adding a
       new table). A plain SELECT-then-INSERT check was tried first and
       proven racy under real concurrent requests (verified live: two
       concurrent manual triggers both read "no running row" and both
       started a full sync) — Postgres serializes concurrent UPDATEs on the
       same row, so the second request's WHERE clause is re-evaluated
       against the first's committed write and correctly returns zero rows.
       A lease (SMARTLIFE_SYNC_LOCK_MS), not a permanent lock — a crashed
       process's stale lock is superseded once the lease expires. */
const SMARTLIFE_SYNC_FRESH_MS = Number(process.env.SMARTLIFE_SYNC_FRESH_MS) || 5 * 60 * 1000;
const SMARTLIFE_SYNC_LOCK_MS = Number(process.env.SMARTLIFE_SYNC_LOCK_MS) || 10 * 60 * 1000;

export async function POST(req, { params }) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();
  const integration = await getIntegration(sb, params.key);
  if (!integration) return json({ error: 'Integration not found.' }, 404);
  const body = await req.json().catch(() => ({}));
  const triggerType = body?.trigger === 'background' ? 'background' : 'manual';
  if (triggerType === 'background' && integration.last_sync_at) {
    const age = Date.now() - new Date(integration.last_sync_at).getTime();
    if (age >= 0 && age < SMARTLIFE_SYNC_FRESH_MS) {
      return json({ skipped: true, reason: 'recent_sync', last_sync_at: integration.last_sync_at });
    }
  }
  const leaseExpiredBefore = new Date(Date.now() - SMARTLIFE_SYNC_LOCK_MS).toISOString();
  const nowIso = new Date().toISOString();
  const { data: lockedRows, error: lockError } = await sb.from('crm_integrations')
    .update({ sync_lock_at: nowIso })
    .eq('id', integration.id)
    .or(`sync_lock_at.is.null,sync_lock_at.lt.${leaseExpiredBefore}`)
    .select('id');
  if (lockError) return json({ error: 'Could not acquire synchronization lock.' }, 500);
  if (!lockedRows || !lockedRows.length) return json({ skipped: true, reason: 'already_running' });
  /* crm_sync_runs.trigger_type is constrained to manual/scheduled/webhook/
     system (see crm_sync_runs_trigger_type_check) — the new automatic
     login-triggered sync is recorded as 'system' (closest real fit: not a
     user click, not a cron schedule, not a webhook), while `triggerType`
     itself stays 'background' for the freshness-skip logic above. */
  const { data: run, error } = await sb.from('crm_sync_runs').insert({ integration_id: integration.id, trigger_type: triggerType === 'background' ? 'system' : 'manual', direction: integration.sync_direction, status: 'running', started_at: new Date().toISOString(), requested_by: session.sub }).select().single();
  if (error) { await sb.from('crm_integrations').update({ sync_lock_at: null }).eq('id', integration.id); return json({ error: 'Could not start synchronization.' }, 500); }
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
      /* Account Balances (Trial Balance's data source) — same isolated
         try/catch-per-resource pattern as the loop above, tracked under
         its own module-status row. */
      try {
        const result = await readAllAccountBalances(sb);
        total += result.records.length;
        await upsertSmartErpAccountBalances(sb, result.records);
        /* Real, additive: records today's real balance per account into the
           append-only history table so Cash Flow (etc.) can compute actual
           period-over-period changes once enough days accumulate — never
           blocks/fails the sync itself if this secondary write has an issue. */
        await recordDailySnapshot(sb, result.records).catch(() => {});
        anyModuleConnected = true;
        await upsertModuleStatus(sb, integration.id, 'account-balances', {
          status: 'connected', records_read: result.records.length, records_inserted: result.records.length,
          last_synced_at: new Date().toISOString(), last_error: null,
        });
      } catch (moduleError) {
        const message = moduleError?.message || 'Synchronization failed.';
        const classification = classifySmartErpError(moduleError);
        const dbStatus = classification === 'permission_required' ? 'permission_required' : 'error';
        moduleErrors.push({ resource: 'account-balances', status: classification, message });
        await upsertModuleStatus(sb, integration.id, 'account-balances', { status: dbStatus, last_error: classification === 'other_error' ? message : `[${classification}] ${message}` });
      }
      /* General ledger / journal entries — the real source behind Daily
         Move, Receipts and Cash Receipts. Incremental by design: walks
         forward from the highest entry id already stored (plus a short
         re-check window for edited entries), bounded per run so a sync
         never turns into an unbounded crawl of the vendor's API. Same
         isolated try/catch-per-module contract as every resource above. */
      try {
        const result = await syncJournalEntries(sb);
        total += result.written;
        anyModuleConnected = true;
        await upsertModuleStatus(sb, integration.id, 'journal-entries', {
          status: 'connected', records_read: result.written, records_inserted: result.written,
          last_synced_at: new Date().toISOString(), last_error: null,
        });
      } catch (moduleError) {
        const message = moduleError?.message || 'Synchronization failed.';
        const classification = classifySmartErpError(moduleError);
        const dbStatus = classification === 'permission_required' ? 'permission_required' : 'error';
        moduleErrors.push({ resource: 'journal-entries', status: classification, message });
        await upsertModuleStatus(sb, integration.id, 'journal-entries', { status: dbStatus, last_error: classification === 'other_error' ? message : `[${classification}] ${message}` });
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
      last_sync_at: completedAt, sync_lock_at: null,
      last_error: moduleErrors.length ? `${moduleErrors.length} module(s) need attention: ${moduleErrors.map(m => m.resource).join(', ')}` : null,
    }).eq('id', integration.id);
    await auditIntegration(sb, integration.id, session.sub, 'integration.sync_completed', { syncRunId: run.id, records: total, moduleErrors });
    return json({ syncRunId: run.id, status: runStatus, records: total, moduleErrors });
  } catch (syncError) {
    const message = syncError?.message || 'Synchronization failed.';
    await sb.from('crm_sync_runs').update({ status: 'failed', error_summary: message, completed_at: new Date().toISOString() }).eq('id', run.id);
    await sb.from('crm_integrations').update({ status: 'error', last_error: message, sync_lock_at: null }).eq('id', integration.id);
    await auditIntegration(sb, integration.id, session.sub, 'integration.sync_failed', { syncRunId: run.id, error: message });
    return json({ syncRunId: run.id, status: 'failed', error: message }, 502);
  }
}
