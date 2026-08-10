'use strict';

const { json, requireSession } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SmartLifeConfigurationError, readSmartLife } = require('@/lib/smartlife');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  try {
    const cookies = parseCookies(req.headers.get('cookie'));
    const query = Object.fromEntries(new URL(req.url).searchParams.entries());
    const result = await readSmartLife(params.resource, cookies[COOKIE_NAME], query);
    return json({ source: 'SmartERP', connected: true, records: result.records });
  } catch (error) {
    if (error instanceof SmartLifeConfigurationError) {
      return json({ source: 'SmartERP', connected: false, error: error.message }, 503);
    }
    console.error('[smartlife] read failed:', error && error.message);
    return json({ source: 'SmartERP', connected: false, error: 'SmartERP connection unavailable.' }, 502);
  }
}
