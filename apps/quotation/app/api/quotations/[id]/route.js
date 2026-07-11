'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { isSuperAdminEmail } = require('@/lib/superAdmin');

/* Full document: quotation + entity + customer + products (+cost lines). */
export async function GET(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const { data: row, error } = await sb.from('qt_quotations')
    .select('*, entity:qt_entities(id, code, name_en, name_ar, address_en, address_ar, phone, email, website, cr_number, vat_number), customer:customers(id, company_name, company_name_en, company_name_ar, contact_person, contact_person_en, contact_person_ar, phone:mobile_number, email)')
    .eq('id', params.id).is('deleted_at', null).single();
  if (error || !row) return json({ error: 'Not found' }, 404);

  const { data: products } = await sb.from('qt_quotation_products')
    .select('*').eq('quotation_id', params.id).order('sort');
  const pids = (products || []).map(p => p.id);
  let linesByProduct = {};
  if (pids.length) {
    const { data: lines } = await sb.from('qt_qp_cost_lines')
      .select('*').in('quotation_product_id', pids).order('sort');
    for (const l of lines || []) {
      (linesByProduct[l.quotation_product_id] = linesByProduct[l.quotation_product_id] || []).push(l);
    }
  }
  const { data: events } = await sb.from('qt_quotation_events')
    .select('event, detail, created_at').eq('quotation_id', params.id).order('created_at', { ascending: false }).limit(20);

  const { data: projectRequest } = await sb.from('project_requests')
    .select('*').eq('quotation_id', params.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

  return json({
    row,
    products: (products || []).map(p => ({ ...p, lines: linesByProduct[p.id] || [] })),
    events: events || [],
    projectRequest: projectRequest || null,
  });
}

export async function DELETE(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const { data: before } = await sb.from('qt_quotations').select('status, quote_number').eq('id', params.id).single();
  if (!before) return json({ error: 'Not found' }, 404);
  /* Super admin bypasses the status/lock restriction entirely — every
     other user can only delete draft/cancelled/rejected/expired. */
  if (!isSuperAdminEmail(session.email) && !['draft', 'cancelled', 'rejected', 'expired'].includes(before.status)) {
    return json({ error: 'Only draft/cancelled/rejected/expired quotations can be deleted.' }, 409);
  }
  await sb.from('qt_quotations').update({ deleted_at: new Date().toISOString(), updated_by: session.sub }).eq('id', params.id);
  await audit(sb, 'qt_quotations', params.id, 'delete', before, null, session.sub);
  return json({ ok: true });
}
