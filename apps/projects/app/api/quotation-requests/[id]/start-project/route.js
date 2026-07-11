'use strict';

/* "Project Start" (Part 8/9) — turns an accepted/on-hold quotation
   request into a real pm_projects row, pre-filled from the quotation
   and its customer so nothing has to be re-typed. Quotations have no
   file-attachment feature yet, so line items are transferred as a
   formatted text summary in the project's notes field rather than as
   structured rows (pm_projects has no line-items table of its own). */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { buildProjectRow } = require('@/lib/createProjectRow');
const { auditQuotation } = require('@/lib/auditQuotation');

function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }); }

function buildNotes({ qn, products }) {
  const lines = [];
  lines.push(`Created from Quotation ${qn.quote_number}.`);
  lines.push('');
  lines.push(`Subtotal: ${money(qn.subtotal)} SAR`);
  lines.push(`VAT (${qn.vat_rate}%): ${money(qn.vat_amount)} SAR`);
  lines.push(`Contract Value (Grand Total): ${money(qn.grand_total)} SAR`);
  if (qn.customer_notes) { lines.push(''); lines.push('Customer Notes:'); lines.push(qn.customer_notes); }
  if (qn.internal_notes) { lines.push(''); lines.push('Internal Notes:'); lines.push(qn.internal_notes); }
  if (products && products.length) {
    lines.push('');
    lines.push('Quotation Items:');
    for (const p of products) {
      const name = p.name_en || p.name_ar || '(unnamed item)';
      lines.push(`- ${name} — ${p.qty} ${p.unit} × ${money(p.unit_price)} = ${money(p.line_total)} SAR`);
    }
  }
  return lines.join('\n');
}

export async function POST(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;
  const sb = getDb();

  const { data: reqRow } = await sb.from('project_requests').select('*').eq('id', params.id).maybeSingle();
  if (!reqRow) return json({ error: 'Quotation request not found.' }, 404);
  if (!['accepted', 'on_hold'].includes(reqRow.status)) {
    return json({ error: 'Quotation request must be Accepted or On Hold before starting a project.' }, 409);
  }
  if (reqRow.project_id) return json({ error: 'A project has already been created from this request.' }, 409);

  const { data: qn } = await sb.from('qt_quotations')
    .select('*, customer:customers(company_name, company_name_en, company_name_ar, contact_person, email, mobile_number, address)')
    .eq('id', reqRow.quotation_id).maybeSingle();
  if (!qn) return json({ error: 'Source quotation not found.' }, 404);

  const { data: products } = await sb.from('qt_quotation_products')
    .select('name_en, name_ar, unit, qty, unit_price, line_total').eq('quotation_id', reqRow.quotation_id).order('sort');

  const customer = qn.customer || {};
  const customerName = customer.company_name_en || customer.company_name_ar || customer.company_name || 'Unknown Customer';

  const row = buildProjectRow({
    customer_id: qn.customer_id,
    customer_name: customerName,
    company_name: customer.company_name || customerName,
    contact_person: customer.contact_person || null,
    contact_email: customer.email || null,
    contact_phone: customer.mobile_number || null,
    address: customer.address || null,
    project_name: `${customerName} — ${qn.quote_number}`,
    short_summary: `Project for quotation ${qn.quote_number}`,
    value: qn.grand_total,
    status: 'Running',
    notes: buildNotes({ qn, products }),
  });

  const { data: project, error } = await sb.from('pm_projects').insert(row).select().single();
  if (error) { console.error('[start-project] create failed:', error.message); return json({ error: 'Could not create the project.' }, 500); }

  await sb.from('project_requests').update({ project_id: project.id, updated_at: new Date().toISOString() }).eq('id', params.id);
  await sb.from('qt_quotations').update({ project_id: project.id, project_status: project.status }).eq('id', reqRow.quotation_id);
  await sb.from('pm_project_logs').insert({ project_id: project.id, activity: `Project created from Quotation ${qn.quote_number}` });
  await auditQuotation(sb, 'pm_projects', project.id, 'insert', null, { ...project, source_quotation: qn.quote_number }, session.sub);

  return json({ project }, 201);
}
