'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { ListPagination } from '@/components/ListPagination';
import { useLanguage } from '@/lib/i18n';
import { Button, Input, Field, Textarea, Modal, EmptyState, Th, Td } from '@/components/ui';
import ColumnPicker, { useColumnPrefs, pdfColumns, pdfRows } from '@/components/ColumnPicker';

const sortHeaderCls = 'cursor-pointer select-none inline-flex items-center gap-1 hover:text-[color:var(--tx)] transition-colors';

export default function MaintenanceShopsPage() {
  const { t, lang } = useLanguage();
  const [me, setMe] = useState(null);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reportBusy, setReportBusy] = useState('');
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

  const cols = [
    { key: 'name', label: t('shops.colName'), sort: 'name', className: 'font-medium', render: x => x.name, pdf: x => x.name || '—' },
    { key: 'contact', label: t('shops.colContact'), sort: 'contact_person', render: x => x.contact_person || '—', pdf: x => x.contact_person || '—' },
    { key: 'mobile', label: t('shops.colMobile'), sort: 'mobile', render: x => x.mobile || '—', pdf: x => x.mobile || '—' },
    { key: 'city', label: t('shops.colCity'), sort: 'city', render: x => x.city || '—', pdf: x => x.city || '—' },
    { key: 'vat', label: t('shops.colVat'), sort: 'vat_number', render: x => x.vat_number || '—', pdf: x => x.vat_number || '—' },
    ...(isAdmin ? [{ key: 'actions', label: t('shops.colActions'), required: true, noPdf: true, stop: true, className: 'text-end whitespace-nowrap', render: x => (
      <div className="flex items-center justify-end gap-3">
        <button onClick={() => setModal({ mode: 'edit', data: x })} title={t('shops.edit')} aria-label={t('shops.edit') + ' ' + x.name} className="text-brand-600 dark:text-brand-400 hover:underline">✎</button>
        <button onClick={() => deleteShop(x.id)} title={t('shops.delete')} aria-label={t('shops.delete') + ' ' + x.name} className="text-[#ef4444] hover:underline">🗑</button>
      </div>
    ) }] : []),
  ];
  const prefs = useColumnPrefs('maintenance-shops', cols);
  const { visibleCols } = prefs;

  async function runReport(action) {
    setReportBusy(action);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      const ar = lang === 'ar';
      await exportReportPdf({
        title: ar ? 'تقرير ورش الصيانة' : 'Maintenance Shops Report',
        columns: pdfColumns(visibleCols),
        rows: pdfRows(visibleCols, sorted),
        lang, fileName: 'maintenance-shops-report.pdf', action,
      });
    } catch (e) { /* no-op — report generation failures shouldn't disrupt the page */ }
    finally { setReportBusy(''); }
  }

  return (
    <Shell active="/maintenance-shops">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('shops.title')}</h2>
          <p className="text-xs text-[color:var(--tx-3)]">{t('shops.breadcrumb')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnPicker columns={cols} prefs={prefs} />
          <Button variant="ghost" onClick={() => runReport('print')} disabled={!sorted.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('common.print')}</Button>
          <Button variant="ghost" onClick={() => runReport('save')} disabled={!sorted.length || !!reportBusy}>{reportBusy === 'save' ? '…' : t('common.downloadPdf')}</Button>
          {isAdmin && <Button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>+ {t('shops.addShop')}</Button>}
        </div>
      </div>

      <Input placeholder={t('shops.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm mb-4" />

      {error && <div className="text-[#ef4444] text-sm mb-3">{error}</div>}

      <div className="glass-card overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
            <tr>
              {visibleCols.map(c => c.sort
                ? <Th key={c.key} className={c.className || ''}><span onClick={() => toggleSort(c.sort)} className={sortHeaderCls}>{c.label}<SortIndicator column={c.sort} sortKey={sortKey} sortDir={sortDir} /></span></Th>
                : <Th key={c.key} className={c.className || ''}>{c.label}</Th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={visibleCols.length} className="py-8 text-center text-[color:var(--tx-3)]">{t('shops.loading')}</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={visibleCols.length}><EmptyState text={t('shops.noneYet')} /></td></tr>
            ) : pageRows.map((r, i) => (
              <tr key={r.id} className="hover:bg-[color:var(--pr-soft)]">
                {visibleCols.map(c => <Td key={c.key} className={c.className || ''} onClick={c.stop ? e => e.stopPropagation() : undefined}>{c.render(r, i)}</Td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ListPagination
        page={page} pageSize={pageSize} total={total} count={pageRows.length}
        onPage={setPage} onPageSize={v => { setPageSize(v); setPage(1); }}
        showingLabel={({ from, to, total }) => t('shops.showingEntries', { from, to, total })}
        rowsLabel={t('shops.rows')}
      />

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
    finally { setBusy(false); }
  }

  return (
    <Modal title={modal.mode === 'add' ? t('shops.addModalTitle') : t('shops.editModalTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-[#ef4444] text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('shops.colName')} required className="col-span-2"><Input value={form.name || ''} onChange={set('name')} required /></Field>
          <Field label={t('shops.colContact')}><Input value={form.contact_person || ''} onChange={set('contact_person')} /></Field>
          <Field label={t('shops.colMobile')}><Input value={form.mobile || ''} onChange={set('mobile')} /></Field>
          <Field label={t('fields.telephone')}><Input value={form.telephone || ''} onChange={set('telephone')} /></Field>
          <Field label={t('fields.email')}><Input type="email" value={form.email || ''} onChange={set('email')} /></Field>
          <Field label={t('fields.address')} className="col-span-2"><Input value={form.address || ''} onChange={set('address')} /></Field>
          <Field label={t('shops.colCity')}><Input value={form.city || ''} onChange={set('city')} /></Field>
          <Field label={t('shops.colVat')}><Input value={form.vat_number || ''} onChange={set('vat_number')} /></Field>
          <Field label={t('fields.crNumber')}><Input value={form.cr_number || ''} onChange={set('cr_number')} /></Field>
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
