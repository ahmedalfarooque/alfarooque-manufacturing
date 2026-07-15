'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage, codeLabel } from '@/lib/i18n';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Button, Input, Textarea, Select, Field, Modal, EmptyState, Th, Td, Pagination } from '@/components/ui';

const CATEGORIES = ['DOORS', 'WINDOWS', 'KITCHEN', 'FURNITURE', 'CHAIRS', 'SOFA', 'CUPBOARDS',
  'TABLES', 'COUNTERS', 'CLADDING', 'CURTAINS', 'STEEL', 'ALUMINIUM', 'GLASS', 'OTHER'];
const SUBCAT_HINTS = {
  DOORS: ['Interior', 'Exterior', 'Fire Rated', 'Sliding', 'Flush', 'Hotel'],
  WINDOWS: ['Aluminium', 'Wood', 'Sliding', 'Fixed'],
  KITCHEN: ['Base Unit', 'Wall Unit', 'Island', 'Countertop'],
  FURNITURE: ['Bedroom', 'Office', 'Outdoor', 'Custom'],
};

export default function CataloguePage() {
  const { t, tr, trL, lang, formatNumber, formatDate } = useLanguage();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [subCatMap, setSubCatMap] = useState({});
  const [status, setStatus] = useState('');
  const dq = useDebouncedValue(q, 300);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [stale, setStale] = useState(null);        // { count, products } | null
  const [recalcBusy, setRecalcBusy] = useState(false);

  const loadStale = useCallback(() => {
    fetch('/api/catalogue/stale', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setStale(d && d.count > 0 ? d : null))
      .catch(() => {});
  }, []);
  useEffect(() => { loadStale(); }, [loadStale]);

  /* Category/sub-category filter options come from the data itself
     (free text, e.g. imported from an external product sheet) rather
     than a fixed enum, so every real value is always filterable. */
  const loadCategories = useCallback(() => {
    fetch('/api/catalogue/categories', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setCategories(d.categories || []); setSubCatMap(d.subCategoriesByCategory || {}); } })
      .catch(() => {});
  }, []);
  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { setSubCategory(''); }, [category]);

  async function recalcAll(ids) {
    setRecalcBusy(true);
    const res = await fetch('/api/catalogue/stale', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(ids ? { ids } : { all: true }),
    }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    setRecalcBusy(false);
    setImportResult(d ? t('catalogue.recalcDone', { n: d.recalculated }) : '⚠ Failed');
    setStale(null);
    loadStale();
    load();
  }

  const load = useCallback(() => {
    fetch(`/api/catalogue?q=${encodeURIComponent(dq)}&category=${encodeURIComponent(category)}&sub=${encodeURIComponent(subCategory)}&status=${status}&page=${page}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [], total: 0 })
      .then(d => { setRows(d.rows || []); setTotal(d.total || 0); })
      .catch(() => { setRows([]); setTotal(0); });
  }, [dq, category, subCategory, status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq, category, subCategory, status]);

  const name = (r) => trL(r, 'name');

  function marginOf(r) {
    const price = Number(r.standard_price), cost = Number(r.last_calculated_cost);
    if (!price || !cost) return null;
    return (price - cost) / price * 100;
  }

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/catalogue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.genericError'));
      window.location.href = '/catalogue/' + d.row.id;
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  async function setArchived(row, archived) {
    await fetch('/api/catalogue/' + row.id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ status: archived ? 'archived' : 'active' }),
    }).catch(() => {});
    load();
  }

  async function duplicateRow(row) {
    const res = await fetch('/api/catalogue/' + row.id + '/duplicate', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (d && d.id) window.location.href = '/catalogue/' + d.id;
  }

  async function removeRow(row) {
    if (!window.confirm(t('common.confirmDelete') + '\n' + (name(row) || row.code))) return;
    const res = await fetch('/api/catalogue/' + row.id, { method: 'DELETE', credentials: 'same-origin' }).catch(() => null);
    if (res && !res.ok) {
      const d = await res.json().catch(() => ({}));
      setImportResult('⚠ ' + (d.error || t('common.genericError')));
    }
    load();
  }

  async function doImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/products', { method: 'POST', credentials: 'same-origin', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.importFailed'));
      setImportResult(t('import.productsResult', { ok: d.inserted + d.updated, created: d.inserted, updated: d.updated, failed: d.failed }) +
        (d.errors && d.errors.length ? ' — ' + d.errors.slice(0, 3).join(' | ') : ''));
      load();
    } catch (e2) { setImportResult('⚠ ' + e2.message); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <Shell active="/catalogue">
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('catalogue.searchPlaceholder')} className="max-w-xs" />
          <Select value={category} onChange={e => setCategory(e.target.value)} className="max-w-[170px]"
            options={[{ value: '', label: t('common.allCategories') }, ...categories.map(c => ({ value: c, label: codeLabel(t, 'cat', c) }))]} />
          {category && (subCatMap[category] || []).length > 0 && (
            <Select value={subCategory} onChange={e => setSubCategory(e.target.value)} className="max-w-[170px]"
              options={[{ value: '', label: t('common.all') }, ...(subCatMap[category] || []).map(s => ({ value: s, label: s }))]} />
          )}
          <Select value={status} onChange={e => setStatus(e.target.value)} className="max-w-[140px]"
            options={[{ value: '', label: t('status.active') }, { value: 'archived', label: t('status.archived') }]} />
          <div className="flex-1" />
          <a href={'/api/export/products?template=1&lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.template')}</a>
          <a href={'/api/export/products?lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.export')}</a>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={doImport} />
          <Button variant="ghost" disabled={importing} onClick={() => fileRef.current && fileRef.current.click()}>
            {importing ? t('common.importing') : '⇪ ' + t('common.importExcel')}
          </Button>
          <Button onClick={() => { setForm({ unit: 'nos', category: 'OTHER' }); setErr(null); setModal(true); }}>+ {t('catalogue.newProduct')}</Button>
        </div>
        {importResult && <div className="mx-4 mb-2 rounded-lg bg-brand-600/10 border border-brand-600/25 px-3 py-2 text-sm">{importResult}</div>}
        {stale && (
          <div className="mx-4 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm flex flex-wrap items-center gap-3">
            <span>⚠ {t('catalogue.staleCount', { n: stale.count })}</span>
            <span className="text-[11px] text-[color:var(--tx-3)] truncate max-w-[40ch]">
              {stale.products.slice(0, 5).map(p => trL(p, 'name')).join(' · ')}{stale.count > 5 ? ' …' : ''}
            </span>
            <span className="flex-1" />
            <Button disabled={recalcBusy} onClick={() => recalcAll()}>
              {recalcBusy ? t('shell.loading') : t('catalogue.recalcAll', { n: stale.count })}
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <Th> </Th><Th>{t('f.code')}</Th><Th>{t('f.name')}</Th><Th>{t('catalogue.categorySub')}</Th><Th>{t('f.unit')}</Th>
              <Th>{t('catalogue.standardPrice')}</Th><Th>{t('catalogue.lastCost')}</Th><Th>{t('cost.margin')}</Th>
              <Th>{t('common.updated')}</Th><Th className="text-end">{t('common.actions')}</Th>
            </tr></thead>
            <tbody>
              {rows === null ? (
                <tr><Td colSpan={10} className="text-center text-[color:var(--tx-3)]">{t('shell.loading')}</Td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10}><EmptyState text={t('common.noRecords')} /></td></tr>
              ) : rows.map(r => {
                const m = marginOf(r);
                return (
                  <tr key={r.id} className="hover:bg-[color:var(--pr-soft)] cursor-pointer"
                    onClick={() => { window.location.href = '/catalogue/' + r.id; }}>
                    <Td>
                      {r.image_path
                        ? <img src={r.image_path} alt="" loading="lazy" className="h-9 w-9 rounded object-cover" />
                        : <div className="h-9 w-9 rounded bg-[color:var(--pr-soft)]" />}
                    </Td>
                    <Td dir="ltr" className="whitespace-nowrap">{r.code}</Td>
                    <Td>
                      <div className="font-medium">{name(r)}</div>
                      
                    </Td>
                    <Td className="whitespace-nowrap">
                      {r.category ? codeLabel(t, 'cat', r.category) : '—'}
                      {(() => {
                        const sub = lang === 'ar' ? (r.sub_category_ar || r.sub_category) : (r.sub_category_en || r.sub_category);
                        return sub ? ' / ' + sub : '';
                      })()}
                    </Td>
                    <Td>{codeLabel(t, 'u', r.unit)}</Td>
                    <Td className="whitespace-nowrap font-medium" dir="ltr">{formatNumber(r.standard_price, { minimumFractionDigits: 2 })}</Td>
                    <Td className="whitespace-nowrap" dir="ltr">{r.last_calculated_cost != null ? formatNumber(r.last_calculated_cost, { minimumFractionDigits: 2 }) : '—'}</Td>
                    <Td>
                      {m === null ? '—' : (
                        <span className={'text-[12px] px-2 py-0.5 rounded-full ' + (m < 15 ? 'bg-[#ef4444]/15 text-[#ef4444]' : 'bg-brand-600/15 text-brand-700 dark:text-brand-300')}>
                          {formatNumber(m, { maximumFractionDigits: 1 })}%
                        </span>
                      )}
                    </Td>
                    <Td className="text-[12px] text-[color:var(--tx-3)] whitespace-nowrap">{r.updated_at ? formatDate(r.updated_at) : '—'}</Td>
                    <Td className="text-end whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <a href={'/catalogue/' + r.id} className="text-brand-600 dark:text-brand-400 hover:underline text-sm me-3">{t('common.edit')}</a>
                      <button onClick={() => duplicateRow(r)} className="text-[color:var(--tx-3)] hover:underline text-sm me-3">{t('catalogue.duplicate')}</button>
                      {r.status === 'archived' ? (
                        <button onClick={() => setArchived(r, false)} className="text-brand-600 dark:text-brand-400 hover:underline text-sm me-3">{t('common.restore')}</button>
                      ) : (
                        <button onClick={() => setArchived(r, true)} className="text-[color:var(--tx-3)] hover:underline text-sm me-3">{t('common.archive')}</button>
                      )}
                      <button onClick={() => removeRow(r)} className="text-[#ef4444] hover:underline text-sm">{t('common.delete')}</button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={25} total={total} onPage={setPage} />
      </div>

      {modal && (
        <Modal title={t('catalogue.newProduct')} onClose={() => setModal(false)} wide>
          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('f.nameEn')}><Input value={form.name_en ?? ''} onChange={e => setForm(s => ({ ...s, name_en: e.target.value }))} /></Field>
            <Field label={t('f.nameAr')}><Input dir="rtl" value={form.name_ar ?? ''} onChange={e => setForm(s => ({ ...s, name_ar: e.target.value }))} /></Field>
            <Field label={t('f.category')}>
              <Select value={form.category ?? 'OTHER'} onChange={e => setForm(s => ({ ...s, category: e.target.value, sub_category: '' }))}
                options={CATEGORIES.map(c => ({ value: c, label: t('cat.' + c) }))} />
            </Field>
            <Field label={t('catalogue.subCategory')}>
              <Input list="subcat-hints" value={form.sub_category ?? ''} onChange={e => setForm(s => ({ ...s, sub_category: e.target.value }))} />
              <datalist id="subcat-hints">
                {(SUBCAT_HINTS[form.category] || []).map(s => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <Field label={t('f.unit')}><Input value={form.unit ?? 'nos'} onChange={e => setForm(s => ({ ...s, unit: e.target.value }))} /></Field>
            <Field label="SKU"><Input value={form.sku ?? ''} onChange={e => setForm(s => ({ ...s, sku: e.target.value }))} /></Field>
            {/* Description / Scope of Work — bilingual, printed on quotations (A0). */}
            <Field label={t('catalogue.descriptionEn')} className="md:col-span-2">
              <Textarea value={form.description_en ?? ''} onChange={e => setForm(s => ({ ...s, description_en: e.target.value }))} />
            </Field>
            <Field label={t('catalogue.descriptionAr')} className="md:col-span-2">
              <Textarea dir="rtl" value={form.description_ar ?? ''} onChange={e => setForm(s => ({ ...s, description_ar: e.target.value }))} />
            </Field>
            <div className="md:col-span-2 text-[11px] text-[color:var(--tx-3)]">{t('catalogue.translateNote')}</div>
            {err && <div className="md:col-span-2 text-sm text-[#ef4444]">{err}</div>}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModal(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={busy || !(form.name_en || form.name_ar)}>{busy ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
