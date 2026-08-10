'use strict';

function money(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

async function ensureQuotationApprovalRequest(sb, quotation, requestedBy) {
  const { data, error } = await sb.rpc('qt_submit_for_quotation_approval', {
    p_quotation_id: quotation.id,
    p_requested_by: requestedBy,
  });
  if (error) throw error;
  return { row: data, created: true };
}

function projectNotes(qn, products) {
  const lines = [
    `Created automatically from contracted Quotation ${qn.quote_number}.`, '',
    `Subtotal: ${money(qn.subtotal)} ${qn.currency || 'SAR'}`,
    `VAT (${qn.vat_rate}%): ${money(qn.vat_amount)} ${qn.currency || 'SAR'}`,
    `Contract Value (Grand Total): ${money(qn.grand_total)} ${qn.currency || 'SAR'}`,
  ];
  if (qn.customer_notes) lines.push('', 'Customer Notes:', qn.customer_notes);
  if (qn.internal_notes) lines.push('', 'Internal Notes:', qn.internal_notes);
  if (products?.length) {
    lines.push('', 'Quotation Items:');
    for (const p of products) {
      lines.push(`- ${p.name_en || p.name_ar || p.name || '(unnamed item)'} — ${p.qty} ${p.unit || ''} × ${money(p.unit_price)} = ${money(p.line_total)} ${qn.currency || 'SAR'}`);
    }
  }
  return lines.join('\n');
}

async function createProjectForQuotation(sb, quotationId) {
  const [{ data: request, error: requestError }, { data: qn, error: quotationError }] = await Promise.all([
    sb.from('project_requests').select('*').eq('quotation_id', quotationId).neq('status', 'rejected').maybeSingle(),
    sb.from('qt_quotations').select('*, customer:customers(company_name, company_name_en, company_name_ar, contact_person, email, mobile_number, address)').eq('id', quotationId).maybeSingle(),
  ]);
  if (requestError) throw requestError;
  if (quotationError) throw quotationError;
  if (!request) throw new Error('Quotation approval request not found.');
  if (request.status !== 'approved') throw new Error('Quotation approval is required before project creation.');
  if (!qn) throw new Error('Source quotation not found.');
  if (!['customer_approved', 'contracted', 'project_created'].includes(qn.status)) {
    throw new Error('Customer approval and contracting are required before project creation.');
  }

  const { data: alreadyLinked } = await sb.from('pm_projects').select('*').eq('quotation_id', quotationId).maybeSingle();
  if (alreadyLinked) {
    await Promise.all([
      sb.from('project_requests').update({ project_id: alreadyLinked.id, updated_at: new Date().toISOString() }).eq('id', request.id),
      sb.from('qt_quotations').update({ pm_project_id: alreadyLinked.id, project_status: alreadyLinked.status, status: 'project_created', updated_at: new Date().toISOString() }).eq('id', quotationId),
    ]);
    return { project: alreadyLinked, created: false, request };
  }

  const { data: products, error: productsError } = await sb.from('qt_quotation_products')
    .select('name, name_en, name_ar, unit, qty, unit_price, line_total').eq('quotation_id', quotationId).order('sort');
  if (productsError) throw productsError;
  const customer = qn.customer || {};
  const customerName = customer.company_name_en || customer.company_name_ar || customer.company_name || 'Unknown Customer';
  const projectRow = {
    quotation_id: quotationId,
    customer_id: qn.customer_id || null,
    customer_name: customerName,
    company_name: customer.company_name || customerName,
    contact_person: customer.contact_person || null,
    contact_email: customer.email || null,
    contact_phone: customer.mobile_number || null,
    address: customer.address || null,
    project_name: `${customerName} — ${qn.quote_number}`,
    short_summary: `Project for quotation ${qn.quote_number}`,
    value: Number(qn.grand_total || 0),
    status: 'Running',
    progress: 0,
    notes: projectNotes(qn, products || []),
  };

  let { data: project, error: createError } = await sb.from('pm_projects').insert(projectRow).select().single();
  if (createError?.code === '23505') {
    const raced = await sb.from('pm_projects').select('*').eq('quotation_id', quotationId).maybeSingle();
    project = raced.data;
    createError = raced.error;
  }
  if (createError || !project) throw createError || new Error('Could not create the project.');

  const { error: linkError } = await sb.from('project_requests').update({
    project_id: project.id, updated_at: new Date().toISOString(),
  }).eq('id', request.id);
  if (linkError) throw linkError;
  const { error: quotationLinkError } = await sb.from('qt_quotations').update({
    status: 'project_created', pm_project_id: project.id, project_status: project.status, project_request_id: request.id, updated_at: new Date().toISOString(),
  }).eq('id', quotationId);
  if (quotationLinkError) throw quotationLinkError;
  await sb.from('pm_project_logs').insert({ project_id: project.id, activity: `Project created automatically from contracted Quotation ${qn.quote_number}` });
  return { project, created: true, request };
}

module.exports = { ensureQuotationApprovalRequest, createProjectForQuotation };
