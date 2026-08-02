'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, toast } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
function statusTone(s) { return s === 'Paid' ? 'success' : s === 'Overdue' ? 'error' : s === 'Sent' ? 'info' : 'neutral'; }

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, refresh } = useLiveData(`/api/invoices/${id}`, 0);

  if (loading) return <div className="text-center text-slate-400 py-12">Loading…</div>;
  if (!data) return <div className="text-center text-slate-400 py-12">Invoice not found.</div>;

  const { invoice, lines } = data;

  async function setStatus(status) {
    const res = await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { toast('Updated', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  async function del() {
    if (!confirm('Delete this invoice?')) return;
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); router.push('/invoices'); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4 print:text-black">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/invoices"><GlassButton variant="secondary" size="sm">← Back</GlassButton></Link>
          <h1 className="text-2xl font-bold text-white">{invoice.invoice_number || invoice.id.slice(0, 8)}</h1>
          <GlassBadge tone={statusTone(invoice.status)}>{invoice.status}</GlassBadge>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'Draft' && <GlassButton onClick={() => setStatus('Sent')}>Send</GlassButton>}
          {invoice.status === 'Sent' && <GlassButton onClick={() => setStatus('Paid')}>Mark Paid</GlassButton>}
          <GlassButton variant="secondary" onClick={() => window.print()}>Print / PDF</GlassButton>
          <GlassButton variant="danger" onClick={del}>Delete</GlassButton>
        </div>
      </div>

      <GlassCard>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-slate-400">Bill To</p>
            <p className="text-white font-semibold">{invoice.customer_name}</p>
            {invoice.customer_email && <p className="text-slate-400">{invoice.customer_email}</p>}
            {invoice.customer_address && <p className="text-slate-400">{invoice.customer_address}</p>}
          </div>
          <div className="text-end">
            <p className="text-slate-400">Invoice Date: <span className="text-white">{invoice.invoice_date}</span></p>
            <p className="text-slate-400">Due Date: <span className="text-white">{invoice.due_date || '—'}</span></p>
            <p className="text-slate-400">Currency: <span className="text-white">{invoice.currency}</span></p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Line Items</h3>
        {!lines.length ? (
          <p className="text-slate-500 text-sm">No line items — totals were entered directly.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="text-start py-2">Description</th>
                <th className="text-end py-2">Qty</th>
                <th className="text-end py-2">Unit Price</th>
                <th className="text-end py-2">Tax %</th>
                <th className="text-end py-2">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.id} className="border-b border-white/5">
                  <td className="py-2 text-white">{l.description}</td>
                  <td className="py-2 text-end">{fmt(l.qty)}</td>
                  <td className="py-2 text-end">{fmt(l.unit_price)}</td>
                  <td className="py-2 text-end">{fmt(l.tax_rate)}%</td>
                  <td className="py-2 text-end font-semibold">{fmt(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-end mt-4 pt-4 border-t border-white/10">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span className="text-white">{invoice.currency} {fmt(invoice.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">VAT</span><span className="text-white">{invoice.currency} {fmt(invoice.tax_amount)}</span></div>
            <div className="flex justify-between text-base font-bold"><span className="text-white">Total</span><span className="text-cyan-400">{invoice.currency} {fmt(invoice.total_amount)}</span></div>
          </div>
        </div>
        {invoice.notes && <p className="mt-4 text-slate-400 text-sm">{invoice.notes}</p>}
      </GlassCard>
    </div>
  );
}
