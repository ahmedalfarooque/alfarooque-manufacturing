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

/* Builds the Cookie header forwarded to the central CRM integration service.
   Accounting's own readSession accepts either the app cookie OR the shared
   parent-domain SSO cookie, so this must forward whichever the caller actually
   has — previously only the app cookie was forwarded, so an admin signed in
   through a sibling app (SSO only, no af_accounting_session) hit
   "Authenticated ERP session is required" even though the page authorized fine.
   CRM's readSession accepts the same two credentials, so no new auth path is
   introduced and no bypass exists: with neither cookie present this still
   throws. */
function forwardedCookieHeader(credential) {
  const { appToken, ssoToken } = typeof credential === 'string'
    ? { appToken: credential, ssoToken: null }
    : (credential || {});
  const parts = [];
  if (appToken) parts.push(`af_crm_session=${encodeURIComponent(appToken)}`);
  if (ssoToken) parts.push(`af_sso_session=${encodeURIComponent(ssoToken)}`);
  return parts.join('; ');
}

async function readSmartLife(resource, credential, query = {}) {
  const cookieHeader = forwardedCookieHeader(credential);
  if (!cookieHeader) throw new SmartLifeConfigurationError('Authenticated ERP session is required.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpointFor(resource, query), {
      method: 'GET',
      headers: { Accept: 'application/json', Cookie: cookieHeader },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Central SmartERP service returned HTTP ${response.status}.`);
    const records = recordsFrom(payload.records || payload);
    return {
      records, providerPayload: payload,
      total: Number(payload.total) || records.length,
      page: Number(payload.page) || 0,
      limit: Number(payload.limit) || 0,
    };
  } finally { clearTimeout(timeout); }
}

module.exports = { RESOURCES, SmartLifeConfigurationError, endpointFor, recordsFrom, readSmartLife, forwardedCookieHeader };
