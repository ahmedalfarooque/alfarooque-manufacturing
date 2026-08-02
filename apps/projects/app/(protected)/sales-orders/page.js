'use client';

import { useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Button, Field, Input, Modal, Textarea } from '@/components/ui';

const REFRESH_MS = 15000;
const STATUSES = ['Draft', 'Reserved', 'Delivered', 'Invoiced', 'Paid', 'Cancelled'];
export const SO_STATUS_BADGE = {
  Draft: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  Reserved: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Delivered: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  Invoiced: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
function money(n, c) { return `${c || 'SAR'} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`; }

export default function SalesOrdersPage() {
  const { t } = useLanguage();
  const [status, setStatus] = useState('All');
  const [modal, setModal] = useState(false);
  const { data, error, refresh } = useLiveData('/api/sales-orders', REFRESH_MS);
  const rows = data?.salesOrders || [];

  const filtered = useMemo(() => status === 'All' ? rows : rows.filter(r => r.status === status), [rows, status]);

  return (
    <Shell active="/sales-orders">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold">{t('so.title')}</h2>
        <Button onClick={() => setModal(true)}>{t('so.new')}</Button>
      </div>

      <div className="glass-card glass-card--pad mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Dropdown value={status} onChange={setStatus} options={['All', ...STATUSES].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="glass-card overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-[color:var(--tx-3)] font-medium sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl border-b border-[color:var(--bd)]">
            <tr>
              <th className="py-3 px-4 whitespace-nowrap">{t('so.col.number')}</th>
              <th className="px-3 py-2.5 whitespace-nowrap">{t('so.col.customer')}</th>
              <th className="px-3 py-2.5 whitespace-nowrap">{t('so.col.total')}</th>
              <th className="px-3 py-2.5 whitespace-nowrap">{t('so.col.status')}</th>
              <th className="px-3 py-2.5 whitespace-nowrap">{t('so.col.date')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={5} className="py-8 text-center text-[color:var(--tx-3)]">{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-[color:var(--tx-3)]">{t('so.noneFound')}</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-b border-[color:var(--bd)] last:border-0 hover:bg-[color:var(--pr-soft)] cursor-pointer" onClick={() => window.location.href = '/sales-orders/' + r.id}>
                <td className="py-2.5 px-4 whitespace-nowrap" dir="ltr">{r.so_number || r.id.slice(0, 8)}</td>
                <td className="px-3 py-2.5">{r.customer_name}</td>
                <td className="px-3 py-2.5 whitespace-nowrap" dir="ltr">{money(r.total_amount, r.currency)}</td>
                <td className="px-3 py-2.5"><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (SO_STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span></td>
                <td className="px-3 py-2.5 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <NewSalesOrderModal onClose={() => setModal(false)} onSaved={id => { setModal(false); refresh(); window.location.href = '/sales-orders/' + id; }} />}
    </Shell>
  );
}

function NewSalesOrderModal({ onClose, onSaved }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ customer_name: '', currency: 'SAR', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sales-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || t('common.genericError'));
      onSaved(d.salesOrder.id);
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <Modal title={t('so.new').replace(/^\+\s*/, '')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-sm text-[#ef4444]">{err}</div>}
        <Field label={t('so.customer')}><Input value={form.customer_name} onChange={set('customer_name')} required /></Field>
        <Field label={t('so.currency')}><Input value={form.currency} onChange={set('currency')} /></Field>
        <Field label={t('so.notes')}><Textarea value={form.notes} onChange={set('notes')} rows={3} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2 rounded-lg border border-[color:var(--bd)]">{t('common.cancel')}</button>
          <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
