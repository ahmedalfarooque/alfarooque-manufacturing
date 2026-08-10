'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { IntegrationConfigurationError, readSmartLife } = require('../../../../../../../shared/integrationPlatform');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  try {
    const query = Object.fromEntries(new URL(req.url).searchParams.entries());
    const result = await readSmartLife(getDb(), params.resource, query);
    const provider = result.providerPayload || {};
    return json({
      source: 'SmartERP', connected: true, resource: params.resource, records: result.records,
      /* SmartERP reports the full matching count separately from the returned
         page, so the UI can show "showing N of TOTAL" instead of implying the
         page is everything. */
      total: Number(provider.total) || result.records.length,
      page: Number(provider.page) || 0,
      limit: Number(provider.limit) || 0,
    });
  } catch (error) {
    if (error instanceof IntegrationConfigurationError) return json({ connected: false, error: error.message }, 503);
    console.error('[smarterp-central] read failed:', error?.message || 'Unknown error');
    return json({ connected: false, error: 'SmartERP connection unavailable.' }, 502);
  }
}
