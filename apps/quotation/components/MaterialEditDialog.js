'use client';

/* Shared material edit dialog with version control (FR-MAT-VC).
   Editing an existing material never silently overwrites it — the user
   must choose one of three outcomes:

     · SAVE         overwrite the original (same ID & code); updates it
                    everywhere it is referenced (price change → history).
     · SAVE AS NEW  create a separate material: every field copied, the
                    edited values applied, a NEW ID and auto-generated
                    code/barcode; the original stays untouched.
     · CLOSE        nothing is written to the materials database.
                    In a document context (quotation / catalogue product)
                    the edited values are applied ONLY to the current
                    working document as a local override.

   Closing the dialog (× / backdrop) with unsaved edits re-presents the
   same three choices instead of discarding silently.

   Used by: Materials page (context="master") and CostModelEditor inside
   the quotation & catalogue editors (context="document"). */

import { useEffect, useMemo, useState } from 'react';
import { useLanguage, langHelpers } from '@/lib/i18n';
import { DIM_UNITS } from '@/lib/dims';
import { Button, Input, Textarea, Select, Field, Modal } from '@/components/ui';

const DIM_FIELDS = ['height', 'width', 'length', 'thickness'];
const TEXT_FIELDS = ['code', 'barcode', 'name_en', 'name_ar', 'kind', 'category_id', 'unit', 'brand', 'notes'];
const NUM_FIELDS = ['latest_price', 'default_waste_pct'];

function toForm(row) {
  const f = {};
  TEXT_FIELDS.forEach(k => { f[k] = row[k] ?? ''; });
  NUM_FIELDS.forEach(k => { f[k] = row[k] ?? ''; });
  DIM_FIELDS.forEach(k => {
    f[k + '_value'] = row[k + '_value'] ?? '';
    f[k + '_unit'] = row[k + '_unit'] || 'mm';
  });
  if (!f.kind) f.kind = 'material';
  if (!f.unit) f.unit = 'piece';
  return f;
}

/* Form -> API/row values (numbers coerced, '' -> null; dim units only
   sent alongside a value so blank dimensions stay blank). */
function toValues(form) {
  const v = {};
  TEXT_FIELDS.forEach(k => { v[k] = String(form[k] ?? '').trim() === '' ? null : form[k]; });
  NUM_FIELDS.forEach(k => { v[k] = String(form[k] ?? '').trim() === '' ? null : Number(form[k]); });
  if (v.latest_price == null) v.latest_price = 0;
  if (v.default_waste_pct == null) v.default_waste_pct = 0;
  DIM_FIELDS.forEach(k => {
    const raw = String(form[k + '_value'] ?? '').trim();
    v[k + '_value'] = raw === '' ? null : Number(raw);
    v[k + '_unit'] = raw === '' ? null : (form[k + '_unit'] || 'mm');
  });
  return v;
}

export default function MaterialEditDialog({ material, materialId, context = 'master', lang: langOverride, onDone }) {
  const ctx = useLanguage();
  const { t, tr } = langOverride ? langHelpers(langOverride) : ctx;

  const [row, setRow] = useState(material || null);
  const [form, setForm] = useState(material ? toForm(material) : null);
  const [initial, setInitial] = useState(material ? JSON.stringify(toForm(material)) : null);
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirming, setConfirming] = useState(false); // × pressed while dirty

  useEffect(() => {
    fetch('/api/material-categories', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => setCategories(d.rows || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (material || !materialId) return;
    fetch(`/api/materials/${materialId}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || !d.row) { setErr(t('common.genericError')); return; }
        setRow(d.row); setForm(toForm(d.row)); setInitial(JSON.stringify(toForm(d.row)));
      })
      .catch(() => setErr(t('common.genericError')));
  }, [material, materialId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => form && initial && JSON.stringify(form) !== initial, [form, initial]);

  function requestClose() {
    if (!dirty) { onDone({ action: 'cancel' }); return; }
    setConfirming(true);
  }

  async function doSave() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/materials/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(toValues(form)),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.genericError'));
      onDone({ action: 'saved', material: d.row });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function doSaveAsNew() {
    setBusy(true); setErr(null);
    try {
      /* Every field copied + edited values; code/barcode omitted so the
         server generates a fresh code (and mirrors it into barcode). */
      const v = toValues(form);
      delete v.code; delete v.barcode;
      const res = await fetch('/api/materials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.genericError'));
      onDone({ action: 'savedAsNew', material: d.row });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  function doClose() {
    if (context === 'document' && dirty) {
      onDone({ action: 'applyLocal', values: toValues(form) });
    } else {
      onDone({ action: 'cancel' });
    }
  }

  if (!form) {
    return (
      <Modal title={t('matdlg.title')} onClose={() => onDone({ action: 'cancel' })} wide>
        <div className="text-sm text-[#8C8A80]">{err || t('shell.loading')}</div>
      </Modal>
    );
  }

  const set = (k) => (e) => setForm(s => ({ ...s, [k]: e.target.value }));

  return (
    <Modal title={t('matdlg.title') + (row?.code ? ' — ' + row.code : '')} onClose={requestClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label={t('f.code')}><Input value={form.code} onChange={set('code')} dir="ltr" /></Field>
        <Field label={t('f.barcode')}><Input value={form.barcode} onChange={set('barcode')} dir="ltr" /></Field>
        <Field label={t('f.kind')}>
          <Select value={form.kind} onChange={set('kind')}
            options={[{ value: 'material', label: t('kind.material') }, { value: 'hardware', label: t('kind.hardware') }]} />
        </Field>
        <Field label={t('f.nameEn')}><Input value={form.name_en} onChange={set('name_en')} /></Field>
        <Field label={t('f.nameAr')}><Input value={form.name_ar} onChange={set('name_ar')} dir="rtl" /></Field>
        <Field label={t('f.category')}>
          <Select value={form.category_id} onChange={set('category_id')}
            options={[{ value: '', label: '—' },
              ...categories.filter(c => c.kind === (form.kind || 'material')).map(c => ({ value: c.id, label: tr(c.name) }))]} />
        </Field>
        <Field label={t('f.unit')}><Input value={form.unit} onChange={set('unit')} /></Field>
        <Field label={t('f.brand')}><Input value={form.brand} onChange={set('brand')} /></Field>
        <div />
        {DIM_FIELDS.map(k => (
          <Field key={k} label={t('dim.' + k)}>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.01" min="0" className="flex-1" style={{ minWidth: 0 }}
                value={form[k + '_value']} onChange={set(k + '_value')} />
              <Select className="shrink-0" style={{ width: 92, flexShrink: 0 }} value={form[k + '_unit']}
                onChange={set(k + '_unit')}
                options={DIM_UNITS.map(u => ({ value: u, label: t('dimunit.' + u) }))} />
            </div>
          </Field>
        ))}
        <Field label={t('f.latestPrice')}><Input type="number" step="0.01" dir="ltr" value={form.latest_price} onChange={set('latest_price')} /></Field>
        <Field label={t('f.wastePct')}><Input type="number" step="0.01" dir="ltr" value={form.default_waste_pct} onChange={set('default_waste_pct')} /></Field>
        <Field label={t('f.notes')} className="md:col-span-3"><Textarea value={form.notes} onChange={set('notes')} /></Field>

        <div className="md:col-span-3 text-[12px] text-[#8C8A80]">{t('materials.priceEditNote')}</div>
        {err && <div className="md:col-span-3 text-sm text-[#BC6B4E]">{err}</div>}

        {confirming && dirty && (
          <div className="md:col-span-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm">
            {t('matdlg.unsavedPrompt')}
          </div>
        )}

        {/* ── The three-way version-control footer ── */}
        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <Button disabled={busy || !dirty || !(form.name_en || form.name_ar)} onClick={doSave}>
              {busy ? t('common.saving') : t('common.save')}
            </Button>
            <span className="text-[11px] text-[#8C8A80] leading-snug">{t('matdlg.saveHint')}</span>
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="ghost" disabled={busy || !(form.name_en || form.name_ar)} onClick={doSaveAsNew}>
              {t('matdlg.saveAsNew')}
            </Button>
            <span className="text-[11px] text-[#8C8A80] leading-snug">{t('matdlg.saveAsNewHint')}</span>
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="ghost" disabled={busy} onClick={doClose}>{t('common.close')}</Button>
            <span className="text-[11px] text-[#8C8A80] leading-snug">
              {context === 'document' ? t('matdlg.closeHintDoc') : t('matdlg.closeHintMaster')}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* Map saved/edited material values onto a cost-model line snapshot —
   used by CostModelEditor for all three outcomes. */
export function lineValuesFromMaterial(v, spec_text) {
  return {
    name: v.name_en || v.name_ar || null,
    name_en: v.name_en || null,
    name_ar: v.name_ar || null,
    unit: v.unit || 'piece',
    unit_cost: Number(v.latest_price) || 0,
    waste_pct: Number(v.default_waste_pct) || 0,
    spec_text: spec_text || null,
  };
}
