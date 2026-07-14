'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage } from '@/lib/i18n';
import { Button, Input, Field, Textarea, Modal, EmptyState, Th, Td } from '@/components/ui';

const sortHeaderCls = 'cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#3d3d33] dark:hover:text-white/90 transition-colors';

export default function MaintenanceShopsPage() {
  const { t } = useLanguage();
  const [me, setMe] = useState(null);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const isAdmin = me?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search: debouncedSearch });
      const res = await fetch('/api/shops?' + q.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShops(data.shops); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [debouncedSearch]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(shops);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function deleteShop(id) {
    if (!confirm(t('shops.confirmDelete'))) return;
    const res = await fetch(`/api/shops/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || t('shops.deleteFailed')); return; }
    load();
  }

  return (
    <Shell active="/maintenance-shops">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('shops.title')}</h2>
          <p className="text-xs text-[#8C8A80]">{t('shops.breadcrumb')}</p>
        </div>
        {isAdmin && <Button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>+ {t('shops.addShop')}</Button>}
      </div>

      <Input placeholder={t('shops.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm mb-4" />

      {error && <div className="text-[#BC6B4E] text-sm mb-3">{error}</div>}

      <div className="glass-card overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="sticky top-0 z-10 bg-[#F7F5F1]/95 dark:bg-[#1B1B14]/95 backdrop-blur-sm border-b border-[#E5E2DD]/70 dark:border-white/[0.06]">
            <tr>
              <Th><span onClick={() => toggleSort('name')} className={sortHeaderCls}>{t('shops.colName')}<SortIndicator column="name" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('contact_person')} className={sortHeaderCls}>{t('shops.colContact')}<SortIndicator column="contact_person" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('mobile')} className={sortHeaderCls}>{t('shops.colMobile')}<SortIndicator column="mobile" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('city')} className={sortHeaderCls}>{t('shops.colCity')}<SortIndicator column="city" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('vat_number')} className={sortHeaderCls}>{t('shops.colVat')}<SortIndicator column="vat_number" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              {isAdmin && <Th className="text-end">{t('shops.colActions')}</Th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-[#8C8A80]">{t('shops.loading')}</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={6}><EmptyState text={t('shops.noneYet')} /></td></tr>
            ) : pageRows.map(s => (
              <tr key={s.id} className="hover:bg-[#F7F5F1] dark:hover:bg-white/[0.03]">
                <Td className="font-medium">{s.name}</Td>
                <Td>{s.contact_person || '—'}</Td>
                <Td>{s.mobile || '—'}</Td>
                <Td>{s.city || '—'}</Td>
                <Td>{s.vat_number || '—'}</Td>
                {isAdmin && (
                  <Td className="text-end">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => setModal({ mode: 'edit', data: s })} title={t('shops.edit')} className="text-brand-600 dark:text-brand-400 hover:underline">✎</button>
                      <button onClick={() => deleteShop(s.id)} title={t('shops.delete')} className="text-[#BC6B4E] hover:underline">🗑</button>
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-[#8C8A80] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('shops.showingEntries', { from: pageRows.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + pageRows.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('shops.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[#F1EEE7] dark:hover:bg-white/5">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[#F1EEE7] dark:hover:bg-white/5">›</button>
        </div>
      </div>

      {modal && <ShopModal modal={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </Shell>
  );
}

export const EMPTY_FORM = { name: '', contact_person: '', mobile: '', telephone: '', email: '', address: '', city: '', vat_number: '', cr_number: '', notes: '' };

export function ShopModal({ modal, onClose, onSaved }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(modal.data);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const url = modal.mode === 'add' ? '/api/shops' : `/api/shops/${modal.data.id}`;
      const res = await fetch(url, {
        method: modal.mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.shop);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <Modal title={modal.mode === 'add' ? t('shops.addModalTitle') : t('shops.editModalTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-[#BC6B4E] text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('shops.colName')} required className="col-span-2"><Input value={form.name} onChange={set('name')} required /></Field>
          <Field label={t('shops.colContact')}><Input value={form.contact_person} onChange={set('contact_person')} /></Field>
          <Field label={t('shops.colMobile')}><Input value={form.mobile} onChange={set('mobile')} /></Field>
          <Field label={t('fields.telephone')}><Input value={form.telephone} onChange={set('telephone')} /></Field>
          <Field label={t('fields.email')}><Input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label={t('fields.address')} className="col-span-2"><Input value={form.address} onChange={set('address')} /></Field>
          <Field label={t('shops.colCity')}><Input value={form.city} onChange={set('city')} /></Field>
          <Field label={t('shops.colVat')}><Input value={form.vat_number} onChange={set('vat_number')} /></Field>
          <Field label={t('fields.crNumber')}><Input value={form.cr_number} onChange={set('cr_number')} /></Field>
          <Field label={t('fields.notes')} className="col-span-2"><Textarea rows={2} value={form.notes || ''} onChange={set('notes')} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('shops.cancel')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('shops.saving') : t('shops.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
