'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { SMARTLIFE_RESOURCES } = require('../../shared/integrationPlatform');
const { decodeZatcaTlvBase64 } = require('../../accounting/lib/zatca');

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith('#')) continue;
      const index = text.indexOf('=');
      if (index < 1) continue;
      const key = text.slice(0, index).trim();
      let value = text.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (_) {}
}

loadEnv(path.join(__dirname, '..', '..', '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env.local'));

const resources = [...Object.keys(SMARTLIFE_RESOURCES), 'account-balances'];

function session(app, user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured for localhost verification.');
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, app }, process.env.JWT_SECRET, { expiresIn: 300 });
}

async function verifierUser() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase server configuration is missing.');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.from('platform_users').select('id,email,role').eq('role', 'admin').limit(1).maybeSingle();
  if (error || !data) throw new Error('No admin user is available for localhost verification.');
  return { user: data, sb };
}

async function request(url, options = {}, allowedStatuses = [200]) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!allowedStatuses.includes(response.status)) throw new Error(`${new URL(url).pathname} returned HTTP ${response.status}: ${payload.error || 'request failed'}`);
  return { response, payload };
}

async function main() {
  const { user, sb } = await verifierUser();
  const crmHeaders = { cookie: `af_crm_session=${session('crm', user)}` };
  const accountingHeaders = { cookie: `af_accounting_session=${session('accounting', user)}` };
  const inventoryHeaders = { cookie: `af_inventory_session=${session('inventory', user)}` };
  const quotationHeaders = { cookie: `af_quotation_session=${session('quotation', user)}` };
  const result = { crm: {}, accounting: {}, connection: false, sync: null, customer360: null, dashboard: null, pages: {}, pagination: null, zatca: null, pdf: null };
  let sampleSalesId = null;

  for (const resource of resources) {
    const allowed = [200, 403, 404, 502, 503];
    const crm = await request(`http://localhost:3060/api/integrations/smartlife/data/${resource}`, { headers: crmHeaders }, allowed);
    const accounting = await request(`http://localhost:3050/api/smartlife/${resource}`, { headers: accountingHeaders }, allowed);
    if (crm.response.status !== accounting.response.status) throw new Error(`Central status mismatch for ${resource}.`);
    if (crm.response.status === 403 && (!crm.payload.permission_required || !accounting.payload.permission_required)) {
      throw new Error(`${resource} permission denial was not preserved through the proxy chain.`);
    }
    if (crm.response.status === 404 && (!crm.payload.endpoint_unavailable || !accounting.payload.endpoint_unavailable)) {
      throw new Error(`${resource} endpoint state was not preserved through the proxy chain.`);
    }
    if (crm.response.status === 502 && crm.payload.connection_error !== accounting.payload.connection_error) {
      throw new Error(`${resource} connection state mismatch through the proxy chain.`);
    }
    const centralCount = Array.isArray(crm.payload.records) ? crm.payload.records.length : 0;
    const accountingCount = Array.isArray(accounting.payload.records) ? accounting.payload.records.length : 0;
    if (resource === 'sales-invoices') {
      const sample = (accounting.payload.records || [])[0];
      sampleSalesId = sample && (sample.id ?? sample.invoice_id ?? sample.reference_no ?? sample.invoice_number ?? sample.number ?? sample.reference);
    }
    if (centralCount !== accountingCount) throw new Error(`Central resource count mismatch for ${resource}.`);
    result.crm[resource] = { status: crm.response.status, records: centralCount, source: crm.payload.source, permission_required: crm.payload.permission_required === true, snapshot_available: crm.payload.snapshot_available === true };
    result.accounting[resource] = { status: accounting.response.status, records: accountingCount, source: accounting.payload.source, permission_required: accounting.payload.permission_required === true, snapshot_available: accounting.payload.snapshot_available === true };
  }

  const firstSalesPage = await request('http://localhost:3050/api/smartlife/sales-invoices?offset=0&limit=25', { headers: accountingHeaders }, [200,403]);
  const secondSalesPage = await request('http://localhost:3050/api/smartlife/sales-invoices?offset=25&limit=25', { headers: accountingHeaders }, [200,403]);
  const recordKey = record => String(record?.id ?? record?.invoice_id ?? record?.reference_no ?? record?.invoice_number ?? record?.number ?? record?.reference ?? '');
  const firstKeys = new Set((firstSalesPage.payload.records || []).map(recordKey).filter(Boolean));
  const secondKeys = new Set((secondSalesPage.payload.records || []).map(recordKey).filter(Boolean));
  const overlap = [...secondKeys].filter(key => firstKeys.has(key));
  if (Number(firstSalesPage.payload.total) > 25 && overlap.length) throw new Error('Sales invoice pagination returned duplicate records across pages.');
  result.pagination = {
    total: Number(firstSalesPage.payload.total) || 0,
    firstPage: (firstSalesPage.payload.records || []).length,
    secondPage: (secondSalesPage.payload.records || []).length,
    overlap: overlap.length,
    source: firstSalesPage.payload.source,
  };

  const connection = await request('http://localhost:3060/api/integrations/smartlife/test', { method: 'POST', headers: crmHeaders });
  result.connection = connection.payload.connected === true;

  const sync = await request('http://localhost:3060/api/integrations/smartlife/sync', { method: 'POST', headers: crmHeaders });
  result.sync = { status: sync.payload.status, records: sync.payload.records };

  const dashboard = await request('http://localhost:3060/api/dashboard', { headers: crmHeaders });
  result.dashboard = {
    status: dashboard.response.status,
    contacts: dashboard.payload.totalContacts,
    recentSalesInvoices: dashboard.payload.recentSalesInvoices?.length || 0,
  };

  const contacts = await request('http://localhost:3060/api/contacts', { headers: crmHeaders });
  /* Select a real legacy customer whose exact name exists in the synchronized
     SmartERP invoice snapshot. This proves Customer-360's local fallback with
     real data even while the live Sales module is permission-blocked. */
  const sourceParties = await sb.from('erp_financial_source_records').select('party_name')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', 'sales_invoice')
    .not('party_name', 'is', null).limit(200);
  const partyNames = [...new Set((sourceParties.data || []).map(row => row.party_name).filter(Boolean))];
  const matchingCustomers = partyNames.length
    ? await sb.from('customers').select('id').is('deleted_at', null).in('full_name', partyNames).limit(1)
    : { data: [] };
  const contact = (matchingCustomers.data || [])[0] || (contacts.payload.contacts || [])[0];
  if (contact?.id) {
    const detail = await request(`http://localhost:3060/api/contacts/${contact.id}`, { headers: crmHeaders });
    const finance = detail.payload.customer360?.smartErp;
    result.customer360 = {
      status: finance?.status,
      source: finance?.source,
      invoices: finance?.invoices?.length || 0,
      outstanding: finance?.summary?.outstanding || 0,
    };
  }

  for (const [name, url, headers, expectedStatus = 200] of [
    ['crmIntegrations','http://localhost:3060/integrations',crmHeaders],
    ['crmDashboard','http://localhost:3060/dashboard',crmHeaders],
    /* The legacy Accounting dashboard is intentionally retired by middleware
       and redirects to the active SmartLife sales-invoice workspace. */
    ['accountingDashboardRedirect','http://localhost:3050/dashboard',accountingHeaders,307],
    ['accountingSmartErp','http://localhost:3050/smartlife/sales-invoices',accountingHeaders],
    ['accountingPurchases','http://localhost:3050/smartlife/purchases',accountingHeaders],
    ['accountingReports','http://localhost:3050/smartlife/financial-reports',accountingHeaders],
    ['accountingAccountBalances','http://localhost:3050/smartlife/account-balances',accountingHeaders],
    ['inventoryProducts','http://localhost:3040/products',inventoryHeaders],
    ['quotePro','http://localhost:3030/quotations',quotationHeaders],
  ]) {
    const response = await fetch(url, { headers, redirect: 'manual' });
    if (response.status !== expectedStatus) throw new Error(`${name} page returned HTTP ${response.status}; expected ${expectedStatus}.`);
    result.pages[name] = response.status;
  }

  if (process.env.VERIFY_SMARTERP_PDF === '1' && sampleSalesId != null) {
    const encoded = encodeURIComponent(String(sampleSalesId));
    const zatca = await request(`http://localhost:3050/api/smartlife/sales-invoices/${encoded}/zatca`, { headers: accountingHeaders });
    const decoded = decodeZatcaTlvBase64(zatca.payload.payload);
    if (!zatca.payload.dataUrl?.startsWith('data:image/png;base64,') || Object.keys(decoded).join(',') !== '1,2,3,4,5') {
      throw new Error('SmartLife sales invoice ZATCA payload/image verification failed.');
    }
    result.zatca = {
      status: zatca.response.status, invoiceId: String(sampleSalesId),
      tags: Object.keys(decoded).map(Number), timestamp: decoded[3], total: decoded[4], vat: decoded[5],
    };
    const printResponse = await fetch(`http://localhost:3050/smartlife/sales-invoices/${encoded}/print`, { headers: accountingHeaders });
    if (printResponse.status !== 200) throw new Error(`SmartLife invoice print page returned HTTP ${printResponse.status}.`);
    const pdfResponse = await fetch(`http://localhost:3050/api/smartlife/sales-invoices/${encoded}/pdf`, { headers: accountingHeaders });
    const bytes = Buffer.from(await pdfResponse.arrayBuffer());
    if (pdfResponse.status !== 200 || !String(pdfResponse.headers.get('content-type')).includes('application/pdf') || bytes.subarray(0,4).toString() !== '%PDF') {
      throw new Error(`SmartLife invoice PDF verification failed (HTTP ${pdfResponse.status}).`);
    }
    const embeddedImages = (bytes.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length;
    if (embeddedImages < 2) throw new Error('SmartLife invoice PDF does not contain the expected logo and ZATCA QR image objects.');
    result.pdf = { status: pdfResponse.status, bytes: bytes.length, embeddedImages, contentType: pdfResponse.headers.get('content-type'), source: 'synchronized_snapshot' };
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error.message); process.exit(1); });
