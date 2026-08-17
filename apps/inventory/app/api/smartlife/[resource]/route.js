'use strict';

const { json, requireSession , requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { SmartLifeConfigurationError, readSmartLife } = require('@/lib/smartlife');

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
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
