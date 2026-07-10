'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { cloneQuotation } = require('@/lib/quotes');

export async function POST(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const result = await cloneQuotation(getDb(), params.id, session, 'duplicate');
  if (result.error) return json({ error: result.error }, 400);
  return json({ id: result.id }, 201);
}
