'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage, codeLabel } from '@/lib/i18n';
import { formatMaterialDims, DIM_UNITS } from '@/lib/dims';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Button, Input, Textarea, Select, Field, Modal, EmptyState, Th, Td, Pagination } from '@/components/ui';
import ImportButton from '@/components/ImportButton';
import MaterialEditDialog from '@/components/MaterialEditDialog';

const FIELD_DEFS_TOP = [
  ['code', 'f.code', 'text'],
  ['barcode', 'f.barcode', 'text'],
  ['name_en', 'f.nameEn', 'text'],
  ['name_ar', 'f.nameAr', 'text', false, 'rtl'],
  ['kind', 'f.kind', 'kind'],
  ['category_id', 'f.category', 'category'],
  ['unit', 'f.unit', 'text'],
  ['brand', 'f.brand', 'text'],
];
const FIELD_DEFS_BOTTOM = [
  ['latest_price', 'f.latestPrice', 'number'],
  ['default_waste_pct', 'f.wastePct', 'number'],
  ['notes', 'f.notes', 'textarea'],
];
const FIELD_DEFS = [...FIELD_DEFS_TOP, ...FIELD_DEFS_BOTTOM];

const DIM_FIELDS = ['height', 'width', 'length', 'thickness'];

/* Optional value+unit pair — nothing here is required, matching the
   "only what you know" spec for material dimensions. */
function DimField({ dimKey, form, setForm, t }) {
  return (
    <Field label={t('dim.' + dimKey)}>
      <div className="flex items-center gap-2">
        <Input type="number" step="0.01" min="0" className="flex-1" style={{ minWidth: 0 }}
          value={form[dimKey + '_value'] ?? ''}
          onChange={e => setForm(s => ({ ...s, [dimKey + '_value']: e.target.value }))} />
        <Select className="shrink-0" style={{ width: 92, flexShrink: 0 }} value={form[dimKey + '_unit'] ?? 'mm'}
          onChange={e => setForm(s => ({ ...s, [dimKey + '_unit']: e.target.value }))}
          options={DIM_UNITS.map(u => ({ value: u, label: t('dimunit.' + u) }))} />
      </div>
    </Field>
  );
}

export default function MaterialsPage() {
  const { t, tr, trL, lang, formatNumber, formatDate } = useLanguage();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');            // '' | material | hardware
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const dq = useDebouncedValue(q, 300);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [history, setHistory] = useState(null);    // { material, rows }
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState({ mode: 'pct', value: '', kind: '' });
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', kind: 'material' });

  const loadCategories = () => {
    fetch('/api/material-categories', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => setCategories(d.rows || []))
      .catch(() => {});
  };

  async function catAction(method, body) {
    const res = await fetch('/api/material-categories', {
      method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res && !res.ok) {
      const d = await res.json().catch(() => ({}));
      setImportResult('⚠ ' + (d.error || t('common.genericError')));
    }
    loadCategories();
  }

  useEffect(() => {
    fetch('/api/material-categories', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => setCategories(d.rows || []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    fetch(`/api/materials?q=${encodeURIComponent(dq)}&kind=${kind}&category=${category}&page=${page}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [], total: 0 })
      .then(d => { setRows(d.rows || []); setTotal(d.total || 0); })
      .catch(() => { setRows([]); setTotal(0); });
  }, [dq, kind, category, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq, kind, category]);

  const catName = (id) => {
    const c = categories.find(x => x.id === id);
    return c ? tr(c.name) : '—';
  };

  function open(row) {
    /* Editing an existing material goes through the version-control
       dialog (SAVE / SAVE AS NEW / CLOSE) — FR-MAT-VC. Adding a brand
       new material keeps the plain create form below. */
    if (row) { setModal({ row }); return; }
    const init = { kind: kind || 'material', unit: 'piece', default_waste_pct: 0 };
    DIM_FIELDS.forEach(k => { init[k + '_unit'] = 'mm'; });
    setForm(init); setErr(null); setModal({ row: null });
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const isEdit = !!modal.row;
      const res = await fetch(isEdit ? `/api/materials/${modal.row.id}` : '/api/materials', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.genericError'));
      setModal(null); load();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function remove(row) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    await fetch(`/api/materials/${row.id}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
    load();
  }

  async function duplicateRow(row) {
    const res = await fetch(`/api/materials/${row.id}/duplicate`, { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    const d = res && res.ok ? await res.json().catch(() => null) : null;
    if (!res || !res.ok) { setImportResult('⚠ ' + ((d && d.error) || t('common.genericError'))); return; }
    load();
  }

  async function showHistory(row) {
    setHistory({ material: row, rows: null });
    const res = await fetch(`/api/materials/${row.id}/prices`, { credentials: 'same-origin' }).catch(() => null);
    const d = res && res.ok ? await res.json() : { rows: [] };
    setHistory({ material: row, rows: d.rows || [] });
  }

  async function doImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/purchases', { method: 'POST', credentials: 'same-origin', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.importFailed'));
      setImportResult(t('import.purchasesResult', {
        rows: d.rowsRead, materials: d.materialsCreated, suppliers: d.suppliersCreated,
        prices: d.pricePoints, updated: d.materialsUpdated,
      }));
      load();
    } catch (e2) { setImportResult('⚠ ' + e2.message); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <Shell active="/materials">
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex rounded-lg border border-[#E5E2DD] dark:border-white/[0.1] overflow-hidden">
            {['', 'material', 'hardware'].map(k => (
              <button key={k} onClick={() => setKind(k)}
                className={'px-3 py-2 text-sm transition-colors ' + (kind === k ? 'bg-brand-600 text-white' : 'hover:bg-[#F1EEE7] dark:hover:bg-white/5')}>
                {k === '' ? t('common.all') : t('kind.' + k)}
              </button>
            ))}
          </div>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('materials.searchPlaceholder')} className="max-w-xs" />
          <Select value={category} onChange={e => setCategory(e.target.value)} className="max-w-[220px]"
            options={[{ value: '', label: t('common.allCategories') },
              ...categories.filter(c => !kind || c.kind === kind).map(c => ({ value: c.id, label: tr(c.name) }))]} />
          <div className="flex-1" />
          <a href={'/api/export/materials?template=1&lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.template')}</a>
          <a href={'/api/export/materials?lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.export')}</a>
          <ImportButton endpoint="/api/import/materials" label={t('common.importExcel')} onDone={(err, d) => {
            setImportResult(err ? '⚠ ' + err : t('import.genericResult', { created: d.inserted, updated: d.updated, failed: d.failed }));
            if (!err) load();
          }} />
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={doImport} />
          <Button variant="ghost" disabled={importing} onClick={() => fileRef.current && fileRef.current.click()}>
            {importing ? t('common.importing') : '⇪ ' + t('materials.importPurchases')}
          </Button>
          <Button variant="ghost" onClick={() => { setBulk({ mode: 'pct', value: '', kind }); setBulkPreview(null); setBulkOpen(true); }}>
            % {t('materials.bulkPrice')}
          </Button>
          <Button variant="ghost" onClick={() => setCatOpen(true)}>{t('materials.manageCategories')}</Button>
          <Button onClick={() => open(null)}>+ {t('common.add')}</Button>
        </div>
        {importResult && <div className="mx-4 mb-2 rounded-lg bg-brand-600/10 border border-brand-600/25 px-3 py-2 text-sm">{importResult}</div>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <Th>{t('f.code')}</Th><Th>{t('f.name')}</Th><Th>{t('f.dimensions')}</Th>
              <Th>{t('f.unit')}</Th><Th>{t('f.category')}</Th><Th>{t('f.latestPrice')}</Th><Th>{t('f.wastePct')}</Th>
              <Th className="text-end">{t('common.actions')}</Th>
            </tr></thead>
            <tbody>
              {rows === null ? (
                <tr><Td colSpan={8} className="text-center text-[#8C8A80]">{t('shell.loading')}</Td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8}><EmptyState text={t('common.noRecords')} /></td></tr>
              ) : rows.map(row => (
                <tr key={row.id} onClick={() => open(row)}
                  className="cursor-pointer transition-colors duration-150 hover:bg-[#F7F5F1] dark:hover:bg-white/[0.03]">
                  <Td className="whitespace-nowrap" dir="ltr">{row.code || '—'}</Td>
                  <Td>{trL(row, 'name')}</Td>
                  <Td dir="ltr" className="text-start">{formatMaterialDims(row, t) || '—'}</Td>
                  <Td>{codeLabel(t, 'u', row.unit)}</Td>
                  <Td>{catName(row.category_id)}</Td>
                  <Td className="whitespace-nowrap font-medium">{formatNumber(row.latest_price, { minimumFractionDigits: 2 })}</Td>
                  <Td>{formatNumber(row.default_waste_pct)}%</Td>
                  <Td className="text-end whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => showHistory(row)} className="text-[#8C8A80] hover:underline text-sm me-3">{t('materials.priceHistory')}</button>
                    <button onClick={() => open(row)} className="text-brand-600 dark:text-brand-400 hover:underline text-sm me-3">{t('common.edit')}</button>
                    <button onClick={() => duplicateRow(row)} className="text-[#8C8A80] hover:underline text-sm me-3">{t('common.duplicate')}</button>
                    <button onClick={() => remove(row)} className="text-[#BC6B4E] hover:underline text-sm">{t('common.delete')}</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={25} total={total} onPage={setPage} />
      </div>

      {modal && modal.row && (
        <MaterialEditDialog material={modal.row} context="master"
          onDone={(res) => {
            setModal(null);
            if (res.action === 'saved' || res.action === 'savedAsNew') {
              if (res.action === 'savedAsNew' && res.material) {
                setImportResult(t('matdlg.createdAsNew', { code: res.material.code }));
              }
              load();
            }
          }} />
      )}

      {modal && !modal.row && (
        <Modal title={t('common.add') + ' — ' + t('nav.materials')} onClose={() => setModal(null)} wide>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FIELD_DEFS_TOP.map(([key, labelKey, kindType, required, dir]) => (
              <Field key={key} label={t(labelKey)} required={required} className={kindType === 'textarea' ? 'md:col-span-3' : ''}>
                {kindType === 'kind' ? (
                  <Select value={form.kind ?? 'material'} onChange={e => setForm(s => ({ ...s, kind: e.target.value }))}
                    options={[{ value: 'material', label: t('kind.material') }, { value: 'hardware', label: t('kind.hardware') }]} />
                ) : kindType === 'category' ? (
                  <Select value={form.category_id ?? ''} onChange={e => setForm(s => ({ ...s, category_id: e.target.value }))}
                    options={[{ value: '', label: '—' },
                      ...categories.filter(c => c.kind === (form.kind || 'material')).map(c => ({ value: c.id, label: tr(c.name) }))]} />
                ) : kindType === 'textarea' ? (
                  <Textarea value={form[key] ?? ''} onChange={e => setForm(s => ({ ...s, [key]: e.target.value }))} />
                ) : (
                  <Input type={kindType === 'number' ? 'number' : 'text'} step="0.01" required={required} dir={dir}
                    value={form[key] ?? ''} onChange={e => setForm(s => ({ ...s, [key]: e.target.value }))} />
                )}
              </Field>
            ))}
            <DimField dimKey="height" form={form} setForm={setForm} t={t} />
            <DimField dimKey="width" form={form} setForm={setForm} t={t} />
            <DimField dimKey="length" form={form} setForm={setForm} t={t} />
            <DimField dimKey="thickness" form={form} setForm={setForm} t={t} />
            {FIELD_DEFS_BOTTOM.map(([key, labelKey, kindType, required, dir]) => (
              <Field key={key} label={t(labelKey)} required={required} className={kindType === 'textarea' ? 'md:col-span-3' : ''}>
                {kindType === 'textarea' ? (
                  <Textarea value={form[key] ?? ''} onChange={e => setForm(s => ({ ...s, [key]: e.target.value }))} />
                ) : (
                  <Input type={kindType === 'number' ? 'number' : 'text'} step="0.01" required={required} dir={dir}
                    value={form[key] ?? ''} onChange={e => setForm(s => ({ ...s, [key]: e.target.value }))} />
                )}
              </Field>
            ))}
            {modal.row && <div className="md:col-span-3 text-[12px] text-[#8C8A80]">{t('materials.priceEditNote')}</div>}
            {err && <div className="md:col-span-3 text-sm text-[#BC6B4E]">{err}</div>}
            <div className="md:col-span-3 flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setModal(null)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={busy || !(form.name_en || form.name_ar)}>{busy ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </Modal>
      )}

      {catOpen && (
        <Modal title={t('materials.manageCategories')} onClose={() => setCatOpen(false)} wide>
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t('f.name')} className="flex-1 min-w-[180px]">
                <Input value={newCat.name} onChange={e => setNewCat(s => ({ ...s, name: e.target.value }))} />
              </Field>
              <Field label={t('f.kind')}>
                <Select value={newCat.kind} onChange={e => setNewCat(s => ({ ...s, kind: e.target.value }))}
                  options={[{ value: 'material', label: t('kind.material') }, { value: 'hardware', label: t('kind.hardware') }]} />
              </Field>
              <Button disabled={!newCat.name.trim()} onClick={async () => {
                await catAction('POST', newCat);
                setNewCat({ name: '', kind: newCat.kind });
              }}>+ {t('common.add')}</Button>
            </div>
            <div className="max-h-80 overflow-y-auto border-t border-[#E5E2DD] dark:border-white/[0.08]">
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-3 py-2 border-b border-[#E5E2DD]/60 dark:border-white/5">
                  <span className="flex-1 text-sm">{tr(c.name)}</span>
                  <span className="text-[11px] text-[#8C8A80]">{t('kind.' + c.kind)}</span>
                  <button onClick={async () => {
                    const next = window.prompt(t('materials.renameCategory'), c.name);
                    if (next && next.trim() && next !== c.name) await catAction('PATCH', { id: c.id, name: next });
                  }} className="text-brand-600 dark:text-brand-400 hover:underline text-sm">{t('common.edit')}</button>
                  <button onClick={async () => {
                    if (!window.confirm(t('common.confirmDelete') + '\n' + c.name)) return;
                    await catAction('DELETE', { id: c.id });
                  }} className="text-[#BC6B4E] hover:underline text-sm">{t('common.delete')}</button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {bulkOpen && (
        <Modal title={t('materials.bulkPrice')} onClose={() => setBulkOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('materials.bulkMode')}>
                <Select value={bulk.mode} onChange={e => { setBulk(s => ({ ...s, mode: e.target.value })); setBulkPreview(null); }}
                  options={[{ value: 'pct', label: '%' }, { value: 'fixed', label: 'SAR' }]} />
              </Field>
              <Field label={t('materials.bulkValue')}>
                <Input type="number" step="0.01" dir="ltr" value={bulk.value}
                  onChange={e => { setBulk(s => ({ ...s, value: e.target.value })); setBulkPreview(null); }} />
              </Field>
              <Field label={t('f.kind')}>
                <Select value={bulk.kind} onChange={e => { setBulk(s => ({ ...s, kind: e.target.value })); setBulkPreview(null); }}
                  options={[{ value: '', label: t('common.all') }, { value: 'material', label: t('kind.material') }, { value: 'hardware', label: t('kind.hardware') }]} />
              </Field>
            </div>
            {bulkPreview && (
              <div className="rounded-lg bg-brand-600/10 border border-brand-600/25 px-3 py-2 text-sm">
                {t('materials.bulkMatched', { n: bulkPreview.matched })}
                <ul className="mt-1 text-[12px] text-[#8C8A80]">
                  {bulkPreview.sample.map(s => (
                    <li key={s.id}>{s.name}: <span dir="ltr">{formatNumber(s.old, { minimumFractionDigits: 2 })} → {formatNumber(s.new, { minimumFractionDigits: 2 })}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBulkOpen(false)}>{t('common.cancel')}</Button>
              {!bulkPreview ? (
                <Button disabled={bulkBusy || !bulk.value} onClick={async () => {
                  setBulkBusy(true);
                  const res = await fetch('/api/materials/bulk-price', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                    body: JSON.stringify({ ...bulk, value: Number(bulk.value), preview: true }),
                  }).catch(() => null);
                  const d = res && res.ok ? await res.json() : null;
                  if (d) setBulkPreview(d);
                  setBulkBusy(false);
                }}>{t('materials.bulkPreview')}</Button>
              ) : (
                <Button disabled={bulkBusy || bulkPreview.matched === 0} onClick={async () => {
                  setBulkBusy(true);
                  const res = await fetch('/api/materials/bulk-price', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                    body: JSON.stringify({ ...bulk, value: Number(bulk.value) }),
                  }).catch(() => null);
                  const d = res && res.ok ? await res.json() : null;
                  setBulkBusy(false); setBulkOpen(false);
                  setImportResult(d ? t('materials.bulkApplied', { n: d.applied }) : '⚠ ' + t('common.genericError'));
                  load();
                }}>{t('materials.bulkApply', { n: bulkPreview.matched })}</Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {history && (
        <Modal title={t('materials.priceHistory') + ' — ' + trL(history.material, 'name')}
          onClose={() => setHistory(null)} wide>
          {history.rows === null ? (
            <div className="text-sm text-[#8C8A80]">{t('shell.loading')}</div>
          ) : history.rows.length === 0 ? (
            <EmptyState text={t('materials.noPriceHistory')} />
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead><tr>
                  <Th>{t('f.date')}</Th><Th>{t('f.price')}</Th><Th>{t('f.previousPrice')}</Th>
                  <Th>{t('f.supplier')}</Th><Th>{t('f.source')}</Th>
                </tr></thead>
                <tbody>
                  {history.rows.map(r => (
                    <tr key={r.id}>
                      <Td>{formatDate(r.effective_date)}</Td>
                      <Td className="font-medium">{formatNumber(r.price, { minimumFractionDigits: 2 })}</Td>
                      <Td>{r.previous_price != null ? formatNumber(r.previous_price, { minimumFractionDigits: 2 }) : '—'}</Td>
                      <Td>{r.supplier ? trL(r.supplier, 'name') : '—'}</Td>
                      <Td>{t('source.' + r.source)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </Shell>
  );
}
