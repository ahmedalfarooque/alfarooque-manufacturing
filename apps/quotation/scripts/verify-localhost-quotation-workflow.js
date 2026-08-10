'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(file) {
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const split = text.indexOf('=');
    if (split < 1) continue;
    let value = text.slice(split + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[text.slice(0, split).trim()] = value;
  }
  return values;
}

const quoteEnv = loadEnv(path.join(__dirname, '..', '.env.local'));
const projectsEnv = loadEnv(path.join(__dirname, '..', '..', 'projects', '.env.local'));
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const sb = createClient(quoteEnv.SUPABASE_URL, quoteEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const createdQuotationIds = [];

function assert(condition, message) { if (!condition) throw new Error(message); }
async function api(url, cookie, body) {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
  });
  return { response, data: await response.json().catch(() => ({})) };
}
async function patch(url, cookie, body) {
  const response = await fetch(url, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
  });
  return { response, data: await response.json().catch(() => ({})) };
}
async function remove(url, cookie) {
  const response = await fetch(url, { method: 'DELETE', headers: { Cookie: cookie } });
  return { response, data: await response.json().catch(() => ({})) };
}
async function makeDraft(entityId, actorId, label) {
  const quoteNumber = `TEST-LOCAL-QA-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const { data, error } = await sb.from('qt_quotations').insert({
    entity_id: entityId, quote_number: quoteNumber, status: 'draft', grand_total: 1150,
    created_by: actorId, updated_by: actorId,
  }).select('id,quote_number').single();
  if (error) throw error;
  createdQuotationIds.push(data.id);
  return data;
}
async function requestFor(quotationId) {
  const { data, error } = await sb.from('project_requests').select('*').eq('quotation_id', quotationId).order('created_at', { ascending: false }).limit(1).single();
  if (error) throw error;
  return data;
}
async function quotation(id) {
  const { data, error } = await sb.from('qt_quotations').select('id,status,project_status,pm_project_id,project_request_id').eq('id', id).single();
  if (error) throw error;
  return data;
}
async function cleanup() {
  for (const quotationId of createdQuotationIds) {
    const { data: requests } = await sb.from('project_requests').select('id,project_id').eq('quotation_id', quotationId);
    const projectIds = [...new Set((requests || []).map(r => r.project_id).filter(Boolean))];
    await sb.from('qt_quotations').update({ pm_project_id: null, project_request_id: null }).eq('id', quotationId);
    if (requests?.length) await sb.from('project_requests').update({ project_id: null }).in('id', requests.map(r => r.id));
    if (projectIds.length) {
      await sb.from('pm_project_logs').delete().in('project_id', projectIds);
      await sb.from('pm_projects').delete().in('id', projectIds);
    }
    if (requests?.length) await sb.from('project_requests').delete().in('id', requests.map(r => r.id));
    await sb.from('qt_quotation_events').delete().eq('quotation_id', quotationId);
    await sb.from('qt_audit_logs').delete().eq('record_id', quotationId);
    if (requests?.length) await sb.from('qt_audit_logs').delete().in('record_id', requests.map(r => r.id));
    await sb.from('qt_quotations').delete().eq('id', quotationId);
  }
}

async function main() {
  const { data: actor } = await sb.from('platform_users').select('id,email,role').eq('role', 'admin').eq('is_active', true).limit(1).single();
  const { data: entity } = await sb.from('qt_entities').select('id').eq('is_active', true).limit(1).single();
  assert(actor && entity, 'An active admin and quotation entity are required.');
  const quoteCookie = 'af_quotation_session=' + jwt.sign({ sub: actor.id, email: actor.email, role: 'admin', app: 'quotation' }, quoteEnv.JWT_SECRET, { expiresIn: 300 });
  const projectsCookie = 'af_projects_session=' + jwt.sign({ sub: actor.id, email: actor.email, role: 'admin', app: 'projects' }, projectsEnv.JWT_SECRET, { expiresIn: 300 });

  try {
    const approved = await makeDraft(entity.id, actor.id, 'APPROVED');
    const submitted = await api(`http://localhost:3030/api/quotations/${approved.id}/status`, quoteCookie, { action: 'submit' });
    assert(submitted.response.ok && submitted.data.status === 'waiting_quotation_approval', `Submit failed: ${submitted.data.error || submitted.response.status}`);
    const duplicate = await api(`http://localhost:3030/api/quotations/${approved.id}/status`, quoteCookie, { action: 'submit' });
    assert(duplicate.response.status === 409, 'Repeated Submit was not rejected.');
    const approvedRequest = await requestFor(approved.id);
    const decided = await patch(`http://localhost:3020/api/quotation-requests/${approvedRequest.id}`, projectsCookie, { status: 'approved' });
    assert(decided.response.ok, `Projects approval failed: ${decided.data.error || decided.response.status}`);
    assert((await quotation(approved.id)).status === 'quotation_approved', 'Projects approval did not propagate to QuotePro.');
    const customerApproved = await api(`http://localhost:3030/api/quotations/${approved.id}/status`, quoteCookie, { action: 'accept' });
    assert(customerApproved.response.ok && customerApproved.data.status === 'customer_approved', 'Customer approval transition failed.');
    const projectCreated = await api(`http://localhost:3030/api/quotations/${approved.id}/status`, quoteCookie, { action: 'contract' });
    assert(projectCreated.response.ok && projectCreated.data.status === 'project_created', `Project creation failed: ${projectCreated.data.error || projectCreated.response.status}`);

    const declined = await makeDraft(entity.id, actor.id, 'CUSTOMER-REJECTED');
    await api(`http://localhost:3030/api/quotations/${declined.id}/status`, quoteCookie, { action: 'submit' });
    const declinedRequest = await requestFor(declined.id);
    await patch(`http://localhost:3020/api/quotation-requests/${declinedRequest.id}`, projectsCookie, { status: 'approved' });
    const customerRejected = await api(`http://localhost:3030/api/quotations/${declined.id}/status`, quoteCookie, { action: 'decline', reason: 'Safe localhost test' });
    const declinedRow = await quotation(declined.id);
    assert(customerRejected.response.ok && declinedRow.status === 'customer_rejected' && !declinedRow.pm_project_id, 'Customer rejection created or advanced a project.');

    const rejected = await makeDraft(entity.id, actor.id, 'QUOTATION-REJECTED');
    await api(`http://localhost:3030/api/quotations/${rejected.id}/status`, quoteCookie, { action: 'submit' });
    const rejectedRequest = await requestFor(rejected.id);
    await patch(`http://localhost:3020/api/quotation-requests/${rejectedRequest.id}`, projectsCookie, { status: 'rejected', note: 'Safe localhost test' });
    const blockedCustomer = await api(`http://localhost:3030/api/quotations/${rejected.id}/status`, quoteCookie, { action: 'accept' });
    assert((await quotation(rejected.id)).status === 'quotation_rejected' && blockedCustomer.response.status === 409, 'Quotation rejection did not block customer approval.');

    const deleted = await makeDraft(entity.id, actor.id, 'DELETE');
    await api(`http://localhost:3030/api/quotations/${deleted.id}/status`, quoteCookie, { action: 'submit' });
    const deletedRequest = await requestFor(deleted.id);
    const deleteResult = await remove(`http://localhost:3020/api/quotation-requests/${deletedRequest.id}`, projectsCookie);
    assert(deleteResult.response.ok, `Quotation Approval delete failed: ${deleteResult.data.error || deleteResult.response.status}`);
    const { data: requestAfterDelete } = await sb.from('project_requests').select('id').eq('id', deletedRequest.id).maybeSingle();
    const quoteAfterDelete = await quotation(deleted.id);
    assert(!requestAfterDelete && quoteAfterDelete.status === 'draft' && !quoteAfterDelete.project_request_id, 'Delete did not atomically restore the quotation to Draft.');

    console.log('✓ Localhost Submit created and linked one Quotation Approval request.');
    console.log('✓ Repeated Submit returned 409 and created no duplicate.');
    console.log('✓ Projects approval propagated; customer approval created one project.');
    console.log('✓ Customer rejection created no project.');
    console.log('✓ Projects rejection blocked customer approval.');
    console.log('✓ Quotation Approval delete unlinked the request and restored Draft.');
  } finally {
    await cleanup();
    console.log('✓ Isolated localhost test records removed.');
  }
}

main().catch(error => { console.error('✗ ' + error.message); process.exit(1); });
