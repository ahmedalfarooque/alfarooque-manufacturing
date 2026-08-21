'use strict';

/* Single purchase invoice, resolved through the shared document resolver so
   the print/PDF surfaces stop reporting "not found" for a record SmartERP
   actually has. See apps/accounting/lib/smartlifeDocument.js. */

const { json, requireAction } = require('@/lib/http');
const { resolveSmartLifeDocument } = require('@/lib/smartlifeDocument');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const { record, source, liveFailed } = await resolveSmartLifeDocument(req, 'purchases', params.id);
  if (!record) {
    /* A live-source failure must never be presented as a missing record. */
    return json({
      error: liveFailed
        ? 'The purchase could not be retrieved from SmartERP right now. Please retry.'
        : 'This purchase does not exist in SmartERP.',
      live_failed: liveFailed,
    }, liveFailed ? 502 : 404);
  }
  return json({ record, source });
}
