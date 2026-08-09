'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';

const STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Partially Paid'];
function statusTone(s) { return s === 'Paid' ? 'success' : s === 'Overdue' ? 'error' : s === 'Sent' ? 'info' : 'neutral'; }
function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
const emptyLine = () => ({ description: '', qty: 1, unit_price: '', tax_rate: 15 });

export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [lines, setLines] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  const params = new URLSearchParams({ page, pageSize });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const { data, refresh } = useLiveData(`/api/invoices?${params}`, 15000);
  const invoices = data?.invoices || [];

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

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage} />
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
