'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage } from '@/lib/i18n';
import {
  GlassPage, GlassButton, GlassDropdown, GlassSearch,
  GlassThead, GlassTr, GlassTd, GlassField, GlassInput, GlassTextarea, GlassModal, GlassEmptyState, GlassLoader,
} from '@/components/glass';

const TH = 'text-start px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--tx-4)] font-semibold whitespace-nowrap';
const THsort = TH + ' cursor-pointer select-none hover:text-[var(--pr-2)] transition-colors';

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

  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} className={THsort}>{label}<SortIndicator column={col} sortKey={sortKey} sortDir={sortDir} /></th>
  );

  return (
    <Shell active="/maintenance-shops">
      <GlassPage
        title={t('shops.title')}
        subtitle={t('shops.breadcrumb')}
        toolbar={isAdmin && <GlassButton onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>+ {t('shops.addShop')}</GlassButton>}
      >
        <GlassSearch className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('shops.searchPlaceholder')} />

        {error && <div className="text-[#F87171] text-sm">{error}</div>}

        <div className="glass-card !rounded-[22px] overflow-auto max-h-[70vh]">
          <table className="w-full min-w-[800px]">
            <GlassThead>
              <tr>
                <SortTh col="name" label={t('shops.colName')} />
                <SortTh col="contact_person" label={t('shops.colContact')} />
                <SortTh col="mobile" label={t('shops.colMobile')} />
                <SortTh col="city" label={t('shops.colCity')} />
                <SortTh col="vat_number" label={t('shops.colVat')} />
                {isAdmin && <th className={TH + ' text-end'}>{t('shops.colActions')}</th>}
              </tr>
            </GlassThead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><GlassLoader label={t('shops.loading')} /></td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={6}><GlassEmptyState text={t('shops.noneYet')} /></td></tr>
              ) : pageRows.map(s => (
                <GlassTr key={s.id}>
                  <GlassTd className="font-semibold !text-[var(--tx)]">{s.name}</GlassTd>
                  <GlassTd>{s.contact_person || '—'}</GlassTd>
                  <GlassTd>{s.mobile || '—'}</GlassTd>
                  <GlassTd>{s.city || '—'}</GlassTd>
                  <GlassTd>{s.vat_number || '—'}</GlassTd>
                  {isAdmin && (
                    <GlassTd className="text-end whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <IconBtn title={t('shops.edit')} tone="brand" onClick={() => setModal({ mode: 'edit', data: s })}>✎</IconBtn>
                        <IconBtn title={t('shops.delete')} tone="red" onClick={() => deleteShop(s.id)}>🗑</IconBtn>
                      </span>
                    </GlassTd>
                  )}
                </GlassTr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-[var(--tx-4)] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span>{t('shops.showingEntries', { from: pageRows.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + pageRows.length, total })}</span>
            <div className="flex items-center gap-1.5">
              <span>{t('shops.rows')}</span>
              <GlassDropdown className="w-24" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PageBtn disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</PageBtn>
            <span className="text-[var(--tx-2)]">{page} / {totalPages}</span>
            <PageBtn disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</PageBtn>
          </div>
        </div>
      </GlassPage>

      {modal && <ShopModal modal={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </Shell>
  );
}

function IconBtn({ children, title, onClick, tone }) {
  const color = tone === 'brand' ? 'text-[var(--pr-2)]' : tone === 'red' ? 'text-[#F87171]' : 'text-[var(--tx-4)]';
  return (
    <button onClick={onClick} title={title}
      className={'h-8 w-8 rounded-lg border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl hover:border-[rgba(37,212,255,0.4)] transition-colors flex items-center justify-center ' + color}>
      {children}
    </button>
  );
}
function PageBtn({ children, disabled, onClick }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className="h-8 min-w-8 px-2 rounded-lg border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl text-[var(--tx-2)] disabled:opacity-40 hover:border-[rgba(37,212,255,0.4)] hover:text-[var(--pr-2)] transition-colors">
      {children}
    </button>
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
    <GlassModal title={modal.mode === 'add' ? t('shops.addModalTitle') : t('shops.editModalTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-[#F87171] text-sm">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GlassField className="sm:col-span-2" label={t('shops.colName')} required><GlassInput value={form.name || ''} onChange={set('name')} required /></GlassField>
          <GlassField label={t('shops.colContact')}><GlassInput value={form.contact_person || ''} onChange={set('contact_person')} /></GlassField>
          <GlassField label={t('shops.colMobile')}><GlassInput value={form.mobile || ''} onChange={set('mobile')} /></GlassField>
          <GlassField label={t('fields.telephone')}><GlassInput value={form.telephone || ''} onChange={set('telephone')} /></GlassField>
          <GlassField label={t('fields.email')}><GlassInput type="email" value={form.email || ''} onChange={set('email')} /></GlassField>
          <GlassField className="sm:col-span-2" label={t('fields.address')}><GlassInput value={form.address || ''} onChange={set('address')} /></GlassField>
          <GlassField label={t('shops.colCity')}><GlassInput value={form.city || ''} onChange={set('city')} /></GlassField>
          <GlassField label={t('shops.colVat')}><GlassInput value={form.vat_number || ''} onChange={set('vat_number')} /></GlassField>
          <GlassField label={t('fields.crNumber')}><GlassInput value={form.cr_number || ''} onChange={set('cr_number')} /></GlassField>
          <GlassField className="sm:col-span-2" label={t('fields.notes')}><GlassTextarea value={form.notes || ''} onChange={set('notes')} rows={2} /></GlassField>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <GlassButton type="button" variant="ghost" onClick={onClose}>{t('shops.cancel')}</GlassButton>
          <GlassButton type="submit" disabled={busy}>{busy ? t('shops.saving') : t('shops.save')}</GlassButton>
        </div>
      </form>
    </GlassModal>
  );
}
