'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

for (const file of [path.join(__dirname, '..', '.env.local'), path.join(__dirname, '..', '..', '..', '.env.local')]) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const text = line.trim(); if (!text || text.startsWith('#')) continue;
      const index = text.indexOf('='); if (index < 1) continue;
      const key = text.slice(0, index).trim(); let value = text.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (_) {}
}

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
const token = jwt.sign({ sub: 'reporting-verifier', email: 'reporting-verifier@localhost.invalid', role: 'admin', app: 'accounting' }, process.env.JWT_SECRET, { expiresIn: 300 });
const headers = { Cookie: `af_accounting_session=${token}` };

async function request(pathname, { binary = false } = {}) {
  const response = await fetch(`http://localhost:3050${pathname}`, { headers });
  const payload = binary ? Buffer.from(await response.arrayBuffer()) : await response.json().catch(() => ({}));
  return { response, payload };
}

async function readAll(resource) {
  const records = []; const seen = new Set(); const limit = 500;
  for (let offset = 0, guard = 0; guard < 100; guard += 1) {
    const { response, payload } = await request(`/api/smartlife/${resource}?offset=${offset}&limit=${limit}`);
    if (!response.ok) throw new Error(`${resource} failed: ${payload.error || response.status}`);
    const batch = payload.records || [];
    for (const record of batch) {
      const key = String(record.id ?? record.reference_no ?? record.code ?? JSON.stringify(record));
      if (!seen.has(key)) { seen.add(key); records.push(record); }
    }
    if (!batch.length || batch.length < limit) break;
    offset += batch.length;
  }
  return records;
}

async function main() {
  const expected = { 'sales-invoices': 488, purchases: 1956, products: 2912, customers: 273, warehouses: 2 };
  const counts = {};
  for (const [resource, minimum] of Object.entries(expected)) {
    counts[resource] = (await readAll(resource)).length;
    if (counts[resource] < minimum) throw new Error(`${resource} was truncated: ${counts[resource]} < ${minimum}`);
  }

  const dashboard = await request('/api/dashboard/summary?month=all&year=all');
  if (!dashboard.response.ok || dashboard.payload.kpis?.salesCount !== 488 || dashboard.payload.kpis?.purchaseCount !== 1956) throw new Error('Dashboard totals do not match synchronized source counts.');

  const ordering = {};
  for (const resource of ['sales-invoices', 'purchases']) {
    const sorted = await request(`/api/smartlife/${resource}?offset=0&limit=100&sort_by=date&sort_type=desc`);
    if (!sorted.response.ok) throw new Error(`${resource} ordering probe failed.`);
    const dates = (sorted.payload.records || []).map(row => String(row.date || row.invoice_date || '').slice(0, 10)).filter(Boolean);
    ordering[resource] = dates.every((value, index) => index === 0 || dates[index - 1] >= value);
  }

  const reports = await request('/api/smartlife/reports');
  if (!reports.response.ok || !reports.payload.categories?.find(category => category.key === 'vat')?.reports?.find(report => report.href === '/vat')) throw new Error('Financial Reports does not expose the active VAT report.');

  const vat = await request('/api/smartlife/vat?month=all&year=all');
  if (!vat.response.ok || vat.payload.summary?.salesCount !== 488 || vat.payload.summary?.purchaseCount !== 1956 || !Array.isArray(vat.payload.rows)) throw new Error(`VAT report failed: ${vat.payload.error || vat.response.status}`);
  for (const key of ['sales', 'salesVat', 'purchases', 'purchaseVat', 'netVat']) {
    if (!Number.isFinite(vat.payload.summary[key])) throw new Error(`VAT summary ${key} is not a finite real number.`);
  }

  const retired = await request('/api/expenses');
  if (retired.response.status !== 410) throw new Error('Retired local Expenses API is not protected.');

  const invoiceList = await request('/api/smartlife/sales-invoices?search=0455&offset=0&limit=25');
  const invoice = invoiceList.payload.records?.find(row => String(row.reference_no || row.invoice_number || row.number || '').includes('0455')) || invoiceList.payload.records?.[0];
  if (!invoice?.id) throw new Error('Could not locate a real invoice for print/PDF verification.');
  const pdf = await request(`/api/smartlife/sales-invoices/${invoice.id}/pdf?lang=en`, { binary: true });
  if (!pdf.response.ok || !String(pdf.response.headers.get('content-type')).includes('application/pdf') || pdf.payload.length < 1000 || pdf.payload.subarray(0, 4).toString() !== '%PDF') throw new Error('Real invoice PDF verification failed.');

  const pageChecks = {};
  for (const pathname of ['/dashboard', '/smartlife/sales-invoices', '/smartlife/purchases', '/purchase-requests', '/smartlife/customers', '/smartlife/suppliers', '/smartlife/products', '/inventory', '/smartlife/warehouses', '/smartlife/financial-reports', '/vat']) {
    const response = await fetch(`http://localhost:3050${pathname}`, { headers, redirect: 'manual' });
    pageChecks[pathname] = response.status;
    if (response.status !== 200) throw new Error(`${pathname} returned ${response.status}.`);
  }

  console.log(JSON.stringify({ counts, ordering, dashboard: { sales: dashboard.payload.kpis.salesCount, purchases: dashboard.payload.kpis.purchaseCount }, vat: vat.payload.summary, invoicePdfBytes: pdf.payload.length, pages: pageChecks }, null, 2));
}

main().catch(error => { console.error(error.message); process.exit(1); });
