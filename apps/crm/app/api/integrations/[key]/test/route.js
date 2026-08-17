'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { getIntegration, readSmartLife, auditIntegration } = require('../../../../../../shared/integrationPlatform');

export async function POST(req, { params }) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();
  const integration = await getIntegration(sb, params.key);
  if (!integration) return json({ error: 'Integration not found.' }, 404);
  try {
    /* Connection health must use a module this API user can actually read.
       Products is currently permission-blocked in SmartERP, so probing it
       mislabels a healthy authenticated connection as a network failure.
       Categories is a verified V3 read endpoint and is live for this account. */
    if (params.key === 'smartlife') await readSmartLife(sb, 'categories');
    else if (params.key === 'alfarooque_erp') {
      const checks = await Promise.all([
        sb.from('qt_quotations').select('id', { count: 'exact', head: true }),
        sb.from('pm_projects').select('id', { count: 'exact', head: true }),
        sb.from('inv_products').select('id', { count: 'exact', head: true }),
        sb.from('cars').select('id', { count: 'exact', head: true }),
        sb.from('acc_chart_of_accounts').select('id', { count: 'exact', head: true }),
        sb.from('crm_contacts').select('id', { count: 'exact', head: true }),
      ]);
      const failed = checks.find(check => check.error);
      if (failed) throw new Error(`Internal ERP health check failed: ${failed.error.message}`);
    } else return json({ connected: false, error: 'This integration is not configured for connection testing.' }, 400);
    const now = new Date().toISOString();
    await sb.from('crm_integrations').update({ status: 'connected', enabled: true, last_error: null, updated_at: now }).eq('id', integration.id);
    await auditIntegration(sb, integration.id, session.sub, 'integration.connection_tested', { result: 'connected' });
    return json({ connected: true, testedAt: now });
  } catch (error) {
    const message = error?.message || 'Connection failed.';
    await sb.from('crm_integrations').update({ status: 'error', last_error: message, updated_at: new Date().toISOString() }).eq('id', integration.id);
    await auditIntegration(sb, integration.id, session.sub, 'integration.connection_tested', { result: 'failed', error: message });
    return json({ connected: false, error: message }, 502);
  }
}
