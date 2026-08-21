'use strict';

/* Single sales invoice, resolved through the same shared document resolver
   used by purchases and by the ZATCA QR endpoint — one resolution order for
   every surface. See apps/accounting/lib/smartlifeDocument.js. */

const { json, requireAction } = require('@/lib/http');
const { resolveSmartLifeDocument } = require('@/lib/smartlifeDocument');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const { record, source, liveFailed } = await resolveSmartLifeDocument(req, 'sales-invoices', params.id);
  if (!record) {
    return json({
      error: liveFailed
        ? 'The sales invoice could not be retrieved from SmartERP right now. Please retry.'
        : 'This sales invoice does not exist in SmartERP.',
      live_failed: liveFailed,
    }, liveFailed ? 502 : 404);
  }
  return json({ record, source });
}
