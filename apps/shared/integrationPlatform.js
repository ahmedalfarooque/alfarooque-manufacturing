'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SMARTLIFE_RESOURCES = Object.freeze({
  products: 'products/index',
  customers: 'customers/index',
  suppliers: 'suppliers/index',
  'sales-invoices': 'sales/index',
  expenses: 'expenses/index',
  categories: 'categories/index',
  brands: 'brands/index',
  units: 'units/index',
  warehouses: 'warehouses/index',
  tax: 'tax/index',
});

/* SmartERP v1.0 ignores list filters supplied as query-string parameters — it
   reads them from the form-encoded POST body only (proven against the live
   API: passing start_period in the query echoes back an empty `filters`
   object, while passing it in the body echoes the value AND changes `total`).
   Sending an empty body is why sales/index reported total=0 and
   suppliers/index returned 20 of 177 rows: the server fell back to its own
   default (unfiltered, limit 0). token+company must stay in the query string —
   moving them into the body fails authentication. */
const BODY_FIELDS = new Set([
  'q', 'code', 'page', 'limit',
  'reference_no', 'start_period', 'end_period',
  'customer', 'customer_id', 'warehouse_id', 'biller', 'biller_id',
  'sale_status', 'payment_status', 'created_by',
  'company', 'name', 'category_id', 'brand_id',
  'cf1', 'cf2', 'cf3', 'cf4', 'cf5', 'cf6',
]);
const DEFAULT_PAGE_LIMIT = 500;
/* Ascending page sizes tried by readAllSmartLife. 500 is the largest value the
   live API honours for sales/index (1000 returns zero rows). */
const PAGE_LIMIT_LADDER = [200, 500];
const SALES_PERIOD_REQUIRED = new Set(['sales-invoices']);
const EARLIEST_SALES_PERIOD = '2000-01-01';
const TOKEN_TTL_MS = 4 * 60 * 1000;
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

function loadRootEnvironment() {
  const file = path.resolve(__dirname, '..', '..', '.env.local');
  let content;
  try { content = fs.readFileSync(file, 'utf8'); }
  catch (_) { return; }
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

function resourceUrl(config, resource, token) {
  const endpoint = SMARTLIFE_RESOURCES[resource];
  if (!endpoint) throw new IntegrationConfigurationError('Unsupported SmartERP read-only resource.');
  const url = new URL(endpoint, config.baseUrl);
  url.searchParams.set('token', token);
  url.searchParams.set('company', config.company);
  return url;
}

/* Documented list filters, form-encoded into the POST body. `limit` defaults to
   DEFAULT_PAGE_LIMIT so a caller that asks for no pagination still receives a
   full page instead of the server's truncated default. */
function resourceBody(resource, query = {}) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (BODY_FIELDS.has(key) && value !== undefined && value !== null && String(value).trim()) {
      body.set(key, String(value).trim());
    }
  }
  if (!body.has('limit')) body.set('limit', String(DEFAULT_PAGE_LIMIT));
  /* sales/index returns total=0 unless start_period is supplied — verified
     against the live API: start_period alone yields all 488 sales, while
     limit-only or end_period-only yields 0. Default to an open-ended lower
     bound so the invoice list is complete when the caller supplies no range;
     an explicit start_period from the caller always wins. */
  if (SALES_PERIOD_REQUIRED.has(resource) && !body.has('start_period')) {
    body.set('start_period', EARLIEST_SALES_PERIOD);
  }
  return body;
}

function recordsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['data', 'items', 'results', 'records']) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && typeof payload[key] === 'object') return [payload[key]];
  }
  return [];
}

async function requestJson(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`SmartERP returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload?.error === true) throw new Error('SmartERP rejected the read-only request.');
    return payload;
  } finally { clearTimeout(timeout); }
}

async function authenticateSmartErp(config, force = false) {
  const cacheKey = crypto.createHash('sha256').update(`${config.baseUrl}\0${config.company}\0${config.username}`).digest('hex');
  if (!force && tokenCache?.key === cacheKey && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const body = new URLSearchParams({ company: config.company, username: config.username, password: config.password });
  const payload = await requestJson(new URL('login', config.baseUrl), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!payload?.token || typeof payload.token !== 'string') throw new Error('SmartERP authentication did not return a token.');
  if (payload.company && String(payload.company) !== config.company) throw new Error('SmartERP authenticated a different company.');
  tokenCache = { key: cacheKey, token: payload.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return payload.token;
}

/* Walks every SmartERP page for a resource instead of returning only the first.
   SmartERP reports the full match count in `total` while returning at most
   `limit` rows, so a single read would silently store a fraction of the data
   (e.g. 200 of 488 sales). Deduplicates by SmartERP id across pages and stops
   as soon as a page repeats or `total` is reached, so it terminates even if the
   provider ignores `page`. */
async function readAllSmartLife(sb, resource, query = {}, { maxPages = 50 } = {}) {
  const seen = new Set();
  const records = [];
  const absorb = (batch) => {
    let added = 0;
    for (const record of batch || []) {
      const id = record?.id ?? record?.reference_no ?? record?.code ?? null;
      const key = id == null ? crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex') : String(id);
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(record);
      added += 1;
    }
    return added;
  };

  /* Escalate `limit` on a single unpaged request first. SmartERP honours large
     limits (500 returns all 488 sales in one call) but rejects over-large ones
     by returning zero rows, and adding `page` to sales/index also returns zero —
     so an unpaged high-limit read is both the most complete and the most
     reliable path. Never treat a zero-row response as "no data" when a smaller
     limit already returned rows. */
  let total = null;
  for (const limit of PAGE_LIMIT_LADDER) {
    const result = await readSmartLife(sb, resource, { ...query, limit: String(limit) });
    const batch = result.records || [];
    const reported = Number(result.providerPayload?.total);
    if (!batch.length) continue;
    if (Number.isFinite(reported) && reported > 0) total = reported;
    if (batch.length > records.length) { seen.clear(); records.length = 0; absorb(batch); }
    if (total !== null && records.length >= total) return { records, total };
  }
  if (total === null) total = records.length;
  if (records.length >= total) return { records, total };

  /* Still short: fall back to page walking, but abandon it the moment a page
     yields nothing new so a provider that ignores//rejects `page` cannot spin. */
  for (let page = 2; page <= maxPages; page += 1) {
    const result = await readSmartLife(sb, resource, { ...query, page: String(page), limit: String(PAGE_LIMIT_LADDER[0]) });
    if (!absorb(result.records)) break;
    if (records.length >= total) break;
  }
  return { records, total };
}

async function readSmartLife(sb, resource, query = {}) {
  const config = await getSmartLifeConfig(sb);
  let token = await authenticateSmartErp(config);
  try {
    const payload = await requestJson(resourceUrl(config, resource, token), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: resourceBody(resource, query),
    });
    return { records: recordsFrom(payload), providerPayload: payload };
  } catch (error) {
    if (!/HTTP 401|HTTP 403|rejected/.test(error?.message || '')) throw error;
    tokenCache = null;
    token = await authenticateSmartErp(config, true);
    const payload = await requestJson(resourceUrl(config, resource, token), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: resourceBody(resource, query),
    });
    return { records: recordsFrom(payload), providerPayload: payload };
  }
}

async function auditIntegration(sb, integrationId, actorId, action, details = {}) {
  await sb.from('crm_integration_audit_logs').insert({ integration_id: integrationId || null, actor_id: actorId || null, action, details });
}

function clearSmartErpTokenForTests() { tokenCache = null; }

module.exports = {
  SMARTLIFE_RESOURCES, SMARTERP_WRITE_AUTHORIZATION_PHRASE,
  IntegrationConfigurationError, SmartErpWriteAuthorizationError,
  smartErpWritePermissionNotice, requireSmartErpWriteAuthorization, auditSmartErpWriteAuthorization,
  encryptSecrets, decryptSecrets,
  getIntegration, getSmartLifeConfig, hasSmartErpEnvironment, recordsFrom,
  authenticateSmartErp, readSmartLife, readAllSmartLife, auditIntegration, clearSmartErpTokenForTests,
};
