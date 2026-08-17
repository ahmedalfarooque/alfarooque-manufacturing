'use strict';

/* Read-only localhost regression: selects real short/middle/long QuotePro
   quotations and SmartLife sales-invoice snapshots, downloads them through
   the production PDF routes, and verifies A4/page counts. No data or files
   are created. */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(file) {
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;
    const index = text.indexOf('=');
    if (index < 1) continue;
    let value = text.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[text.slice(0, index).trim()] = value;
  }
  return values;
}

function pdfFacts(buffer) {
  const source = buffer.toString('latin1');
  const pages = (source.match(/\/Type\s*\/Page\b/g) || []).length;
  const media = source.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  return { pages, width: media ? Number(media[1]) : null, height: media ? Number(media[2]) : null };
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function representatives(rows) {
  const ordered = [...rows].sort((a, b) => a.items - b.items);
  if (!ordered.length) return [];
  return [ordered[0], ordered[Math.floor(ordered.length / 2)], ordered[ordered.length - 1]]
    .filter((row, index, all) => all.findIndex(other => other.id === row.id) === index);
}

async function main() {
  const quoteEnv = loadEnv(path.join(__dirname, '..', '.env.local'));
  const accountingEnv = loadEnv(path.join(__dirname, '..', '..', 'accounting', '.env.local'));
  if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
  const sb = createClient(quoteEnv.SUPABASE_URL, quoteEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: actor, error: actorError } = await sb.from('platform_users').select('id,email').eq('role', 'admin').eq('is_active', true).limit(1).single();
  if (actorError) throw actorError;
  const { data: quotations, error: quoteError } = await sb.from('qt_quotations')
    .select('id,quote_number,products:qt_quotation_products(id)').is('deleted_at', null).limit(200);
  if (quoteError) throw quoteError;
  const quoteRows = (quotations || []).map(row => ({ id: row.id, number: row.quote_number, items: row.products?.length || 0 }));
  const { data: snapshots, error: invoiceError } = await sb.from('erp_financial_source_records').select('external_id,raw_payload')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', 'sales_invoice').limit(1000);
  if (invoiceError) throw invoiceError;
  const invoiceRows = (snapshots || []).map(row => ({
    id: String(row.raw_payload?.id || row.external_id || ''),
    number: row.raw_payload?.invoice_number || row.raw_payload?.reference_no || row.external_id,
    items: Array.isArray(row.raw_payload?.items) ? row.raw_payload.items.length : 0,
  })).filter(row => row.id);

  const quoteCookie = 'af_quotation_session=' + jwt.sign({ sub: actor.id, email: actor.email, role: 'admin', app: 'quotation' }, quoteEnv.JWT_SECRET, { expiresIn: 300 });
  const accountingCookie = 'af_accounting_session=' + jwt.sign({ sub: actor.id, email: actor.email, role: 'admin', app: 'accounting' }, accountingEnv.JWT_SECRET, { expiresIn: 300 });
  const cases = [
    ...representatives(quoteRows).map(row => ({ ...row, type: 'quotation', url: `http://localhost:3030/api/quotations/${row.id}/pdf`, cookie: quoteCookie })),
    ...representatives(invoiceRows).map(row => ({ ...row, type: 'sales-invoice', url: `http://localhost:3050/api/smartlife/sales-invoices/${row.id}/pdf`, cookie: accountingCookie })),
  ];
  const results = [];
  for (const item of cases) {
    const response = await fetch(item.url, { headers: { Cookie: item.cookie } });
    const buffer = Buffer.from(await response.arrayBuffer());
    assert(response.status === 200, `${item.type} ${item.number} PDF returned HTTP ${response.status}.`);
    assert((response.headers.get('content-type') || '').includes('application/pdf'), `${item.type} ${item.number} did not return a PDF.`);
    const facts = pdfFacts(buffer);
    assert(facts.pages >= 1, `${item.type} ${item.number} has no PDF pages.`);
    assert(Math.abs(facts.width - 594.96) < 1 && Math.abs(facts.height - 841.92) < 1, `${item.type} ${item.number} is not A4.`);
    if (item.items <= 5) assert(facts.pages === 1, `${item.type} ${item.number} (${item.items} items) unexpectedly uses ${facts.pages} pages.`);
    if (item.items >= 20) assert(facts.pages > 1, `${item.type} ${item.number} (${item.items} items) was unnaturally compressed onto one page.`);
    results.push({ type: item.type, number: item.number, items: item.items, pages: facts.pages, bytes: buffer.length, a4: true });
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exit(1); });
