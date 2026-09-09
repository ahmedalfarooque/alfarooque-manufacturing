'use client';

/* Inventory workspace — a derived VIEW over the same SmartLife product
   snapshot the Products module already uses (apps/accounting/app/api/
   smartlife/products, apps/accounting/app/api/inventory/summary). No
   second product/stock table, no fabricated warehouse relationship —
   stock-by-warehouse is genuinely unavailable (every real product has
   warehouse=null) and is reported as such, not invented. */

import { useMemo, useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSelect, toast } from '@/components/glass';
import { exportReportPdf } from '@/lib/reportPdf';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import { useLanguage } from '@/lib/i18n';

function money(value) {
  return value == null || Number(value) === 0 ? '—' : `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function stockStatus(r) {
  const qty = Number(r.quantity);
  if (r.quantity == null) return { label: 'Data unavailable', tone: 'neutral' };
  if (qty <= 0) return { label: 'Out of Stock', tone: 'red' };
  const alert = Number(r.alert_quantity);
  if (alert > 0 && qty <= alert) return { label: 'Low Stock', tone: 'amber' };
  return { label: 'In Stock', tone: 'emerald' };
}

function Kpi({ label, value, sub }) {
  return (
    <GlassCard className="p-4">
      <div className="text-xs text-[color:var(--tx-3)]">{label}</div>
      <div className="mt-1 text-xl font-bold text-[color:var(--tx)]">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-[color:var(--tx-4)]">{sub}</div>}
    </GlassCard>
  );
}

export default function InventoryPage() {
  const { lang } = useLanguage();
  const { data: summaryData, error: summaryError } = useLiveData('/api/inventory/summary', 60000);
  // useLiveData surfaces error bodies as `data` too; only treat it as a summary when the real fields are present.
  const summary = summaryData && summaryData.totalProducts != null ? summaryData : null;
  const summaryLoading = !summaryData && !summaryError;
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reportBusy, setReportBusy] = useState('');

  const dataUrl = useMemo(() => {
    const q = new URLSearchParams({ offset: String(page * pageSize), limit: String(pageSize) });
    if (search.trim()) q.set('search', search.trim());
    return `/api/smartlife/products?${q}`;
  }, [page, search]);
  const { data, error, loading, refresh } = useLiveData(dataUrl, 30000);
  const records = Array.isArray(data?.records) ? data.records : [];

  const filtered = useMemo(() => records.filter(r => {
    if (categoryFilter && String(r.category || '').trim() !== categoryFilter) return false;
    if (unitFilter && r.unit !== unitFilter) return false;
    if (statusFilter && stockStatus(r).label !== statusFilter) return false;
    return true;
  }), [records, categoryFilter, unitFilter, statusFilter]);

  function resetFilters() { setSearch(''); setCategoryFilter(''); setUnitFilter(''); setStatusFilter(''); }

  function matchesFilters(r) {
    if (categoryFilter && String(r.category || '').trim() !== categoryFilter) return false;
    if (unitFilter && r.unit !== unitFilter) return false;
    if (statusFilter && stockStatus(r).label !== statusFilter) return false;
    return true;
  }

  async function fetchAllProducts() {
    const all = []; const seen = new Set(); const limit = 500;
    for (let offset = 0, guard = 0; guard < 100; guard += 1) {
      const q = new URLSearchParams({ offset: String(offset), limit: String(limit) });
      if (search.trim()) q.set('search', search.trim());
      const response = await fetch(`/api/smartlife/products?${q}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => ({}));
      const batch = Array.isArray(payload.records) ? payload.records : [];
      if (!response.ok && !batch.length) throw new Error(payload.error || 'Could not load the complete inventory dataset.');
      for (const record of batch) if (!seen.has(String(record.id))) { seen.add(String(record.id)); all.push(record); }
      if (!batch.length || batch.length < limit || all.length >= Number(payload.total || 0)) break;
      offset += batch.length;
    }
    return all;
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const reportRecords = (await fetchAllProducts()).filter(matchesFilters);
      const filterParts = [];
      if (categoryFilter) filterParts.push(`Category: ${categoryFilter}`);
      if (unitFilter) filterParts.push(`Unit: ${unitFilter}`);
      if (statusFilter) filterParts.push(`Status: ${statusFilter}`);
      if (search.trim()) filterParts.push(`Search: "${search.trim()}"`);
      await exportReportPdf({
        title: `AL FAROOQUE ERP — Inventory` + (filterParts.length ? ` — ${filterParts.join(' · ')}` : ''),
        columns: [
          { key: 'name', header: 'Product' }, { key: 'code', header: 'Code' }, { key: 'category', header: 'Category' },
          { key: 'unit', header: 'Unit' }, { key: 'quantity', header: 'Quantity' }, { key: 'alert_quantity', header: 'Alert Threshold' },
          { key: 'status', header: 'Stock Status' }, { key: 'cost', header: 'Cost' }, { key: 'price', header: 'Sale Price' },
        ],
        rows: reportRecords.map(r => ({ ...r, alert_quantity: Number(r.alert_quantity) > 0 ? r.alert_quantity : '—', status: stockStatus(r).label, cost: money(r.cost), price: money(r.price) })),
        period: 'Current filtered view', source: data?.connected ? 'SmartLife live read-only data' : 'SmartLife synchronized snapshot',
        totals: [['Exported products', String(reportRecords.length)]], lang,
        fileName: 'inventory-report.pdf', action,
      });
    } catch (e) { toast(e.message || 'Could not generate report.', 'red'); }
    finally { setReportBusy(''); }
  }

  return <div className="space-y-4">
    <PageHeader title="Inventory" description="Derived from the synchronized SmartLife product snapshot — same source as Products, no separate stock system" actions={<GlassButton onClick={refresh}>Refresh</GlassButton>} />

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Kpi label="Total Products" value={summaryLoading ? '…' : (summary?.totalProducts ?? '—')} />
      <Kpi label="With Stock" value={summaryLoading ? '…' : (summary?.withStock ?? '—')} />
      <Kpi label="Out of Stock" value={summaryLoading ? '…' : (summary?.outOfStock ?? '—')} />
      <Kpi label="Low Stock" value={summaryLoading ? '…' : (summary?.lowStock ?? '—')} sub={summary ? `of ${summary.withThreshold} with a real threshold` : ''} />
      <Kpi label="Total Quantity" value={summaryLoading ? '…' : (summary?.totalQuantity?.toLocaleString() ?? '—')} />
    </div>

    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-[color:var(--tx-3)]">
      Stock-by-warehouse: not available — every real product record has <code>warehouse = null</code>; SmartLife's Products API does not expose a per-warehouse breakdown.
      {summary && ` Low-stock status is only meaningful for ${summary.withThreshold} of ${summary.totalProducts} products — the rest have no alert threshold set.`}
    </div>

    <GlassCard className="p-4">
      <ListToolbar className="mb-4">
        <GlassInput className="min-w-56 flex-1" placeholder="Search product, code, category, unit…" value={search} onChange={e => setSearch(e.target.value)} />
        <GlassSelect value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>{(summary?.categories || []).map(c => <option key={c}>{c}</option>)}
        </GlassSelect>
        <GlassSelect value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
          <option value="">All units</option>{(summary?.units || []).map(u => <option key={u}>{u}</option>)}
        </GlassSelect>
        <GlassSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All stock statuses</option>{['In Stock', 'Low Stock', 'Out of Stock'].map(s => <option key={s}>{s}</option>)}
        </GlassSelect>
        <GlassButton variant="secondary" size="sm" onClick={resetFilters}>Reset</GlassButton>
        <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!filtered.length || !!reportBusy}>{reportBusy === 'print' ? 'Preparing…' : 'Print'}</GlassButton>
        <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!filtered.length || !!reportBusy}>{reportBusy === 'save' ? 'Generating…' : '⤓ Download PDF'}</GlassButton>
      </ListToolbar>

      {(error || summaryError) && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Could not load inventory data{(error || summaryError) ? `: ${error || summaryError}` : '.'}</div>}
      {loading && <div className="py-8 text-center text-[color:var(--tx-3)]">Loading…</div>}
      {!loading && !filtered.length && <div className="py-8 text-center text-[color:var(--tx-3)]">No products matched this view.</div>}
      {!!filtered.length && <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[color:var(--bd)]">
            {['Product', 'Code', 'Category', 'Unit', 'Quantity', 'Alert Threshold', 'Stock Status', 'Cost', 'Sale Price'].map(h => (
              <th key={h} className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">{h}</th>
            ))}
          </tr></thead>
          <tbody>{filtered.map(r => { const s = stockStatus(r); return (
            <tr key={r.id} className="border-b border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)]">
              <td className="max-w-64 truncate p-3">{r.name}</td>
              <td className="p-3">{r.code}</td>
              <td className="p-3">{r.category || '—'}</td>
              <td className="p-3">{r.unit || '—'}</td>
              <td className="p-3 text-end">{r.quantity ?? '—'}</td>
              <td className="p-3 text-end">{Number(r.alert_quantity) > 0 ? r.alert_quantity : '—'}</td>
              <td className="p-3"><GlassBadge tone={s.tone}>{s.label}</GlassBadge></td>
              <td className="p-3 text-end">{money(r.cost)}</td>
              <td className="p-3 text-end">{money(r.price)}</td>
            </tr>
          ); })}</tbody>
        </table>
      </div>}
      {Number(data?.total) > pageSize && <div className="mt-4 flex items-center justify-between gap-3 print:hidden">
        <div className="text-xs text-[color:var(--tx-3)]">Page {page + 1} of {Math.max(1, Math.ceil(Number(data.total) / pageSize))} · {data.total} source records</div>
        <div className="flex gap-2">
          <GlassButton variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(v => Math.max(0, v - 1))}>Previous</GlassButton>
          <GlassButton variant="secondary" size="sm" disabled={(page + 1) * pageSize >= Number(data.total)} onClick={() => setPage(v => v + 1)}>Next</GlassButton>
        </div>
      </div>}
    </GlassCard>
  </div>;
}
