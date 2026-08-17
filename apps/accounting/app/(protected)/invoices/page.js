'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';
import { exportReportPdf } from '@/lib/reportPdf';
import DateFilter, { dateFilterLabel } from '@/components/DateFilter';
import { resolveDateRange } from '@/lib/resolveDateRange';
import ListPagination from '@/components/ListPagination';
import { useLanguage } from '@/lib/i18n';

const STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Partially Paid'];
function statusTone(s) { return s === 'Paid' ? 'success' : s === 'Overdue' ? 'error' : s === 'Sent' ? 'info' : 'neutral'; }
function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
const emptyLine = () => ({ description: '', qty: 1, unit_price: '', tax_rate: 15 });

export default function InvoicesPage() {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [lines, setLines] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [reportBusy, setReportBusy] = useState('');
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateFilter);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) p.set('search', search);
    if (status) p.set('status', status);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    return p;
  }, [page, pageSize, search, status, dateFrom, dateTo]);
  const { data, refresh } = useLiveData(`/api/invoices?${params}`, 15000);
  const invoices = data?.invoices || [];
  const total = Number(data?.total) || 0;

  /* Reuses the same shared A4 report engine as VAT/Purchase Requests/
     Inventory — no second PDF renderer. The list itself is server-paginated,
     so the report walks every page (500 at a time, the API's cap) under the
     currently active search/status/date filters rather than only exporting
     the visible page. */
  async function fetchAllInvoices() {
    const all = [];
    for (let p = 1, guard = 0; guard < 100; guard += 1) {
      const qp = new URLSearchParams(params); qp.set('page', String(p)); qp.set('pageSize', '500');
      const res = await fetch(`/api/invoices?${qp}`, { credentials: 'same-origin' });
      const body = await res.json().catch(() => ({}));
      const batch = Array.isArray(body.invoices) ? body.invoices : [];
      all.push(...batch);
      if (!batch.length || batch.length < 500 || all.length >= Number(body.total || 0)) break;
      p += 1;
    }
    return all;
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const all = await fetchAllInvoices();
      await exportReportPdf({
        title: 'Invoices Report' + (status ? ` — ${status}` : '') + (dateFilter.preset !== 'all' ? ` — Period: ${dateFilterLabel(dateFilter, t, lang)}` : '') + (search.trim() ? ` — Search: "${search.trim()}"` : ''),
        columns: [
          { key: 'invoice_number', header: 'Number' }, { key: 'customer_name', header: 'Customer' },
          { key: 'invoice_date', header: 'Date' }, { key: 'due_date', header: 'Due' },
          { key: 'totalText', header: 'Total' }, { key: 'status', header: 'Status' },
        ],
        rows: all.map(inv => ({ ...inv, invoice_number: inv.invoice_number || String(inv.id).slice(0, 8), due_date: inv.due_date || '—', totalText: `SAR ${fmt(inv.total_amount)}` })),
        totals: [['Invoices exported', String(all.length)]],
        fileName: 'invoices-report.pdf', action,
      });
    } catch (e) { toast(e.message || 'Could not generate report.', 'error'); }
    finally { setReportBusy(''); }
  }

  const lineSubtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const lineTax = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0) * ((Number(l.tax_rate) || 0) / 100), 0);
  const hasLines = lines.some(l => l.description && Number(l.unit_price) > 0);

  function updateLine(i, patch) { setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l)); }
  function addLine() { setLines(ls => [...ls, emptyLine()]); }
  function removeLine(i) { setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls); }

  async function createInvoice() {
    setSaving(true);
    try {
      const payload = hasLines ? { ...form, lines: lines.filter(l => l.description) } : form;
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to create invoice');
      toast('Invoice created', 'success');
      setShowForm(false);
      setForm({});
      setLines([emptyLine()]);
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function updateStatus(id, newStatus) {
    const res = await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    if (res.ok) { toast('Status updated', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this invoice?')) return;
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Invoices</h1>
        <GlassButton onClick={() => setShowForm(true)}>+ New Invoice</GlassButton>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassInput placeholder="Search number or customer…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </GlassSelect>
          <DateFilter value={dateFilter} onChange={v => { setDateFilter(v); setPage(1); }} t={t} lang={lang} />
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!total || !!reportBusy}>{reportBusy === 'print' ? 'Preparing…' : 'Print'}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!total || !!reportBusy}>{reportBusy === 'save' ? 'Generating…' : 'Download PDF'}</GlassButton>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Number</GlassTh>
              <GlassTh>Customer</GlassTh>
              <GlassTh>Date</GlassTh>
              <GlassTh>Due</GlassTh>
              <GlassTh>Total</GlassTh>
              <GlassTh>Status</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd className="font-mono">{inv.invoice_number || inv.id.slice(0, 8)}</GlassTd>
                <GlassTd>{inv.customer_name}</GlassTd>
                <GlassTd>{inv.invoice_date}</GlassTd>
                <GlassTd className="text-slate-400">{inv.due_date || '—'}</GlassTd>
                <GlassTd>SAR {fmt(inv.total_amount)}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(inv.status)}>{inv.status}</GlassBadge></GlassTd>
                <GlassTd>
                  <div className="flex gap-1 flex-wrap">
                    <Link href={`/invoices/${inv.id}`}><GlassButton variant="secondary" size="sm">View</GlassButton></Link>
                    {inv.status === 'Draft' && <GlassButton variant="secondary" size="sm" onClick={() => updateStatus(inv.id, 'Sent')}>Send</GlassButton>}
                    {inv.status === 'Sent' && <GlassButton variant="secondary" size="sm" onClick={() => updateStatus(inv.id, 'Paid')}>Mark Paid</GlassButton>}
                    <GlassButton variant="danger" size="sm" onClick={() => del(inv.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!invoices.length && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-8">No invoices found.</td></tr>
            )}
          </tbody>
        </table>

        <ListPagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={v => { setPageSize(v); setPage(1); }} label="invoices" />
      </GlassCard>

      {showForm && (
        <GlassModal title="New Invoice" onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={createInvoice} disabled={saving}>{saving ? 'Creating…' : 'Create'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Customer Name" required>
              <GlassInput value={form.customer_name || ''} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
            </GlassField>
            <GlassField label="Customer Email">
              <GlassInput type="email" value={form.customer_email || ''} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} />
            </GlassField>
            <GlassField label="Invoice Date">
              <GlassInput type="date" value={form.invoice_date || ''} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Due Date">
              <GlassInput type="date" value={form.due_date || ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Currency">
              <GlassSelect value={form.currency || 'SAR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
              </GlassSelect>
            </GlassField>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Line Items</span>
              <GlassButton variant="secondary" size="sm" onClick={addLine}>+ Add Line</GlassButton>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5"><GlassInput placeholder="Description" value={l.description} onChange={e => updateLine(i, { description: e.target.value })} /></div>
                  <div className="col-span-2"><GlassInput type="number" placeholder="Qty" value={l.qty} onChange={e => updateLine(i, { qty: e.target.value })} /></div>
                  <div className="col-span-2"><GlassInput type="number" placeholder="Unit Price" value={l.unit_price} onChange={e => updateLine(i, { unit_price: e.target.value })} /></div>
                  <div className="col-span-2"><GlassInput type="number" placeholder="Tax %" value={l.tax_rate} onChange={e => updateLine(i, { tax_rate: e.target.value })} /></div>
                  <div className="col-span-1"><GlassButton variant="danger" size="sm" onClick={() => removeLine(i)} disabled={lines.length <= 1}>✕</GlassButton></div>
                </div>
              ))}
            </div>
            {hasLines ? (
              <div className="flex justify-end gap-6 mt-3 text-sm text-slate-300">
                <span>Subtotal: {fmt(lineSubtotal)}</span>
                <span>VAT: {fmt(lineTax)}</span>
                <span className="font-semibold text-white">Total: {fmt(lineSubtotal + lineTax)}</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 mt-3">
                <GlassField label="Subtotal (no line items)">
                  <GlassInput type="number" step="0.01" value={form.subtotal || ''} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} />
                </GlassField>
                <GlassField label="VAT Amount">
                  <GlassInput type="number" step="0.01" value={form.tax_amount || ''} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} />
                </GlassField>
                <GlassField label="Total Amount">
                  <GlassInput type="number" step="0.01" value={form.total_amount || ''} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
                </GlassField>
              </div>
            )}
          </div>
        </GlassModal>
      )}
    </div>
  );
}
