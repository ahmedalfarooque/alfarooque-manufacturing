'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage } from '@/lib/i18n';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { Button, Input, Textarea, Field, Modal, EmptyState, Th, Td } from '@/components/ui';

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
          <p className="text-xs text-[color:var(--tx-3)]">{t('cust.breadcrumb')}</p>
        </div>
        {isAdmin && <Button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>{t('cust.addCustomer')}</Button>}
      </div>

      <div className="glass-card p-4 mb-4">
        <Input placeholder={t('cust.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="w-full max-w-md" />
      </div>

      {error && <div className="text-sm text-[#ef4444] mb-3">{error}</div>}

      <div className="glass-card overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm min-w-[950px]">
            <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
              <tr>
                <Th><span onClick={() => toggleSort('full_name')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('cust.col.fullName')}<SortIndicator column="full_name" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th><span onClick={() => toggleSort('company_name')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('cust.col.company')}<SortIndicator column="company_name" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th><span onClick={() => toggleSort('email')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('common.email')}<SortIndicator column="email" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th><span onClick={() => toggleSort('mobile_number')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('cust.col.mobile')}<SortIndicator column="mobile_number" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th><span onClick={() => toggleSort('vat_number')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('cust.col.vatNumber')}<SortIndicator column="vat_number" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th><span onClick={() => toggleSort('cr_number')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('cust.col.crNumber')}<SortIndicator column="cr_number" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th><span onClick={() => toggleSort('city')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('cust.col.city')}<SortIndicator column="city" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th><span onClick={() => toggleSort('created_at')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('cust.col.created')}<SortIndicator column="created_at" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th className="text-end">{t('common.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={9} className="py-8 text-center text-[color:var(--tx-3)]">{t('common.loading')}</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={9}><EmptyState text={t('cust.noCustomersYet')} /></td></tr>
              ) : customers.map(c => (
                <tr key={c.id} onClick={() => setModal({ mode: 'view', data: c })}
                  className="cursor-pointer transition-colors duration-150 hover:bg-[color:var(--pr-soft)]">
                  <Td className="font-medium">{c.full_name}</Td>
                  <Td>{c.company_name || '—'}</Td>
                  <Td>{c.email || '—'}</Td>
                  <Td>{c.mobile_number || '—'}</Td>
                  <Td>{c.vat_number || '—'}</Td>
                  <Td>{c.cr_number || '—'}</Td>
                  <Td>{c.city || '—'}</Td>
                  <Td>{formatDate(c.created_at)}</Td>
                  <Td className="text-end whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setModal({ mode: 'view', data: c })} title={t('common.view')} className="text-[color:var(--tx-3)] me-3">{'\u{1F441}'}</button>
                    {isAdmin && <button onClick={() => setModal({ mode: 'edit', data: c })} title={t('common.edit')} className="text-brand-600 dark:text-brand-400 me-3">✎</button>}
                    {isAdmin && <button onClick={() => deleteCustomer(c.id)} title={t('common.delete')} className="text-[#ef4444]">🗑</button>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-[color:var(--tx-3)] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('common.showingEntries', { from: customers.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + customers.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('common.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1">‹</Button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1">›</Button>
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
    <Modal title={modal.mode === 'add' ? t('cust.modal.addTitle') : modal.mode === 'edit' ? t('cust.modal.editTitle') : t('cust.modal.viewTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-sm text-[#ef4444]">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('cust.f.fullName')} required><Input value={form.full_name} onChange={set('full_name')} required disabled={readOnly} className="disabled:opacity-70" /></Field>
          <Field label={t('cust.f.companyName')}><Input value={form.company_name || ''} onChange={set('company_name')} disabled={readOnly} className="disabled:opacity-70" /></Field>
          <Field label={t('common.email')}><Input type="email" value={form.email || ''} onChange={set('email')} disabled={readOnly} className="disabled:opacity-70" /></Field>
          <Field label={t('cust.f.mobileNumber')}><Input value={form.mobile_number || ''} onChange={set('mobile_number')} disabled={readOnly} className="disabled:opacity-70" /></Field>
          <Field label={t('cust.col.vatNumber')}><Input value={form.vat_number || ''} onChange={set('vat_number')} disabled={readOnly} className="disabled:opacity-70" /></Field>
          <Field label={t('cust.col.crNumber')}><Input value={form.cr_number || ''} onChange={set('cr_number')} disabled={readOnly} className="disabled:opacity-70" /></Field>
          <Field label={t('cust.f.city')}><Input value={form.city || ''} onChange={set('city')} disabled={readOnly} className="disabled:opacity-70" /></Field>
          <Field label={t('cust.f.country')}><Input value={form.country || ''} onChange={set('country')} disabled={readOnly} className="disabled:opacity-70" /></Field>
          <div className="col-span-2"><Field label={t('cust.f.address')}><Input value={form.address || ''} onChange={set('address')} disabled={readOnly} className="disabled:opacity-70" /></Field></div>
          <div className="col-span-2">
            <Field label={t('cust.f.notes')}><Textarea value={form.notes || ''} onChange={set('notes')} disabled={readOnly} className="disabled:opacity-70" /></Field>
          </div>
          {modal.data.created_at && (
            <div className="col-span-2 text-xs text-[color:var(--tx-3)]">{t('cust.dateCreated', { date: formatDate(modal.data.created_at, { dateStyle: 'medium', timeStyle: 'short' }) })}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{readOnly ? t('common.close') : t('common.cancel')}</Button>
          {!readOnly && <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</Button>}
        </div>
      </form>
    </Modal>
  );
}
