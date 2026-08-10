'use strict';

const { json, requireSession } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { SmartLifeConfigurationError, readSmartLife } = require('@/lib/smartlife');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  try {
    const cookies = parseCookies(req.headers.get('cookie'));
    const query = Object.fromEntries(new URL(req.url).searchParams.entries());
    /* Forward whichever credential the browser actually holds. requireSession
       above already accepted this request via either the app cookie or the
       parent-domain SSO cookie, so passing only the app cookie would drop a
       valid SSO-authenticated session. */
    const result = await readSmartLife(params.resource, {
      appToken: cookies[COOKIE_NAME],
      ssoToken: cookies[SSO_COOKIE_NAME],
    }, query);
    return json({
      source: 'SmartERP', connected: true, records: result.records,
      total: result.total, page: result.page, limit: result.limit,
    });
  } catch (error) {
    if (error instanceof SmartLifeConfigurationError) {
      return json({ source: 'SmartERP', connected: false, error: error.message }, 503);
    }
    console.error('[smartlife] read failed:', error && error.message);
    return json({ source: 'SmartERP', connected: false, error: 'SmartERP connection unavailable.' }, 502);
  }
}
