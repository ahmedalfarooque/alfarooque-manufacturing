'use strict';

const { json, requireWrite } = require('@/lib/http');

/* Kept only so old clients receive an explicit workflow response instead of
   a 404. Submission now creates the Quotation Approval request, and the
   contract transition creates the project automatically. */
export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  return json({ error: 'Manual Send to Projects has been retired. Submit the quotation for Quotation Approval; customer approval enables project creation.' }, 410);
}
