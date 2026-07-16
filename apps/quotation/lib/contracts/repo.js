'use strict';

/* ═══════════════════════════════════════════════════════════════════
   Contracts repository — the single data-access seam for the module.
   Real Supabase (PostgREST) queries against the v12 schema
   (qt_contracts, qt_contract_payments, qt_contract_attachments,
   qt_bank_accounts). Every API route and server action goes through
   here, so when a development database with v12 applied is connected,
   this is the only layer that needs runtime verification — the UI and
   services already integrate against these function signatures.

   No fabricated behaviour: these are the actual queries. They simply
   cannot be executed until v12 exists on the connected database.
   ═══════════════════════════════════════════════════════════════════ */

const { getDb } = require('@/lib/db');
const { nextContractNumber } = require('./numbering');
const { templateClauses, getTemplate } = require('./templates');
const { computeSchedule } = require('./payments');

const CONTRACT_COLS =
  'id, contract_number, quotation_id, customer_id, project_id, bank_account_id, status, ' +
  'title, title_ar, output_lang, contract_date, currency, grand_total, clauses, ' +
  'notes_html, notes_html_ar, customer_snapshot, project_snapshot, ' +
  'accepted_by, accepted_at, created_at, created_by, updated_at, updated_by';

/* ── Numbering: derive the next CT-YYYY-NNNN from the current max. ── */
async function generateContractNumber(sb, year) {
  const { data } = await sb
    .from('qt_contracts')
    .select('contract_number')
    .ilike('contract_number', `CT-${year}-%`)
    .order('contract_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return nextContractNumber(year, data ? data.contract_number : null);
}

/* ── List (paginated, filterable) ── */
async function listContracts({ q = '', status = '', page = 1, pageSize = 25 } = {}) {
  const sb = getDb();
  const from = (Math.max(1, page) - 1) * pageSize;
  let query = sb.from('qt_contracts')
    .select(CONTRACT_COLS + ', customer:qt_customers(company_name)', { count: 'exact' })
    .is('deleted_at', null);
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('contract_number', `%${q.replace(/[%,()]/g, '')}%`);
  query = query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { rows: data || [], total: count || 0, page, pageSize };
}

/* ── Get one, with payments + attachments + bank joined ── */
async function getContract(id) {
  const sb = getDb();
  const { data, error } = await sb.from('qt_contracts')
    .select(CONTRACT_COLS +
      ', customer:qt_customers(*)' +
      ', bank:qt_bank_accounts(*)' +
      ', payments:qt_contract_payments(*)' +
      ', attachments:qt_contract_attachments(*)')
    .eq('id', id).is('deleted_at', null).single();
  if (error) throw new Error(error.message);
  if (data && Array.isArray(data.payments)) {
    data.payments.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }
  return data;
}

/* ── Create — from a quotation (forwards its data) or blank; seeds
      clauses from the chosen template; assigns the next number. ── */
async function createContract({ quotationId = null, templateKey = 'general', outputLang = 'both', userId = null } = {}) {
  const sb = getDb();
  const year = new Date().getFullYear();
  const contract_number = await generateContractNumber(sb, year);

  let base = {
    contract_number,
    status: 'contract_submitted',
    output_lang: outputLang,
    clauses: templateClauses(templateKey),
    title: getTemplate(templateKey).name,
    title_ar: getTemplate(templateKey).name_ar,
    created_by: userId, updated_by: userId,
  };

  if (quotationId) {
    const { data: qn } = await sb.from('qt_quotations')
      .select('id, quote_number, customer_id, grand_total, currency, project_id, customer:qt_customers(*)')
      .eq('id', quotationId).single();
    if (qn) {
      base.quotation_id = qn.id;
      base.customer_id = qn.customer_id;
      base.project_id = qn.project_id || null;
      base.grand_total = qn.grand_total || 0;
      base.currency = qn.currency || 'SAR';
      base.customer_snapshot = qn.customer || {};
      base.project_snapshot = { quotation_number: qn.quote_number };
    }
  }

  const { data, error } = await sb.from('qt_contracts').insert(base).select('id, contract_number').single();
  if (error) throw new Error(error.message);
  return data;
}

/* ── Update contract header/clauses/notes ── */
async function updateContract(id, patch, userId = null) {
  const sb = getDb();
  const allowed = ['title', 'title_ar', 'output_lang', 'contract_date', 'currency', 'grand_total',
    'clauses', 'notes_html', 'notes_html_ar', 'bank_account_id', 'customer_id', 'status',
    'customer_snapshot', 'project_snapshot'];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  clean.updated_by = userId;
  clean.updated_at = new Date().toISOString();
  const { data, error } = await sb.from('qt_contracts').update(clean).eq('id', id).select('id').single();
  if (error) throw new Error(error.message);
  return data;
}

/* ── Replace the payment schedule (resolved %/amount) atomically-ish ── */
async function savePayments(contractId, total, milestones = []) {
  const sb = getDb();
  const { rows } = computeSchedule(total, milestones);
  await sb.from('qt_contract_payments').delete().eq('contract_id', contractId);
  if (rows.length) {
    const insert = rows.map((r, i) => ({
      contract_id: contractId, sort_order: i,
      label: r.label || null, label_ar: r.label_ar || null,
      percent: r.percent, amount: r.amount,
      due_condition: r.due_condition || null, due_date: r.due_date || null, note: r.note || null,
    }));
    const { error } = await sb.from('qt_contract_payments').insert(insert);
    if (error) throw new Error(error.message);
  }
  return { count: rows.length };
}

/* ── Soft delete (matches app convention) ── */
async function softDeleteContract(id, userId = null) {
  const sb = getDb();
  const { error } = await sb.from('qt_contracts')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId }).eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ── Bank accounts ── */
async function listBankAccounts({ activeOnly = false } = {}) {
  const sb = getDb();
  let query = sb.from('qt_bank_accounts').select('*').order('sort_order', { ascending: true });
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}
async function createBankAccount(patch, userId = null) {
  const sb = getDb();
  const { data, error } = await sb.from('qt_bank_accounts')
    .insert({ ...patch, created_by: userId, updated_by: userId }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}
async function updateBankAccount(id, patch, userId = null) {
  const sb = getDb();
  const { data, error } = await sb.from('qt_bank_accounts')
    .update({ ...patch, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

module.exports = {
  generateContractNumber, listContracts, getContract, createContract,
  updateContract, savePayments, softDeleteContract,
  listBankAccounts, createBankAccount, updateBankAccount,
};
