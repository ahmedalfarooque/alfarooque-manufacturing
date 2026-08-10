'use strict';

/* Compatibility endpoint for old links. New projects are created
   automatically by the quotation contract transition; this endpoint uses
   the same idempotent workflow and cannot bypass Production/customer rules. */
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { createProjectForQuotation } = require('../../../../../../shared/quotationProjectWorkflow');

export async function POST(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;
  const sb = getDb();
  const { data: requestRow } = await sb.from('project_requests').select('quotation_id').eq('id', params.id).maybeSingle();
  if (!requestRow) return json({ error: 'Quotation request not found.' }, 404);
  try {
    const result = await createProjectForQuotation(sb, requestRow.quotation_id);
    return json({ project: result.project, created: result.created }, result.created ? 201 : 200);
  } catch (error) {
    return json({ error: error.message || 'Could not create the project.' }, 409);
  }
}
