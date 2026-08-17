'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');

/* Read-only document links — no new storage, no document viewer. Global
   (not customer-scoped) lists capped at 50, same tables Customer 360
   (/api/contacts/[id]) and Dashboard already read. */
export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const sb = getDb();
  const [quotations, invoices] = await Promise.all([
    sb.from('qt_quotations').select('id, quote_number, status, grand_total, created_at, customer_id').is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
    sb.from('erp_financial_source_records').select('id, source_reference, party_name, total_amount, balance_amount, source_status, record_date')
      .in('record_type', ['sales_invoice', 'purchase_invoice']).order('record_date', { ascending: false }).limit(50),
  ]);
  if (quotations.error) console.error('[crm/documents] quotations lookup failed:', quotations.error.message);
  if (invoices.error) console.error('[crm/documents] invoices lookup failed:', invoices.error.message);

  return json({ quotations: quotations.data || [], invoices: invoices.data || [] });
}
