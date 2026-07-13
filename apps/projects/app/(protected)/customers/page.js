'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage } from '@/lib/i18n';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';

const EMPTY_FORM = { full_name: '', company_name: '', email: '', mobile_number: '', vat_number: '', cr_number: '', address: '', city: '', country: '', notes: '' };
const REFRESH_MS = 15000;

export default function CustomersPage() {
  const { t, formatDate } = useLanguage();
  const [me, setMe] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit'|'view', data }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const isAdmin = me?.role === 'admin';
  const url = '/api/customers' + (debouncedSearch ? '?search=' + encodeURIComponent(debouncedSearch) : '');
  const { data, error, refresh } = useLiveData(url, REFRESH_MS);
  const allCustomers = data?.customers || [];
  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(allCustomers);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const customers = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function saveCustomer(form, mode, id) {
    const url = mode === 'add' ? '/api/customers' : `/api/customers/${id}`;
    const res = await fetch(url, {
      method: mode === 'add' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const respData = await res.json();
    if (!res.ok) throw new Error(respData.error);
    setModal(null);
    refresh();
  }

  async function deleteCustomer(id) {
    if (!confirm(t('cust.deleteConfirm'))) return;
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) refresh();
    else { const d = await res.json().catch(() => ({})); alert(d.error || t('cust.couldNotDelete')); }
  }

  return (
    <Shell active="/customers">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('cust.title')}</h2>
          <p className="text-xs text-slate-500">{t('cust.breadcrumb')}</p>
        </div>
        {isAdmin && <button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">{t('cust.addCustomer')}</button>}
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4">
        <input placeholder={t('cust.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[950px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th onClick={() => toggleSort('full_name')} className="py-3 px-4 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('cust.col.fullName')}<SortIndicator column="full_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('company_name')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('cust.col.company')}<SortIndicator column="company_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('email')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('common.email')}<SortIndicator column="email" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('mobile_number')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('cust.col.mobile')}<SortIndicator column="mobile_number" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('vat_number')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('cust.col.vatNumber')}<SortIndicator column="vat_number" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('cr_number')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('cust.col.crNumber')}<SortIndicator column="cr_number" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('city')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('cust.col.city')}<SortIndicator column="city" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('created_at')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('cust.col.created')}<SortIndicator column="created_at" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={9} className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={9} className="py-8 text-center text-slate-400">{t('cust.noCustomersYet')}</td></tr>
            ) : customers.map(c => (
              <tr key={c.id} onClick={() => setModal({ mode: 'view', data: c })}
                className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-150">
                <td className="py-3 px-4 font-medium">{c.full_name}</td>
                <td>{c.company_name || '—'}</td>
                <td>{c.email || '—'}</td>
                <td>{c.mobile_number || '—'}</td>
                <td>{c.vat_number || '—'}</td>
                <td>{c.cr_number || '—'}</td>
                <td>{c.city || '—'}</td>
                <td>{formatDate(c.created_at)}</td>
                <td className="text-right px-4 space-x-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setModal({ mode: 'view', data: c })} title={t('common.view')} className="text-slate-400">{'\u{1F441}'}</button>
                  {isAdmin && <button onClick={() => setModal({ mode: 'edit', data: c })} title={t('common.edit')} className="text-brand-500">✎</button>}
                  {isAdmin && <button onClick={() => deleteCustomer(c.id)} title={t('common.delete')} className="text-red-500">🗑</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('common.showingEntries', { from: customers.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + customers.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('common.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">›</button>
        </div>
      </div>

      {modal && <CustomerModal modal={modal} isAdmin={isAdmin} onClose={() => setModal(null)} onSave={saveCustomer} />}
    </Shell>
  );
}

export function CustomerModal({ modal, isAdmin, onClose, onSave }) {
  const { t, formatDate } = useLanguage();
  const readOnly = modal.mode === 'view';
  const [form, setForm] = useState({ ...EMPTY_FORM, ...modal.data });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (readOnly) return;
    setBusy(true); setErr(null);
    try { await onSave(form, modal.mode, modal.data.id); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg">{modal.mode === 'add' ? t('cust.modal.addTitle') : modal.mode === 'edit' ? t('cust.modal.editTitle') : t('cust.modal.viewTitle')}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('cust.f.fullName')} value={form.full_name} onChange={set('full_name')} required disabled={readOnly} />
          <Field label={t('cust.f.companyName')} value={form.company_name || ''} onChange={set('company_name')} disabled={readOnly} />
          <Field label={t('common.email')} type="email" value={form.email || ''} onChange={set('email')} disabled={readOnly} />
          <Field label={t('cust.f.mobileNumber')} value={form.mobile_number || ''} onChange={set('mobile_number')} disabled={readOnly} />
          <Field label={t('cust.col.vatNumber')} value={form.vat_number || ''} onChange={set('vat_number')} disabled={readOnly} />
          <Field label={t('cust.col.crNumber')} value={form.cr_number || ''} onChange={set('cr_number')} disabled={readOnly} />
          <Field label={t('cust.f.city')} value={form.city || ''} onChange={set('city')} disabled={readOnly} />
          <Field label={t('cust.f.country')} value={form.country || ''} onChange={set('country')} disabled={readOnly} />
          <div className="col-span-2"><Field label={t('cust.f.address')} value={form.address || ''} onChange={set('address')} disabled={readOnly} /></div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('cust.f.notes')}</label>
            <textarea value={form.notes || ''} onChange={set('notes')} disabled={readOnly} rows={3}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm disabled:opacity-70" />
          </div>
          {modal.data.created_at && (
            <div className="col-span-2 text-xs text-slate-500">{t('cust.dateCreated', { date: formatDate(modal.data.created_at, { dateStyle: 'medium', timeStyle: 'short' }) })}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">{readOnly ? t('common.close') : t('common.cancel')}</button>
          {!readOnly && <button disabled={busy} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? t('common.saving') : t('common.save')}</button>}
        </div>
      </form>
    </div>
  );
}
function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input {...props} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm disabled:opacity-70" />
    </div>
  );
}
