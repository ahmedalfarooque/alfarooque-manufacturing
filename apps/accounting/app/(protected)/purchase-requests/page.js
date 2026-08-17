'use client';

/* Local AL FAROOQUE data — NOT a SmartERP resource (see pm_purchase_requests /
   the Phase-1 backend). Same table the Projects app already owns; this page
   is the Accounting-side entry point onto it, per the shared architecture
   built in apps/accounting/app/api/purchase-requests/. */

import { useEffect, useMemo, useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassModal, GlassSelect, toast } from '@/components/glass';
import DateFilter, { inDateFilter, dateFilterLabel } from '@/components/DateFilter';
import { exportReportPdf } from '@/lib/reportPdf';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import { useLanguage } from '@/lib/i18n';

/* Kept identical to Projects' own status set (apps/projects — PR_ACTIONS /
   VALID_STATUSES) now that the real DB CHECK constraint was widened to
   match; both apps must agree on the same allowed set for the same
   canonical column. */
const STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'On Hold', 'Purchased', 'Delivered',
  'Cancelled', 'Payment Pending', 'Payment Approved', 'Payment Completed', 'Ordered', 'Completed'];
const STATUS_TONE = {
  Pending: 'amber', 'Under Review': 'cyan', Approved: 'emerald', Rejected: 'red', 'On Hold': 'amber',
  Purchased: 'cyan', Delivered: 'cyan', Cancelled: 'neutral', 'Payment Pending': 'amber',
  'Payment Approved': 'cyan', 'Payment Completed': 'emerald', Ordered: 'cyan', Completed: 'emerald',
};

function money(value, currency = 'SAR') {
  return value == null || value === '' ? null : `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function PurchaseRequestsPage() {
  const { t, lang } = useLanguage();
  const { data, error, loading, refresh } = useLiveData('/api/purchase-requests', 30000);
  const requests = Array.isArray(data?.purchaseRequests) ? data.purchaseRequests : [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState('');
  const [form, setForm] = useState({ material_description: '', quantity: '', unit: '', supplier: '', estimated_price: '', priority: 'Normal', required_date: '', inv_material_id: '', inv_product_id: '' });
  const [invQuery, setInvQuery] = useState('');
  const [invResults, setInvResults] = useState(null);
  const [invPicked, setInvPicked] = useState(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemForm, setAddItemForm] = useState({ kind: 'product', name: '' });
  const [addItemBusy, setAddItemBusy] = useState(false);

  useEffect(() => {
    const query = invQuery.trim();
    if (query.length < 2) { setInvResults(null); return; }
    const timer = setTimeout(() => {
      fetch('/api/inventory-search?q=' + encodeURIComponent(query), { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setInvResults(d))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [invQuery]);

  /* inv_material_id/inv_product_id carry a real FK to inv_materials/
     inv_products — a qt_materials- or legacy-products-sourced fallback row
     (source_table !== 'inv_materials'/'inv_products') has no matching row
     there, so linking one would violate the FK and silently 500 on save.
     Those rows are shown as reference-only; use Add New Item to create a
     real linkable row first. */
  function isLinkable(item) { return !item.source_table || item.source_table === 'inv_products' || item.source_table === 'inv_materials'; }

  function pickInventoryItem(item, kind) {
    setInvPicked({ ...item, kind });
    setInvResults(null); setInvQuery('');
    setForm(f => ({ ...f, inv_material_id: kind === 'material' ? item.id : '', inv_product_id: kind === 'product' ? item.id : '' }));
  }
  function clearInventoryItem() {
    setInvPicked(null);
    setForm(f => ({ ...f, inv_material_id: '', inv_product_id: '' }));
  }
  async function submitAddItem() {
    const name = addItemForm.name.trim();
    if (!name) { toast('Item name is required.', 'red'); return; }
    setAddItemBusy(true);
    try {
      const r = await fetch('/api/inventory-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(addItemForm) });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || 'Could not add item.');
      const created = p.product || p.material;
      pickInventoryItem(created, addItemForm.kind);
      setAddItemOpen(false); setAddItemForm({ kind: 'product', name: '' });
      toast('Item added and selected.', 'emerald');
    } catch (e) { toast(e.message, 'red'); } finally { setAddItemBusy(false); }
  }

  /* Search is field-scoped (Material/Supplier/Project) — never the entire
     raw record — matching the same convention just fixed on Sales/Purchases. */
  const projectOptions = useMemo(() => [...new Set(requests.map(r => r.project_name).filter(Boolean))].sort(), [requests]);
  const filtered = useMemo(() => requests.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (priorityFilter && r.priority !== priorityFilter) return false;
    if (supplierFilter && !String(r.supplier || '').toLowerCase().includes(supplierFilter.toLowerCase())) return false;
    if (projectFilter && r.project_name !== projectFilter) return false;
    if (!inDateFilter(dateFilter, r.request_date)) return false;
    if (search.trim()) {
      const haystack = `${r.material_description || ''} ${r.supplier || ''} ${r.project_name || ''}`.toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  }), [requests, search, statusFilter, priorityFilter, supplierFilter, projectFilter, dateFilter]);

  function resetFilters() { setSearch(''); setStatusFilter(''); setSupplierFilter(''); setProjectFilter(''); setPriorityFilter(''); setDateFilter({ preset: 'all', from: null, to: null }); }

  async function loadDetail(id) {
    setDetail(null);
    try { const r = await fetch(`/api/purchase-requests/${id}`, { credentials: 'same-origin' }); setDetail(await r.json()); }
    catch (_) { setDetail(null); }
  }

  useEffect(() => { if (selected) loadDetail(selected.id); }, [selected]);

  async function createRequest() {
    if (!form.material_description.trim()) { toast('Material description is required.', 'red'); return; }
    setBusy(true);
    try {
      const body = { ...form, estimated_price: form.estimated_price === '' ? null : Number(form.estimated_price), quantity: form.quantity === '' ? null : Number(form.quantity) };
      const url = editing ? `/api/purchase-requests/${editing.id}` : '/api/purchase-requests';
      const r = await fetch(url, {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || `Could not ${editing ? 'update' : 'create'} purchase request.`);
      toast(editing ? 'Purchase request updated.' : 'Purchase request created.', 'emerald');
      setCreateOpen(false); setEditing(null);
      setForm({ material_description: '', quantity: '', unit: '', supplier: '', estimated_price: '', priority: 'Normal', required_date: '', inv_material_id: '', inv_product_id: '' });
      setInvPicked(null); setInvQuery(''); setInvResults(null);
      refresh?.();
    } catch (e) { toast(e.message, 'red'); } finally { setBusy(false); }
  }

  function openEdit(r) {
    setEditing(r);
    setForm({
      material_description: r.material_description || '', quantity: r.quantity ?? '', unit: r.unit || '',
      supplier: r.supplier || '', estimated_price: r.estimated_price ?? '', priority: r.priority || 'Normal',
      required_date: r.required_date || '', inv_material_id: r.inv_material_id || '', inv_product_id: r.inv_product_id || '',
    });
    setInvPicked(r.linked_item_name ? { name: r.linked_item_name, id: r.inv_product_id || r.inv_material_id, kind: r.inv_product_id ? 'product' : 'material' } : null);
    setInvQuery(''); setInvResults(null);
    setCreateOpen(true);
  }

  /* Same shared A4 report engine used by Sales/Purchases — no second
     report design. Respects the currently active filters (Current View),
     not the full unfiltered dataset. */
  async function runReport(action) {
    setReportBusy(action);
    try {
      const filterParts = [`Period: ${dateFilterLabel(dateFilter, t, lang)}`];
      if (supplierFilter) filterParts.push(`Supplier: ${supplierFilter}`);
      if (projectFilter) filterParts.push(`Project: ${projectFilter}`);
      if (priorityFilter) filterParts.push(`Priority: ${priorityFilter}`);
      if (statusFilter) filterParts.push(`Status: ${statusFilter}`);
      if (search.trim()) filterParts.push(`Search: "${search.trim()}"`);
      await exportReportPdf({
        title: `AL FAROOQUE ERP — Purchase Requests — ${filterParts.join(' · ')}`,
        columns: [
          { key: 'request_date', header: 'Date' }, { key: 'supplier', header: 'Supplier' },
          { key: 'material_description', header: 'Material' }, { key: 'quantity', header: 'Qty' }, { key: 'unit', header: 'Unit' },
          { key: 'estimated_price', header: 'Estimated Amount' }, { key: 'priority', header: 'Priority' },
          { key: 'project_name', header: 'Project' }, { key: 'status', header: 'Status' },
        ],
        rows: filtered.map(r => ({ ...r, estimated_price: money(r.estimated_price) || 'Unknown', project_name: r.project_name || '—' })),
        period: dateFilterLabel(dateFilter, t, lang), source: 'AL FAROOQUE ERP local purchase-request records',
        totals: [['Exported requests', String(filtered.length)]], lang,
        fileName: 'purchase-requests-report.pdf', action,
      });
    } catch (e) { toast(e.message || 'Could not generate report.', 'red'); }
    finally { setReportBusy(''); }
  }

  async function deleteRequest(id) {
    if (!confirm('Delete this purchase request? If it is linked to a project or a purchase invoice, that connection will be removed.')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/purchase-requests/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || 'Could not delete.');
      toast('Purchase request deleted.', 'emerald');
      setSelected(null); refresh?.();
    } catch (e) { toast(e.message, 'red'); } finally { setBusy(false); }
  }

  async function openProjectPicker() {
    try { const r = await fetch('/api/smartlife/relationships', { credentials: 'same-origin' }); const p = await r.json(); setProjects(p.projects || []); }
    catch (_) { setProjects([]); }
    setProjectPickerOpen(true);
  }

  async function connectProject(projectId) {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/purchase-requests/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ project_id: projectId }) });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || 'Could not connect project.');
      toast('Connected to project.', 'emerald');
      setProjectPickerOpen(false); refresh?.(); loadDetail(selected.id);
    } catch (e) { toast(e.message, 'red'); } finally { setBusy(false); }
  }

  async function disconnectProject() {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/purchase-requests/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ project_id: null }) });
      if (!r.ok) throw new Error('Could not disconnect project.');
      toast('Project disconnected.', 'emerald');
      refresh?.(); loadDetail(selected.id);
    } catch (e) { toast(e.message, 'red'); } finally { setBusy(false); }
  }

  async function searchInvoices() {
    setInvoiceBusy(true);
    try {
      const q = new URLSearchParams({ limit: '20', offset: '0' });
      if (invoiceSearch.trim()) q.set('search', invoiceSearch.trim());
      const r = await fetch(`/api/smartlife/purchases?${q}`, { credentials: 'same-origin' });
      const p = await r.json();
      setInvoiceResults(Array.isArray(p.records) ? p.records : []);
    } catch (_) { setInvoiceResults([]); } finally { setInvoiceBusy(false); }
  }
  useEffect(() => { if (invoicePickerOpen) searchInvoices(); }, [invoicePickerOpen]);

  async function connectInvoice(record) {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/purchase-requests/${selected.id}/invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ source_record: record }) });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || 'Could not connect purchase invoice.');
      toast(p.alreadyConnected ? 'Already connected.' : 'Purchase invoice connected.', 'emerald');
      setInvoicePickerOpen(false); loadDetail(selected.id);
    } catch (e) { toast(e.message, 'red'); } finally { setBusy(false); }
  }

  async function disconnectInvoice(sourceRecordId) {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/purchase-requests/${selected.id}/invoices?source_record_id=${encodeURIComponent(sourceRecordId)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!r.ok) throw new Error('Could not disconnect.');
      toast('Purchase invoice disconnected.', 'emerald');
      loadDetail(selected.id);
    } catch (e) { toast(e.message, 'red'); } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <PageHeader title="Purchase Requests" description="AL FAROOQUE local records · planned/requested material, separate from actual SmartERP purchase invoices" actions={<GlassButton onClick={() => { setEditing(null); setForm({ material_description: '', quantity: '', unit: '', supplier: '', estimated_price: '', priority: 'Normal', required_date: '', inv_material_id: '', inv_product_id: '' }); setInvPicked(null); setInvQuery(''); setInvResults(null); setCreateOpen(true); }}>+ New Purchase Request</GlassButton>} />

    <GlassCard className="p-4">
      <ListToolbar className="mb-4">
        <GlassInput className="min-w-56 flex-1" placeholder="Search material, supplier, project…" value={search} onChange={e => setSearch(e.target.value)} />
        <DateFilter value={dateFilter} onChange={setDateFilter} t={t} lang={lang} />
        <GlassInput className="min-w-40" placeholder="Supplier…" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} />
        <GlassSelect value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
          <option value="">All projects</option>{projectOptions.map(p => <option key={p}>{p}</option>)}
        </GlassSelect>
        <GlassSelect value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>{['Normal', 'Urgent', 'Critical'].map(p => <option key={p}>{p}</option>)}
        </GlassSelect>
        <GlassSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
        </GlassSelect>
        <GlassButton variant="secondary" size="sm" onClick={resetFilters}>Reset</GlassButton>
        <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!filtered.length || !!reportBusy}>{reportBusy === 'print' ? 'Preparing…' : 'Print'}</GlassButton>
        <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!filtered.length || !!reportBusy}>{reportBusy === 'save' ? 'Generating…' : '⤓ Download PDF'}</GlassButton>
      </ListToolbar>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Could not load purchase requests.</div>}
      {loading && <div className="py-8 text-center text-[color:var(--tx-3)]">Loading…</div>}
      {!loading && !filtered.length && <div className="py-8 text-center text-[color:var(--tx-3)]">No purchase requests found.</div>}
      {!!filtered.length && <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[color:var(--bd)]">
            <th className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">Date</th>
            <th className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">Material</th>
            <th className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">Project</th>
            <th className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">Supplier</th>
            <th className="p-3 text-end text-xs uppercase text-[color:var(--tx-3)]">Qty</th>
            <th className="p-3 text-end text-xs uppercase text-[color:var(--tx-3)]">Estimated Amount</th>
            <th className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">Priority</th>
            <th className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">Status</th>
            <th className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">Actions</th>
          </tr></thead>
          <tbody>{filtered.map(r => <tr key={r.id} className="border-b border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)]">
            <td className="p-3">{r.request_date}</td>
            <td className="max-w-64 truncate p-3">{r.material_description}{r.linked_item_name && <div className="text-xs text-[color:var(--tx-4)]">🔗 {r.linked_item_name}</div>}</td>
            <td className="p-3">{r.project_name || <span className="text-[color:var(--tx-4)]">Not connected</span>}</td>
            <td className="p-3">{r.supplier || '—'}</td>
            <td className="p-3 text-end">{r.quantity ?? '—'} {r.unit || ''}</td>
            <td className="p-3 text-end">{money(r.estimated_price) || <span className="text-[color:var(--tx-4)]">Not specified</span>}</td>
            <td className="p-3">{r.priority}</td>
            <td className="p-3"><GlassBadge tone={STATUS_TONE[r.status] || 'neutral'}>{r.status}</GlassBadge></td>
            <td className="p-3"><div className="flex gap-1">
              <GlassButton variant="secondary" size="sm" onClick={() => setSelected(r)}>View</GlassButton>
              <GlassButton variant="secondary" size="sm" onClick={() => openEdit(r)}>Edit</GlassButton>
              <GlassButton variant="secondary" size="sm" onClick={() => deleteRequest(r.id)}>Delete</GlassButton>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </GlassCard>

    {createOpen && <GlassModal title={editing ? 'Edit Purchase Request' : 'New Purchase Request'} onClose={() => { setCreateOpen(false); setEditing(null); }}
      footer={<div className="flex justify-end gap-2"><GlassButton variant="secondary" onClick={() => { setCreateOpen(false); setEditing(null); }}>Cancel</GlassButton><GlassButton onClick={createRequest} disabled={busy}>{busy ? 'Saving…' : (editing ? 'Save' : 'Create')}</GlassButton></div>}>
      <div className="space-y-3">
        <GlassInput placeholder="Material / description *" value={form.material_description} onChange={e => setForm(f => ({ ...f, material_description: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <GlassInput placeholder="Quantity" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
          <GlassInput placeholder="Unit" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
        </div>
        <div className="relative">
          <label className="mb-1 block text-xs text-[color:var(--tx-3)]">{t('pr.linkInventoryItem')}</label>
          {invPicked ? (
            <div className="flex items-center justify-between rounded-xl border border-[color:var(--bd)] px-3 py-2 text-sm">
              <span>{invPicked.name} {invPicked.sku || invPicked.material_code ? <span className="text-xs opacity-60">({invPicked.sku || invPicked.material_code})</span> : null}</span>
              <GlassButton size="sm" variant="secondary" onClick={clearInventoryItem}>{t('common.clear')}</GlassButton>
            </div>
          ) : (
            <GlassInput value={invQuery} onChange={e => setInvQuery(e.target.value)} placeholder={t('pr.linkInventoryItemPlaceholder')} />
          )}
          {!invPicked && invQuery.trim().length >= 2 && invResults && (
            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[color:var(--bd)] bg-[color:var(--nav-bg)] shadow-xl backdrop-blur-xl">
              {invResults.products?.map(p => (
                <button key={'p:' + p.id} type="button" disabled={!isLinkable(p)} onClick={() => isLinkable(p) && pickInventoryItem(p, 'product')}
                  className={'block w-full px-3 py-2 text-start text-sm ' + (isLinkable(p) ? 'hover:bg-[color:var(--pr-soft)]' : 'cursor-not-allowed opacity-50')}>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs opacity-60">{p.sku || '—'} · {t('pr.stockOnHand')}: {Number(p.qty_on_hand || 0).toLocaleString()}{!isLinkable(p) && ' · not linkable — use Add New Item'}</div>
                </button>
              ))}
              {invResults.materials?.map(m => (
                <button key={'m:' + m.id} type="button" disabled={!isLinkable(m)} onClick={() => isLinkable(m) && pickInventoryItem(m, 'material')}
                  className={'block w-full px-3 py-2 text-start text-sm ' + (isLinkable(m) ? 'hover:bg-[color:var(--pr-soft)]' : 'cursor-not-allowed opacity-50')}>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs opacity-60">{m.material_code || '—'} · {t('pr.stockOnHand')}: {Number(m.qty_on_hand || 0).toLocaleString()}{!isLinkable(m) && ' · not linkable — use Add New Item'}</div>
                </button>
              ))}
              {![...(invResults.products || []), ...(invResults.materials || [])].some(isLinkable) && (
                <div className="p-3 text-sm text-[color:var(--tx-3)]">
                  {t('pr.noMatchFound')}
                  <button type="button" onClick={() => { setAddItemForm({ kind: 'product', name: invQuery.trim() }); setAddItemOpen(true); }} className="mt-1 block font-medium text-[color:var(--pr)] hover:underline">{t('pr.addNewItem')}</button>
                </div>
              )}
            </div>
          )}
          {!invPicked && !addItemOpen && (
            <button type="button" onClick={() => { setAddItemForm({ kind: 'product', name: '' }); setAddItemOpen(true); }} className="mt-1 text-xs text-[color:var(--pr)] hover:underline">{t('pr.addNewItem')}</button>
          )}
        </div>
        <GlassInput placeholder="Supplier (optional)" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
        <GlassInput placeholder="Estimated amount — leave blank if unknown" type="number" value={form.estimated_price} onChange={e => setForm(f => ({ ...f, estimated_price: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <GlassSelect value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            {['Normal', 'Urgent', 'Critical'].map(p => <option key={p}>{p}</option>)}
          </GlassSelect>
          <label className="text-xs text-[color:var(--tx-3)]">Required by<GlassInput type="date" value={form.required_date} onChange={e => setForm(f => ({ ...f, required_date: e.target.value }))} /></label>
        </div>
        <p className="text-xs text-[color:var(--tx-4)]">Can be connected to a project and/or a purchase invoice after creation.</p>
      </div>
    </GlassModal>}

    {selected && <GlassModal title={`Purchase Request — ${selected.material_description}`} onClose={() => { setSelected(null); setDetail(null); }} wide
      footer={<div className="flex justify-end gap-2"><GlassButton variant="secondary" onClick={() => setSelected(null)}>Close</GlassButton></div>}>
      <div className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs uppercase text-[color:var(--tx-4)]">Status</dt><dd className="mt-1"><GlassBadge tone={STATUS_TONE[selected.status] || 'neutral'}>{selected.status}</GlassBadge></dd></div>
          <div><dt className="text-xs uppercase text-[color:var(--tx-4)]">Quantity</dt><dd className="mt-1">{selected.quantity ?? '—'} {selected.unit || ''}</dd></div>
          <div><dt className="text-xs uppercase text-[color:var(--tx-4)]">Estimated Amount</dt><dd className="mt-1">{money(selected.estimated_price) || 'Not specified'}</dd></div>
          <div><dt className="text-xs uppercase text-[color:var(--tx-4)]">{t('pr.linkInventoryItem')}</dt><dd className="mt-1">{detail?.purchaseRequest?.linked_item_name || '—'}</dd></div>
        </dl>
        <div>
          <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold">Project</h3>{!detail?.purchaseRequest?.project_id ? <GlassButton size="sm" onClick={openProjectPicker}>Connect Project</GlassButton> : <GlassButton size="sm" variant="secondary" onClick={disconnectProject} disabled={busy}>Disconnect</GlassButton>}</div>
          <div className="rounded-xl border border-[color:var(--bd)] p-3 text-sm">{detail?.purchaseRequest?.project_name || 'Not connected'}</div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold">Connected Purchase Invoices</h3><GlassButton size="sm" onClick={() => setInvoicePickerOpen(true)}>Connect Purchase Invoice</GlassButton></div>
          {!detail?.connectedInvoices?.length ? <div className="rounded-xl border border-[color:var(--bd)] p-3 text-sm text-[color:var(--tx-3)]">No purchase invoices connected.</div> : (
            <div className="space-y-2">{detail.connectedInvoices.map(link => <div key={link.connection_id} className="flex items-center justify-between rounded-xl border border-[color:var(--bd)] p-3 text-sm">
              <div>Purchase #{link.external_id} · {money(link.payload?.grand_total || link.payload?.total)}</div>
              <GlassButton size="sm" variant="secondary" onClick={() => disconnectInvoice(link.source_record_id)}>Disconnect</GlassButton>
            </div>)}</div>
          )}
        </div>
      </div>
    </GlassModal>}

    {projectPickerOpen && <GlassModal title="Connect Purchase Request to Project" onClose={() => setProjectPickerOpen(false)}>
      <div className="space-y-2">
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm">This stores only an AL FAROOQUE relationship.</div>
        {projects.map(p => <button key={p.id} onClick={() => connectProject(p.id)} disabled={busy} className="block w-full rounded-xl border border-[color:var(--bd)] p-3 text-start text-sm hover:bg-[color:var(--pr-soft)]">{p.project_name} · {p.customer_name || 'No customer'}</button>)}
      </div>
    </GlassModal>}

    {addItemOpen && <GlassModal title={t('pr.addNewItemTitle')} onClose={() => setAddItemOpen(false)}
      footer={<div className="flex justify-end gap-2"><GlassButton variant="secondary" onClick={() => setAddItemOpen(false)}>Cancel</GlassButton><GlassButton onClick={submitAddItem} disabled={addItemBusy}>{addItemBusy ? 'Saving…' : t('pr.addAndSelect')}</GlassButton></div>}>
      <div className="space-y-3">
        <GlassSelect value={addItemForm.kind} onChange={e => setAddItemForm(f => ({ ...f, kind: e.target.value }))}>
          <option value="product">{t('pr.itemTypeProduct')}</option>
          <option value="material">{t('pr.itemTypeMaterial')}</option>
        </GlassSelect>
        <GlassInput placeholder={t('pr.itemName')} value={addItemForm.name} onChange={e => setAddItemForm(f => ({ ...f, name: e.target.value }))} />
        <GlassInput placeholder={t('pr.itemCode')} value={(addItemForm.kind === 'material' ? addItemForm.material_code : addItemForm.sku) || ''} onChange={e => setAddItemForm(f => ({ ...f, [addItemForm.kind === 'material' ? 'material_code' : 'sku']: e.target.value }))} />
      </div>
    </GlassModal>}

    {invoicePickerOpen && <GlassModal title="Connect Purchase Request to Purchase Invoice" onClose={() => setInvoicePickerOpen(false)}>
      <div className="space-y-3">
        <div className="flex gap-2"><GlassInput className="flex-1" placeholder="Search purchase reference, supplier…" value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchInvoices()} /><GlassButton onClick={searchInvoices} disabled={invoiceBusy}>Search</GlassButton></div>
        {invoiceBusy && <div className="py-4 text-center text-sm text-[color:var(--tx-3)]">Loading…</div>}
        {!invoiceBusy && !invoiceResults.length && <div className="py-4 text-center text-sm text-[color:var(--tx-3)]">No purchase invoices found.</div>}
        <div className="max-h-80 space-y-2 overflow-auto">{invoiceResults.map((rec, i) => <button key={rec.id || i} onClick={() => connectInvoice(rec)} disabled={busy} className="block w-full rounded-xl border border-[color:var(--bd)] p-3 text-start text-sm hover:bg-[color:var(--pr-soft)]">
          <div className="font-medium">#{rec.reference_no || rec.id} · {rec.supplier || '—'}</div>
          <div className="text-xs text-[color:var(--tx-3)]">{rec.date} · {money(rec.grand_total || rec.total)} · {rec.payment_status}</div>
        </button>)}</div>
      </div>
    </GlassModal>}
  </div>;
}
