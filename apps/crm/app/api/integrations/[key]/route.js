'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getIntegration, hasSmartErpEnvironment, auditIntegration } = require('../../../../../shared/integrationPlatform');

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;
  const sb = getDb();
  const existing = await getIntegration(sb, params.key);
  if (!existing) return json({ error: 'Integration not found.' }, 404);
  const body = await req.json().catch(() => ({}));
  const patch = { updated_at: new Date().toISOString() };
  if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
  if (body.sync_direction) patch.sync_direction = body.sync_direction;
  if (body.sync_frequency_minutes !== undefined) patch.sync_frequency_minutes = body.sync_frequency_minutes ? Number(body.sync_frequency_minutes) : null;
  if (params.key === 'smartlife') {
    patch.status = patch.enabled === false ? 'disabled' : hasSmartErpEnvironment() ? 'warning' : 'not_configured';
  }
  patch.configured_by = session.sub;
  const { data, error } = await sb.from('crm_integrations').update(patch).eq('id', existing.id).select('id,integration_key,name,enabled,status,sync_direction,sync_frequency_minutes,config,updated_at').single();
  if (error) return json({ error: 'Could not update integration.' }, 500);
  await auditIntegration(sb, existing.id, session.sub, 'integration.configuration_updated', { fields: Object.keys(body).filter(key => ['enabled','sync_direction','sync_frequency_minutes'].includes(key)), credentialsChanged: false });
  return json({ integration: data });
}
