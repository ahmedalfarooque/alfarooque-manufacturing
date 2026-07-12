'use client';

/* Product detail: basic info + the six-tab cost-model editor.
   Save = PUT cost-lines (server recomputes with the same engine).
   Recost = diff of snapshot prices vs current masters, apply on confirm. */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLanguage, codeLabel } from '@/lib/i18n';
import CostModelEditor from '@/components/CostModelEditor';
import { Button, Input, Textarea, Field, Modal, Th, Td } from '@/components/ui';

/* All dimensions optional (spec §3). Stored in `dimensions` jsonb in mm/kg/m²/m³. */
const DIM_KEYS = ['length', 'width', 'height', 'thickness', 'depth', 'diameter', 'weight', 'area', 'volume'];

function DimensionsCard({ product, setProduct, t }) {
  const [dims, setDims] = useState(product.dimensions || {});
  const [changed, setChanged] = useState(false);
  async function save() {
    const clean = {};
    DIM_KEYS.forEach(k => { const v = parseFloat(dims[k]); if (Number.isFinite(v) && v > 0) clean[k] = v; });
    /* auto-derive area (m²) from length×width mm when not typed manually */
    if (!clean.area && clean.length && clean.width) clean.area = Math.round(clean.length * clean.width / 1000) / 1000;
    const res = await fetch('/api/catalogue/' + product.id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ dimensions: clean }),
    }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (d && d.row) { setProduct(d.row); setDims(d.row.dimensions || {}); setChanged(false); }
  }
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-sm">{t('catalogue.dimensions')}</div>
        {changed && <Button onClick={save}>{t('common.save')}</Button>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {DIM_KEYS.map(k => (
          <Field key={k} label={t('dim.' + k)}>
            <Input type="number" step="0.001" dir="ltr" value={dims[k] ?? ''}
              onChange={e => { setDims(s => ({ ...s, [k]: e.target.value })); setChanged(true); }} />
          </Field>
        ))}
      </div>
      <div className="text-[11px] text-[#8C8A80] mt-2">{t('catalogue.dimensionsNote')}</div>
    </div>
  );
}

function ImagesCard({ product, setProduct, id, t }) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const images = Array.isArray(product.images) ? product.images : [];

  async function upload(files) {
    if (!files || !files.length) return;
    setBusy(true);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('file', f));
    const res = await fetch(`/api/catalogue/${id}/images`, { method: 'POST', credentials: 'same-origin', body: fd }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (d) setProduct(p => ({ ...p, images: d.images, image_path: d.image_path || p.image_path }));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }
  async function setPrimary(url) {
    await fetch(`/api/catalogue/${id}/images`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ url }),
    }).catch(() => {});
    setProduct(p => ({ ...p, image_path: url }));
  }
  async function remove(url) {
    const res = await fetch(`/api/catalogue/${id}/images`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ url }),
    }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (d) setProduct(p => ({ ...p, images: d.images, image_path: d.image_path }));
  }

  return (
    <div className="glass-card p-4">
      <div className="font-semibold text-sm mb-3">{t('catalogue.images')}</div>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        onClick={() => inputRef.current && inputRef.current.click()}
        className={'cursor-pointer rounded-xl border-2 border-dashed p-4 text-center text-sm transition-colors ' +
          (drag ? 'border-brand-600 bg-brand-600/10' : 'border-[#E5E2DD] dark:border-white/[0.1] text-[#8C8A80]')}>
        {busy ? t('common.importing') : t('catalogue.dropImages')}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} />
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {images.map(img => (
            <div key={img.url} className="relative group">
              <img src={img.url} alt={img.name || ''} loading="lazy"
                className={'h-20 w-full object-cover rounded-lg border-2 ' + (product.image_path === img.url ? 'border-brand-600' : 'border-transparent')} />
              <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1 bg-black/50 rounded-lg text-[10px]">
                {product.image_path !== img.url && (
                  <button onClick={() => setPrimary(img.url)} className="bg-white/90 rounded px-1.5 py-0.5 text-[#1a1a18]">★</button>
                )}
                <button onClick={() => remove(img.url)} className="bg-white/90 rounded px-1.5 py-0.5 text-[#BC6B4E]">✕</button>
              </div>
              {product.image_path === img.url && <span className="absolute top-1 start-1 text-[9px] bg-brand-600 text-white rounded px-1">{t('catalogue.primary')}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_PARAMS ={ overheadPct: 10, riskPct: 3, profitMode: 'pct', profitValue: 25, sellingPrice: 0, rounding: 0 };

export default function ProductDetailPage() {
  const { id } = useParams();
  const { t, tr, trL, lang, formatNumber } = useLanguage();
  const [product, setProduct] = useState(null);
  const [lines, setLines] = useState([]);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [tab, setTab] = useState('material');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [recost, setRecost] = useState(null);   // null | {changes}
  const [infoOpen, setInfoOpen] = useState(false);
  const [info, setInfo] = useState({});
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch('/api/catalogue/' + id, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        /* A deleted (or otherwise missing) product resolves here with
           d === null (404) — without this, `product` stayed null forever
           and the page just kept showing "Loading…" with no way out. */
        if (!d || !d.row) { setNotFound(true); return; }
        setProduct(d.row);
        setLines(d.lines || []);
        setParams({ ...DEFAULT_PARAMS, ...(d.row.cost_params || {}) });
      })
      .catch(() => setNotFound(true));
  }, [id]);

  function markDirty(fn) { return (...args) => { setDirty(true); return fn(...args); }; }

  async function save(setStandard) {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/catalogue/${id}/cost-lines`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ lines, params, setStandardPrice: !!setStandard }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.genericError'));
      setDirty(false);
      setMsg(t('cost.saved') + (setStandard ? ' · ' + t('cost.standardUpdated', { price: formatNumber(d.summary.unitPrice, { minimumFractionDigits: 2 }) }) : ''));
      if (setStandard) setProduct(p => ({ ...p, standard_price: d.summary.unitPrice, last_calculated_cost: d.summary.totalCost }));
      else setProduct(p => ({ ...p, last_calculated_cost: d.summary.totalCost }));
    } catch (e) { setMsg('⚠ ' + e.message); }
    finally { setSaving(false); }
  }

  async function runRecost(apply) {
    const res = await fetch(`/api/catalogue/${id}/recost`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ apply }),
    }).catch(() => null);
    const d = res && res.ok ? await res.json() : { changes: [] };
    if (apply) {
      setRecost(null);
      /* reload lines with fresh prices */
      const r2 = await fetch('/api/catalogue/' + id, { credentials: 'same-origin' });
      const d2 = r2.ok ? await r2.json() : null;
      if (d2) setLines(d2.lines || []);
      setMsg(t('cost.recostApplied', { n: d.changes.length }));
    } else {
      setRecost(d);
    }
  }

  async function duplicate() {
    const res = await fetch(`/api/catalogue/${id}/duplicate`, { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (d && d.id) window.location.href = '/catalogue/' + d.id;
  }

  async function saveInfo(e) {
    e.preventDefault();
    const res = await fetch('/api/catalogue/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(info),
    }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (d && d.row) { setProduct(d.row); setInfoOpen(false); }
  }

  if (notFound) {
    return (
      <Shell active="/catalogue">
        <div className="glass-card p-6 max-w-md text-center mx-auto space-y-3">
          <div className="text-sm text-[#8C8A80]">{t('catalogue.notFound')}</div>
          <a href="/catalogue" className="inline-block text-brand-600 dark:text-brand-400 hover:underline text-sm">{t('catalogue.backToList')}</a>
        </div>
      </Shell>
    );
  }
  if (!product) {
    return <Shell active="/catalogue"><div className="text-sm text-[#8C8A80]">{t('shell.loading')}</div></Shell>;
  }

  const name = trL(product, 'name');

  return (
    <Shell active="/catalogue">
      <div className="space-y-4">
        {/* Header card */}
        <div className="glass-card p-4 flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <a href="/catalogue" className="text-[#8C8A80] hover:underline text-sm">‹</a>
              <span className="text-[11px] text-[#8C8A80]" dir="ltr">{product.code}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-600/10 border border-brand-600/25">{codeLabel(t, 'cat', product.category)}</span>
            </div>
            <div className="font-semibold text-lg truncate">{name}</div>
            <div className="text-[12px] text-[#8C8A80]">
              {t('catalogue.standardPrice')}: <b dir="ltr">{formatNumber(product.standard_price, { minimumFractionDigits: 2 })} {t('common.currencyUnit')}</b>
              {' · '}{t('catalogue.lastCost')}: <span dir="ltr">{product.last_calculated_cost != null ? formatNumber(product.last_calculated_cost, { minimumFractionDigits: 2 }) : '—'}</span>
              {' / '}{codeLabel(t, 'u', product.unit)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => { setInfo({ name_en: product.name_en || product.name || '', name_ar: product.name_ar || '', category: product.category || '', sub_category_en: product.sub_category_en || product.sub_category || '', sub_category_ar: product.sub_category_ar || '', sku: product.sku || '', barcode: product.barcode || '', unit: product.unit || 'nos', description_en: product.description_en || product.description || '', description_ar: product.description_ar || '', notes: product.notes || '' }); setInfoOpen(true); }}>{t('catalogue.basicInfo')}</Button>
            <Button variant="ghost" onClick={duplicate}>{t('catalogue.duplicate')}</Button>
            <Button variant="ghost" onClick={() => runRecost(false)}>{t('cost.recost')}</Button>
            <Button disabled={saving} onClick={() => save(false)}>{saving ? t('common.saving') : t('cost.saveModel')}</Button>
            <Button disabled={saving} onClick={() => save(true)} className="!bg-brand-700">{t('cost.setStandard')}</Button>
          </div>
        </div>

        {msg && <div className="rounded-lg bg-brand-600/10 border border-brand-600/25 px-3 py-2 text-sm">{msg}</div>}
        {dirty && <div className="text-[12px] text-[#8C8A80]">{t('cost.unsavedChanges')}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DimensionsCard product={product} setProduct={setProduct} t={t} />
          <ImagesCard product={product} setProduct={setProduct} id={id} t={t} />
        </div>

        <CostModelEditor
          lines={lines} setLines={markDirty(setLines)}
          params={params} setParams={markDirty(setParams)}
          tab={tab} setTab={setTab}
        />
      </div>

      {/* Recost diff modal */}
      {recost && (
        <Modal title={t('cost.recostTitle')} onClose={() => setRecost(null)} wide>
          {recost.changes.length === 0 ? (
            <div className="text-sm text-[#8C8A80] py-6 text-center">{t('cost.noChanges')}</div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead><tr><Th>{t('f.name')}</Th><Th>{t('f.kind')}</Th><Th>{t('cost.oldPrice')}</Th><Th>{t('cost.newPrice')}</Th></tr></thead>
                  <tbody>
                    {recost.changes.map(c => (
                      <tr key={c.id}>
                        <Td>{c.name}</Td><Td>{t('sec.' + c.section)}</Td>
                        <Td dir="ltr">{formatNumber(c.old, { minimumFractionDigits: 2 })}</Td>
                        <Td dir="ltr" className={c.new > c.old ? 'text-[#BC6B4E] font-medium' : 'text-brand-700 dark:text-brand-300 font-medium'}>
                          {formatNumber(c.new, { minimumFractionDigits: 2 })}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setRecost(null)}>{t('common.cancel')}</Button>
                <Button onClick={() => runRecost(true)}>{t('cost.recostApply', { n: recost.changes.length })}</Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Basic info modal */}
      {infoOpen && (
        <Modal title={t('catalogue.basicInfo')} onClose={() => setInfoOpen(false)} wide>
          <form onSubmit={saveInfo} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('f.nameEn')}><Input value={info.name_en} onChange={e => setInfo(s => ({ ...s, name_en: e.target.value }))} /></Field>
            <Field label={t('f.nameAr')}><Input dir="rtl" value={info.name_ar} onChange={e => setInfo(s => ({ ...s, name_ar: e.target.value }))} /></Field>
            <Field label={t('f.category')}><Input value={info.category} onChange={e => setInfo(s => ({ ...s, category: e.target.value }))} /></Field>
            <Field label={t('f.unit')}><Input value={info.unit} onChange={e => setInfo(s => ({ ...s, unit: e.target.value }))} /></Field>
            <Field label={t('catalogue.subCategory') + ' (EN)'}><Input value={info.sub_category_en} onChange={e => setInfo(s => ({ ...s, sub_category_en: e.target.value }))} /></Field>
            <Field label={t('catalogue.subCategory') + ' (AR)'}><Input dir="rtl" value={info.sub_category_ar} onChange={e => setInfo(s => ({ ...s, sub_category_ar: e.target.value }))} /></Field>
            <Field label="SKU"><Input value={info.sku} onChange={e => setInfo(s => ({ ...s, sku: e.target.value }))} /></Field>
            <Field label={t('f.barcode')}><Input dir="ltr" value={info.barcode} onChange={e => setInfo(s => ({ ...s, barcode: e.target.value }))} /></Field>
            <Field label={t('f.notes')}><Input value={info.notes} onChange={e => setInfo(s => ({ ...s, notes: e.target.value }))} /></Field>
            <Field label={t('catalogue.descriptionEn')} className="md:col-span-2"><Textarea value={info.description_en} onChange={e => setInfo(s => ({ ...s, description_en: e.target.value }))} /></Field>
            <Field label={t('catalogue.descriptionAr')} className="md:col-span-2"><Textarea dir="rtl" value={info.description_ar} onChange={e => setInfo(s => ({ ...s, description_ar: e.target.value }))} /></Field>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setInfoOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
