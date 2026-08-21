'use strict';

/* One real receipt / cash-receipt voucher, straight from the synchronized
   SmartERP ledger. Powers the SmartLife-style سند صرف document page. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { getReceiptDocument } = require('@/lib/smartlifeTransactionAdapter');
const { amountInWords } = require('@/lib/amountInWords');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  if (!/^\d+$/.test(String(params.id))) return json({ error: 'Invalid receipt id.' }, 400);
  try {
    const record = await getReceiptDocument(getDb(), params.id);
    if (!record) return json({ error: 'This receipt does not exist in the synchronized SmartERP ledger.' }, 404);
    return json({
      record,
      /* Spelled-out form of the SAME posted amount — presentation only. */
      amount_in_words: amountInWords(record.amount),
    });
  } catch (_) {
    return json({ error: 'Could not load the receipt.' }, 500);
  }
}
