'use strict';

const { SMARTLIFE_RESOURCES, IntegrationConfigurationError, recordsFrom } = require('../../shared/integrationPlatform');

const RESOURCES = SMARTLIFE_RESOURCES;
const SmartLifeConfigurationError = IntegrationConfigurationError;

function endpointFor(resource, query = {}) {
  if (!RESOURCES[resource]) throw new SmartLifeConfigurationError('Unsupported SmartERP read-only resource.');
  const base = (process.env.SMARTERP_CENTRAL_API_URL || 'http://localhost:3060').trim();
  let url;
  try { url = new URL(`/api/integrations/smartlife/data/${resource}`, base); }
  catch (_) { throw new SmartLifeConfigurationError('Central SmartERP integration URL is invalid.'); }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new SmartLifeConfigurationError('Central SmartERP integration must use HTTPS.');
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && String(value).trim()) url.searchParams.set(key, String(value).trim());
  }
  return url;
}

async function readSmartLife(resource, sessionToken, query = {}) {
  if (!sessionToken) throw new SmartLifeConfigurationError('Authenticated ERP session is required.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpointFor(resource, query), {
      method: 'GET',
      headers: { Accept: 'application/json', Cookie: `af_crm_session=${encodeURIComponent(sessionToken)}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Central SmartERP service returned HTTP ${response.status}.`);
    return { records: recordsFrom(payload.records || payload), providerPayload: payload };
  } finally { clearTimeout(timeout); }
}

module.exports = { RESOURCES, SmartLifeConfigurationError, endpointFor, recordsFrom, readSmartLife };
