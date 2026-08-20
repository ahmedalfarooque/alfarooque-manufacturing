'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { getCashReceipts } = require('@/lib/smartlifeTransactionAdapter');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const result = await getCashReceipts(sb, { from: searchParams.get('from'), to: searchParams.get('to') });
  return json(result);
}
