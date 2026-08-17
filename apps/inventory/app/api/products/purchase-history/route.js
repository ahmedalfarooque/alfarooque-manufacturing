'use strict';

/* Real purchase history for an operational SmartLife-sourced item —
   built from actual SmartLife purchase invoice LINE ITEMS (product_id,
   quantity, unit_cost, supplier, date, reference), not a local copy.
   Confirmed live (this session) that SmartLife's purchase detail endpoint
   really does carry line items — apps/shared/integrationPlatform.js's
   readSmartLifeDetail() already existed but was never wired to any
   route; CRM's central connector route now exposes it via a `detail_id`
   query param (additive, same one connector, no second one created).

   No local purchase-history TABLE is created here on purpose: SmartLife
   is the live source of truth for these transactions, and caching them
   locally would risk exactly the kind of stale-vs-live mismatch already
   found and fixed once this session (Financial Reports vs Dashboard).
   Instead this scans the most recent purchase invoices live, bounded to
   keep the request reasonably fast — see MAX_INVOICES_SCANNED. History
   further back than that is real but not shown; this is disclosed to
   the caller via `scanned`/`truncated`, never silently presented as
   complete. Never writes anything back to SmartLife. */

const { json, requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { readSmartLife } = require('@/lib/smartlife');

const MAX_INVOICES_SCANNED = 60;
const CONCURRENCY = 8;

async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx).catch(() => null);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const { searchParams } = new URL(req.url);
  const productId = String(searchParams.get('product_id') || '').trim();
  if (!productId) return json({ error: 'product_id is required.' }, 400);

  const cookies = parseCookies(req.headers.get('cookie'));
  const credential = { appToken: cookies[COOKIE_NAME], ssoToken: cookies[SSO_COOKIE_NAME] };

  /* sort_by/sort_type is NOT honored on the purchases resource (verified
     live this session — the "sorted desc" response came back oldest-
     first); it only works on sales-invoices. So "most recent" requires
     fetching the lightweight header list (paginated, real total ~1,956)
     and sorting by date client-side before picking the top N to fetch
     full detail for. */
  let invoices;
  try {
    /* Page purely on "did a full page come back", never on the API's own
       reported `total` — that field under-reported real counts elsewhere
       in this codebase this session (Dashboard's sales/purchase totals)
       and does the same here (reports 500 when the real count is far
       higher), so trusting it would silently truncate the scan. */
    const all = [];
    for (let offset = 0, guard = 0; guard < 20; guard += 1) {
      const page = await readSmartLife('purchases', credential, { offset: String(offset), limit: '500' });
      all.push(...page.records);
      if (page.records.length < 500) break;
      offset += page.records.length;
    }
    all.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    invoices = all.slice(0, MAX_INVOICES_SCANNED);
    var totalInvoices = all.length;
  } catch (error) {
    return json({ error: error.message || 'Could not reach SmartLife.' }, 502);
  }

  const details = await mapWithConcurrency(invoices, CONCURRENCY, inv =>
    readSmartLife('purchases', credential, { detail_id: String(inv.id) }).then(r => r.providerPayload?.record || null)
  );

  const lines = [];
  for (const detail of details) {
    if (!detail || !Array.isArray(detail.items)) continue;
    for (const item of detail.items) {
      if (String(item.product_id) === productId) {
        lines.push({
          date: detail.date || null, supplier: detail.supplier || null, reference: detail.reference_no || null,
          quantity: Number(item.quantity) || 0, unit_cost: Number(item.net_unit_cost) || 0,
          unit_cost_incl_vat: Number(item.unit_cost) || 0, total: Number(item.total) || 0,
        });
      }
    }
  }
  lines.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const truncated = totalInvoices > invoices.length;
  return json({
    lines, scanned: invoices.length, truncated,
    note: truncated ? `Scanned the ${invoices.length} most recent purchase invoices out of ${totalInvoices} total — older purchases exist in SmartLife but are not shown here.` : null,
  });
}
