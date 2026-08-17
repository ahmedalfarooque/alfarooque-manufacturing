'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* SmartERP V3 — verified against the attached OpenAPI specification (base
   https://smarterp.top/api/v3/). Every path below is copied verbatim from that
   spec; none is guessed. V1.0 is retired: it is no longer used as a production
   data source anywhere in this codebase. */
const SMARTLIFE_RESOURCES = Object.freeze({
  products: 'products/get_products_list',
  customers: 'clients/clients_list',
  suppliers: 'supplier/suppliers_list',
  'sales-invoices': 'sales/sales_list',
  purchases: 'purchase/purchases_list',
  categories: 'category/get_categories',
  brands: 'brands/get_brands',
  units: 'units/get_units',
  warehouses: 'branch/branches_list',
  tax: 'tax/tax_list',
  'gift-cards': 'gifts_cards/get_gifts_cards',
  coupons: 'coupons/get_coupons',
  accounts: 'accounting/accounts',
  'cost-centers': 'accounting/costcenters',
  users: 'user/users_list',
  cashiers: 'user/cashiers_list',
});

/* Single-record GET-by-id endpoints, verbatim from the spec. */
const SMARTLIFE_DETAIL_RESOURCES = Object.freeze({
  products: 'products/product/{id}',
  customers: 'clients/get_client/{id}',
  suppliers: 'supplier/get_supplier/{id}',
  'sales-invoices': 'sales/get_sale/{id}',
  purchases: 'purchase/get_purchase/{id}',
  accounts: 'accounting/get_entry/{id}',
  brands: 'brands/get_brand/{id}',
  categories: 'category/get_category/{id}',
  units: 'units/get_unit/{id}',
  warehouses: 'branch/branch/{id}',
  tax: 'tax/get_tax/{id}',
  'gift-cards': 'gifts_cards/get_gifts_card/{id}',
  coupons: 'coupons/get_coupon/{id}',
});

/* Statistics/aggregate GET endpoints, verbatim from the spec. All take `period`. */
const SMARTLIFE_STATS = Object.freeze({
  'debt-suppliers': 'statics/debt_suppliers',
  'debt-customers': 'statics/debt_customers',
  'top-products': 'statics/top_products',
  'top-cashiers': 'statics/top_cashiers',
  'top-suppliers': 'statics/top_suppliers',
  'top-customers': 'statics/top_customers',
  'sales-branches': 'statics/sales_branches',
  sales: 'statics/sales',
  expenses: 'statics/expenses',
});

/* Other documented read-only endpoints outside the list/detail/stats shape,
   exposed through their own helpers below rather than the generic resource map. */
const SMARTLIFE_MISC_READ = Object.freeze({
  clientSales: 'clients/client_sales_list/{id}',
  clientsBalance: 'clients/clients_balance',
  suppliersBalance: 'supplier/suppiers_balance',
  productsBalance: 'products/products_balance',
  productsMovements: 'products/get_products_movements',
  inventoryMovements: 'products/get_inventory_movements',
  accountBalances: 'accounting/account_balances',
  salesReferences: 'sales/sales_refererences',
  salesPaymentStatuses: 'sales/payment_statuses',
  salesStatuses: 'sales/sale_statuses',
  purchasesReferences: 'purchase/purchases_refererences',
  purchaseStatusList: 'purchase/purchase_status_list',
  companySettings: 'company/company_settings',
  userProfile: 'user/profile_info',
});

/* Structural write protection (section 4/44): every path this module will ever
   request against SmartERP is enumerated here. Anything not in this set — or
   any method other than GET (except the dedicated login POST) — is rejected
   before a request is built. This is enforced in code, not just by omission:
   see assertAllowedReadPath() and smartErpRequest() below. */
const ALL_READ_PATH_TEMPLATES = [
  ...Object.values(SMARTLIFE_RESOURCES),
  ...Object.values(SMARTLIFE_DETAIL_RESOURCES),
  ...Object.values(SMARTLIFE_STATS),
  ...Object.values(SMARTLIFE_MISC_READ),
];
const ALLOWED_READ_PATH_PATTERNS = ALL_READ_PATH_TEMPLATES.map(
  template => new RegExp(`^${template.replace(/\{id\}/g, '\\d+')}$`),
);

/* Query parameters the spec actually documents across list/detail/stat
   endpoints. Anything else supplied by a caller is dropped rather than
   forwarded, so an unrelated field can never smuggle a write-shaped payload
   through the read-only path. */
const QUERY_FIELDS = new Set([
  'search', 'offset', 'limit', 'warehouse_id', 'customer', 'customer_id',
  'biller', 'reference_no', 'payment_status', 'sale_status', 'sort_type',
  'sort_by', 'period', 'group_by', 'id', 'name', 'code', 'type',
]);
const DEFAULT_PAGE_LIMIT = 100;
const TOKEN_TTL_MS = 10 * 60 * 1000;
const SMARTERP_WRITE_AUTHORIZATION_PHRASE = 'AUTHORIZE SMARTERP CHANGE';
let tokenCache = null;

class IntegrationConfigurationError extends Error {}
class SmartErpWriteAuthorizationError extends Error {
  constructor(message, notice) {
    super(message);
    this.name = 'SmartErpWriteAuthorizationError';
    this.code = 'SMARTERP_WRITE_PERMISSION_REQUIRED';
    this.status = 403;
    this.notice = notice;
  }
}
/* Thrown only by a defect in this file's own code (an unlisted path, or a
   non-GET verb reaching smartErpRequest) — never reachable from caller input. */
class SmartErpReadOnlyViolation extends Error {}

function smartErpWritePermissionNotice({ target = 'SmartLife / SmartERP', record, action } = {}) {
  return {
    tone: 'danger',
    color: 'red',
    title: 'SMARTERP WRITE PERMISSION REQUIRED',
    message: 'This action will modify data in SmartLife / SmartERP and requires separate explicit authorization.',
    target: String(target || 'SmartLife / SmartERP'),
    record: String(record || 'Unspecified record'),
    action: String(action || 'Unspecified action'),
    authorizationPhrase: SMARTERP_WRITE_AUTHORIZATION_PHRASE,
  };
}

function requireSmartErpWriteAuthorization({ target, record, action, authorization } = {}) {
  const notice = smartErpWritePermissionNotice({ target, record, action });
  const matches = authorization?.confirmed === true
    && authorization?.phrase === SMARTERP_WRITE_AUTHORIZATION_PHRASE
    && authorization?.target === notice.target
    && authorization?.record === notice.record
    && authorization?.action === notice.action;
  if (!matches) {
    throw new SmartErpWriteAuthorizationError(
      'Explicit SmartERP write authorization is required for this exact target, record, and action.',
      notice,
    );
  }
  return { authorized: true, target: notice.target, record: notice.record, action: notice.action };
}

async function auditSmartErpWriteAuthorization(sb, integrationId, actorId, authorization, outcome = 'authorized') {
  if (!authorization?.authorized) throw new SmartErpWriteAuthorizationError(
    'A verified SmartERP write authorization receipt is required before auditing.',
    smartErpWritePermissionNotice(authorization),
  );
  await auditIntegration(sb, integrationId, actorId, 'smarterp.write_authorization', {
    target: authorization.target,
    record: authorization.record,
    requestedAction: authorization.action,
    outcome,
  });
}

/* Root .env.local (SMARTLIFE_* credentials, INTEGRATION_ENCRYPTION_KEY) lives
   three directories above every consumer of this file — but __dirname
   resolved through Next.js's server webpack bundle does not reliably match
   this file's real on-disk location (verified live: a plain `node` process
   requiring this file resolves __dirname correctly and loads the env fine;
   the identical code running inside a Next.js dev server for apps/crm or
   apps/accounting silently failed to find the file and every SmartERP call
   then threw "server configuration is incomplete", masquerading as a
   connection/endpoint problem). Try every plausible anchor instead of
   trusting __dirname alone — cwd is set by Next.js to the app's own
   directory (apps/<app>) when `next dev`/`next start` runs, so it's a
   second, independent way to reach the repo root. */
function loadRootEnvironment() {
  const candidates = [
    path.resolve(__dirname, '..', '..', '.env.local'),
    path.resolve(process.cwd(), '..', '..', '.env.local'),
    path.resolve(process.cwd(), '.env.local'),
  ];
  let content;
  for (const file of candidates) {
    try { content = fs.readFileSync(file, 'utf8'); break; }
    catch (_) { /* try the next candidate */ }
  }
  if (content === undefined) return;
  for (const line of content.split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const index = text.indexOf('=');
    if (index < 1) continue;
    const key = text.slice(0, index).trim();
    let value = text.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadRootEnvironment();

function encryptionKey() {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) throw new IntegrationConfigurationError('Integration encryption key is not configured.');
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecrets(secrets) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secrets), 'utf8'), cipher.final()]);
  return { secret_ciphertext: ciphertext.toString('base64'), secret_iv: iv.toString('base64'), secret_tag: cipher.getAuthTag().toString('base64') };
}

function decryptSecrets(row) {
  if (!row?.secret_ciphertext) return {};
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.secret_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.secret_tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(row.secret_ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}

function environmentSmartErpConfig() {
  return {
    baseUrl: (process.env.SMARTLIFE_API_BASE_URL || '').trim(),
    company: (process.env.SMARTLIFE_COMPANY || '').trim(),
    username: (process.env.SMARTLIFE_USERNAME || '').trim(),
    password: process.env.SMARTLIFE_PASSWORD || '',
  };
}

function hasSmartErpEnvironment() {
  const config = environmentSmartErpConfig();
  return Boolean(config.baseUrl && config.company && config.username && config.password);
}

async function getIntegration(sb, key) {
  const { data, error } = await sb.from('crm_integrations').select('*').eq('tenant_id', 'alfarooque').eq('integration_key', key).maybeSingle();
  if (error) throw error;
  return data;
}

async function getSmartLifeConfig(sb) {
  const row = sb ? await getIntegration(sb, 'smartlife') : null;
  const config = environmentSmartErpConfig();
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new IntegrationConfigurationError(`SmartERP server configuration is incomplete (${missing.join(', ')}).`);
  let base;
  try { base = new URL(config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`); }
  catch (_) { throw new IntegrationConfigurationError('SmartERP API base URL is invalid.'); }
  if (base.protocol !== 'https:' && base.hostname !== 'localhost') throw new IntegrationConfigurationError('SmartERP API requests must use HTTPS.');
  return { row, ...config, baseUrl: base.toString() };
}

function assertAllowedReadPath(pathname) {
  const clean = pathname.replace(/^\/*api\/v3\/?/, '').replace(/^\/+/, '');
  if (!ALLOWED_READ_PATH_PATTERNS.some(pattern => pattern.test(clean))) {
    throw new SmartErpReadOnlyViolation(`SmartERP path "${clean}" is not on the verified V3 read-only allow-list.`);
  }
}

function resourceUrl(config, endpointPath, query = {}) {
  const url = new URL(endpointPath, config.baseUrl);
  for (const [key, value] of Object.entries(query || {})) {
    if (QUERY_FIELDS.has(key) && value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value).trim());
    }
  }
  if (!url.searchParams.has('limit')) url.searchParams.set('limit', String(DEFAULT_PAGE_LIMIT));
  if (!url.searchParams.has('offset')) url.searchParams.set('offset', '0');
  return url;
}

function recordsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['data', 'items', 'results', 'records', 'list']) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && typeof payload[key] === 'object') return [payload[key]];
  }
  return [];
}

function totalFrom(payload) {
  const candidate = payload?.total ?? payload?.total_count ?? payload?.count ?? payload?.meta?.total;
  const value = Number(candidate);
  return Number.isFinite(value) ? value : null;
}

/* Stable local identity for a SmartERP source record. The V3 resources use
   slightly different id field names, so keep the complete verified set in one
   place. A content hash is only a last resort for provider rows that expose no
   identity at all; normal customer/product/invoice rows always use their
   SmartERP id/code/reference and therefore upsert instead of duplicating. */
function smartErpSourceRecordId(record) {
  const candidates = [
    'id', 'invoice_id', 'client_id', 'customer_id', 'supplier_id', 'product_id',
    'category_id', 'brand_id', 'unit_id', 'branch_id', 'warehouse_id',
    'account_id', 'cost_center_id', 'user_id', 'cashier_id', 'gift_card_id',
    'coupon_id', 'reference_no', 'invoice_number', 'number', 'reference', 'code',
  ];
  for (const key of candidates) {
    if (record?.[key] !== undefined && record?.[key] !== null && String(record[key]).trim()) {
      return String(record[key]).trim();
    }
  }
  return crypto.createHash('sha256').update(JSON.stringify(record || {})).digest('hex');
}

function normalizeSmartErpSourceMapping(resource, record, synchronizedAt = new Date().toISOString()) {
  if (!SMARTLIFE_RESOURCES[resource] || !record || typeof record !== 'object') return null;
  const raw = JSON.parse(JSON.stringify(record));
  const sourceRecordId = smartErpSourceRecordId(raw);
  const sourceUpdatedAt = raw.updated_at || raw.modified_at || raw.last_update || null;
  return {
    tenant_id: 'alfarooque', source_system: 'smartlife', entity_type: resource,
    source_record_id: sourceRecordId, sync_status: 'synced',
    source_updated_at: sourceUpdatedAt, last_synced_at: synchronizedAt,
    metadata: {
      provider: 'SmartERP', direction: 'pull', read_only: true,
      source_reference: raw.reference_no || raw.invoice_number || raw.number || raw.reference || raw.code || sourceRecordId,
      source_name: raw.name || raw.customer_name || raw.supplier_name || raw.company || raw.title || null,
      raw_payload: raw,
    },
    updated_at: synchronizedAt,
  };
}

async function upsertSmartErpSourceMappings(sb, resource, records) {
  const synchronizedAt = new Date().toISOString();
  const rows = (records || []).map(record => normalizeSmartErpSourceMapping(resource, record, synchronizedAt)).filter(Boolean);
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await sb.from('crm_record_mappings').upsert(rows.slice(offset, offset + 500), {
      onConflict: 'tenant_id,source_system,entity_type,source_record_id', ignoreDuplicates: false,
    });
    if (error) throw error;
  }
  return rows.length;
}

/* Read the latest local snapshot without pretending the source is live. This
   reuses crm_record_mappings for general resources and the existing normalized
   financial snapshot for invoices. Callers still return the real live
   permission/connection classification alongside these records. */
async function readSmartErpSnapshot(sb, resource, query = {}) {
  const offset = Math.max(0, Number(query.offset) || 0);
  const limit = Math.min(500, Math.max(1, Number(query.limit) || DEFAULT_PAGE_LIMIT));
  const search = String(query.search || '').trim().toLowerCase();
  const exactId = String(query.id || '').trim();
  const selectLimit = search ? 5000 : limit;
  let mappingQuery = sb.from('crm_record_mappings')
    .select('source_record_id,metadata,last_synced_at', { count: 'exact' })
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('entity_type', resource)
    .order('updated_at', { ascending: false })
    .order('source_record_id', { ascending: true });
  if (exactId) mappingQuery = mappingQuery.eq('source_record_id', exactId);
  mappingQuery = search ? mappingQuery.limit(selectLimit) : mappingQuery.range(offset, offset + limit - 1);
  const mappingResult = await mappingQuery;
  const emptyMappingRange = mappingResult.error && (mappingResult.error.code === 'PGRST103' || /requested range not satisfiable/i.test(mappingResult.error.message || ''));
  if (mappingResult.error && !emptyMappingRange) throw mappingResult.error;
  let mappingRows = emptyMappingRange ? [] : (mappingResult.data || []);
  if (search) mappingRows = mappingRows.filter(row => JSON.stringify(row.metadata?.raw_payload || {}).toLowerCase().includes(search));
  const mappingTotal = emptyMappingRange ? 0 : (search ? mappingRows.length : (mappingResult.count || mappingRows.length));
  if (search) mappingRows = mappingRows.slice(offset, offset + limit);
  if (mappingRows.length || mappingTotal) {
    return {
      records: mappingRows.map(row => row.metadata?.raw_payload).filter(Boolean),
      total: mappingTotal, offset, limit,
      lastSyncedAt: mappingRows[0]?.last_synced_at || null,
    };
  }

  const recordType = resource === 'sales-invoices' ? 'sales_invoice' : resource === 'purchases' ? 'purchase_invoice' : null;
  if (!recordType) return { records: [], total: 0, offset, limit, lastSyncedAt: null };
  let financialQuery = sb.from('erp_financial_source_records')
    .select('raw_payload,last_synced_at', { count: 'exact' })
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', recordType)
    .order('last_synced_at', { ascending: false })
    .order('external_id', { ascending: true });
  if (exactId) financialQuery = financialQuery.eq('external_id', exactId);
  financialQuery = search ? financialQuery.limit(selectLimit) : financialQuery.range(offset, offset + limit - 1);
  const financialResult = await financialQuery;
  const emptyFinancialRange = financialResult.error && (financialResult.error.code === 'PGRST103' || /requested range not satisfiable/i.test(financialResult.error.message || ''));
  if (financialResult.error && !emptyFinancialRange) throw financialResult.error;
  let financialRows = emptyFinancialRange ? [] : (financialResult.data || []);
  if (search) financialRows = financialRows.filter(row => JSON.stringify(row.raw_payload || {}).toLowerCase().includes(search));
  const financialTotal = emptyFinancialRange ? 0 : (search ? financialRows.length : (financialResult.count || financialRows.length));
  if (search) financialRows = financialRows.slice(offset, offset + limit);
  return {
    records: financialRows.map(row => row.raw_payload).filter(Boolean),
    total: financialTotal, offset, limit,
    lastSyncedAt: financialRows[0]?.last_synced_at || null,
  };
}

/* Every SmartERP HTTP request — read or the one-time login — passes through
   here. Non-login requests are hard-blocked to GET against the verified
   read-only allow-list before a request is ever built, independent of what
   any caller in this codebase asks for. */
async function smartErpRequest(url, { method = 'GET', headers = {}, body, isLogin = false } = {}, timeoutMs = 15000) {
  if (isLogin) {
    if (method !== 'POST') throw new SmartErpReadOnlyViolation('SmartERP login must use POST.');
  } else {
    if (method !== 'GET') throw new SmartErpReadOnlyViolation(`SmartERP integration is READ-ONLY. Write operations are disabled (attempted ${method}).`);
    assertAllowedReadPath(url.pathname);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetch(url, { method, headers, body, cache: 'no-store', signal: controller.signal });
    } catch (networkError) {
      /* Genuine network failure — DNS, refused connection, timeout abort —
         as opposed to SmartERP responding with an error status. Tagged so
         classifySmartErpError() can tell "SmartERP is unreachable" apart
         from "SmartERP responded but denied/rejected the request". */
      networkError.isNetworkFailure = true;
      throw networkError;
    }
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : {}; } catch (_) {
      /* A non-JSON body (typically an HTML login page) at a URL that should
         return JSON means the path itself doesn't exist at this API
         version/base — distinct from an authenticated-but-denied module. */
      const parseError = new Error(`SmartERP returned a non-JSON response (HTTP ${response.status}).`);
      parseError.status = response.status;
      parseError.isNonJson = true;
      throw parseError;
    }
    /* Surface SmartERP's own error message (e.g. its exact per-module
       permission-denied text) before falling back to a generic HTTP status —
       otherwise a real, actionable reason gets discarded in favor of "HTTP 401". */
    if (!response.ok || payload?.success === false || payload?.error === true) {
      const err = new Error(payload?.message || `SmartERP returned HTTP ${response.status}.`);
      err.status = response.status;
      throw err;
    }
    return payload;
  } finally { clearTimeout(timeout); }
}

async function authenticateSmartErp(config, force = false) {
  const cacheKey = crypto.createHash('sha256').update(`${config.baseUrl}\0${config.company}\0${config.username}`).digest('hex');
  if (!force && tokenCache?.key === cacheKey && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const body = new URLSearchParams({
    login_company: config.company,
    username: config.username,
    password: config.password,
    app_type: 'desktop',
    app_version: '1.0.0',
  });
  const payload = await smartErpRequest(new URL('user/login', config.baseUrl), {
    method: 'POST',
    isLogin: true,
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'app-lang': 'arabic' },
    body,
  });
  if (payload?.logged_in === false || payload?.success === false) throw new Error('SmartERP authentication was rejected.');
  if (!payload?.access_token || typeof payload.access_token !== 'string') throw new Error('SmartERP authentication did not return an access token.');
  if (payload.company && String(payload.company) !== config.company) throw new Error('SmartERP authenticated a different company.');
  tokenCache = { key: cacheKey, token: payload.access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return payload.access_token;
}

function authHeaders(token) {
  return { Accept: 'application/json', Authorization: token, 'app-lang': 'arabic' };
}

async function readSmartLifePath(sb, endpointPath, query = {}) {
  const config = await getSmartLifeConfig(sb);
  let token = await authenticateSmartErp(config);
  const url = resourceUrl(config, endpointPath, query);
  try {
    const payload = await smartErpRequest(url, { method: 'GET', headers: authHeaders(token) });
    return { records: recordsFrom(payload), providerPayload: payload };
  } catch (error) {
    /* Only an expired/invalid token is worth a fresh login + single retry.
       A module-permission denial (also HTTP 401, but the account IS
       authenticated — see classifySmartErpError callers) would just fail the
       same way twice, so still retry it once here for safety, but never loop
       beyond that — the caller classifies the final error either way. */
    if (error?.status !== 401 && error?.status !== 403) throw error;
    tokenCache = null;
    token = await authenticateSmartErp(config, true);
    const payload = await smartErpRequest(url, { method: 'GET', headers: authHeaders(token) });
    return { records: recordsFrom(payload), providerPayload: payload };
  }
}

async function readSmartLife(sb, resource, query = {}) {
  const endpointPath = SMARTLIFE_RESOURCES[resource];
  if (!endpointPath) throw new IntegrationConfigurationError('Unsupported SmartERP read-only resource.');
  return readSmartLifePath(sb, endpointPath, query);
}

/* GET-by-id detail read. */
async function readSmartLifeDetail(sb, resource, id, query = {}) {
  const template = SMARTLIFE_DETAIL_RESOURCES[resource];
  if (!template) throw new IntegrationConfigurationError('Unsupported SmartERP read-only detail resource.');
  if (!/^\d+$/.test(String(id))) throw new IntegrationConfigurationError('SmartERP record id must be numeric.');
  const endpointPath = template.replace('{id}', String(id));
  const result = await readSmartLifePath(sb, endpointPath, query);
  return { record: result.records[0] || result.providerPayload, providerPayload: result.providerPayload };
}

/* GET statistics/aggregate read (top products, debt customers, sales, etc). */
async function readSmartLifeStat(sb, statKey, query = {}) {
  const endpointPath = SMARTLIFE_STATS[statKey];
  if (!endpointPath) throw new IntegrationConfigurationError('Unsupported SmartERP statistics resource.');
  return readSmartLifePath(sb, endpointPath, query);
}

async function readAccountBalances(sb, query = {}) {
  return readSmartLifePath(sb, SMARTLIFE_MISC_READ.accountBalances, query);
}

/* Product Balances — verified V3 miscellaneous read endpoint
   (products/products_balance), same shape/auth path as account-balances. */
async function readProductBalances(sb, query = {}) {
  return readSmartLifePath(sb, SMARTLIFE_MISC_READ.productsBalance, query);
}

/* Inventory Movement — verified V3 endpoint (products/get_inventory_movements).
   Returns a MONTHLY cost trend ({date range, from, to, total_cost} per
   month), not a daily transaction ledger — labeled as such in the UI, never
   presented as "Daily Move" (which SmartERP does not expose). */
async function readInventoryMovements(sb, query = {}) {
  return readSmartLifePath(sb, SMARTLIFE_MISC_READ.inventoryMovements, query);
}

/* Walks every SmartERP page for a resource using the spec's documented
   offset/limit pagination. Stops the moment a page returns fewer rows than
   the requested limit (the standard "short page = last page" signal) or when
   the provider's own reported total is reached — whichever comes first.
   Deduplicates by SmartERP id across pages so a resource that ignores offset
   cannot produce duplicate rows. */
async function readAllSmartLife(sb, resource, query = {}, { maxPages = 100 } = {}) {
  const limit = Number(query.limit) || DEFAULT_PAGE_LIMIT;
  let offset = Number(query.offset) || 0;
  const seen = new Set();
  const records = [];
  let total = null;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await readSmartLife(sb, resource, { ...query, offset: String(offset), limit: String(limit) });
    const batch = result.records || [];
    const reported = totalFrom(result.providerPayload);
    if (reported !== null && reported > 0) total = reported;

    for (const record of batch) {
      const id = record?.id ?? record?.reference_no ?? record?.code ?? null;
      const key = id == null ? crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex') : String(id);
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(record);
    }

    if (!batch.length || batch.length < limit) break;
    if (total !== null && records.length >= total) break;
    offset += limit;
  }
  return { records, total: total ?? records.length };
}

async function auditIntegration(sb, integrationId, actorId, action, details = {}) {
  await sb.from('crm_integration_audit_logs').insert({ integration_id: integrationId || null, actor_id: actorId || null, action, details });
}

/* Single source of truth for turning a thrown error from readSmartLife* into
   one of five states, so the sync route and every read-path API route agree:
   - 'connected'                  — not actually thrown; caller only classifies on error
   - 'permission_required'       — SmartERP authenticated the account but denied this module
                                    (verified live message: "The user is unauthorized to access
                                    the requested resource", always HTTP 401)
   - 'endpoint_or_version_mismatch' — response wasn't JSON (e.g. an HTML login
                                    page) — the path itself doesn't exist at this API version/base
   - 'connection_error'          — network failure reaching SmartERP at all (DNS, refused, timeout)
   - 'other_error'               — SmartERP responded with a real error that isn't a permission denial
   Accepts either an Error object (preferred — carries .status/.isNonJson/.isNetworkFailure)
   or a plain message string for backward compatibility. */
function classifySmartErpError(error) {
  const message = typeof error === 'string' ? error : (error?.message || '');
  if (error && typeof error === 'object') {
    if (error.isNetworkFailure || error.name === 'AbortError') return 'connection_error';
    if (error.isNonJson) return 'endpoint_or_version_mismatch';
    if (error.status === 401 && /unauthorized to access the requested resource/i.test(message)) return 'permission_required';
    return 'other_error';
  }
  return /unauthorized to access the requested resource/i.test(message) ? 'permission_required' : 'other_error';
}

function clearSmartErpTokenForTests() { tokenCache = null; }

module.exports = {
  SMARTLIFE_RESOURCES, SMARTLIFE_DETAIL_RESOURCES, SMARTLIFE_STATS, SMARTLIFE_MISC_READ,
  SMARTERP_WRITE_AUTHORIZATION_PHRASE,
  IntegrationConfigurationError, SmartErpWriteAuthorizationError, SmartErpReadOnlyViolation,
  smartErpWritePermissionNotice, requireSmartErpWriteAuthorization, auditSmartErpWriteAuthorization,
  encryptSecrets, decryptSecrets,
  getIntegration, getSmartLifeConfig, hasSmartErpEnvironment, recordsFrom,
  authenticateSmartErp, readSmartLife, readSmartLifeDetail, readSmartLifeStat, readAccountBalances, readProductBalances, readInventoryMovements,
  readAllSmartLife, normalizeSmartErpSourceMapping, upsertSmartErpSourceMappings, readSmartErpSnapshot,
  auditIntegration, clearSmartErpTokenForTests, classifySmartErpError,
  __testables: { smartErpRequest, assertAllowedReadPath },
};
