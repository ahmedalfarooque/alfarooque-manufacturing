'use client';

/* Config-driven CRUD list used by the simple master-data modules
   (Labour, Machines, Expenses, Suppliers). Expects an API with:
     GET    {api}?q=&page=      → { rows, total, page, pageSize }
     POST   {api}               → { row }
     PATCH  {api}/{id}          → { row }
     DELETE {api}/{id}          → { ok }
   Columns: [{ key, labelKey, render?(row) }]
   Fields:  [{ key, labelKey, type: 'text'|'number'|'textarea'|'select',
               options?: [{value,label|labelKey}], required?, step? }]  */

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Button, Input, Textarea, Select, Field, Modal, EmptyState, Th, Td, Pagination } from '@/components/ui';

export default function MasterList({ active, api, titleKey, columns, fields, wide, toolbar }) {
  const { t, tr, lang, formatNumber } = useLanguage();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const dq = useDebouncedValue(q, 300);
  const [modal, setModal] = useState(null);   // null | { row|null }
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const pageSize = 25;

  const load = useCallback(() => {
    fetch(`${api}?q=${encodeURIComponent(dq)}&page=${page}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [], total: 0 })
      .then(d => { setRows(d.rows || []); setTotal(d.total || 0); })
      .catch(() => { setRows([]); setTotal(0); });
  }, [api, dq, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq]);

  function open(row) {
    const init = {};
    fields.forEach(f => { init[f.key] = row ? (row[f.key] ?? '') : (f.default ?? ''); });
    setForm(init);
    setErr(null);
    setModal({ row });
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const isEdit = !!modal.row;
      const res = await fetch(isEdit ? `${api}/${modal.row.id}` : api, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.genericError'));
      setModal(null);
      load();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function remove(row) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    await fetch(`${api}/${row.id}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
    load();
  }

  function display(row, col) {
    if (col.render) return col.render(row, { t, lang, formatNumber });
    /* stored-bilingual pick: instant, no runtime translation */
    const en = row[col.key + '_en'], ar = row[col.key + '_ar'];
    if (en || ar) return (lang === 'ar' ? (ar || en) : (en || ar));
    const v = row[col.key];
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'number') return formatNumber(v);
    if (col.enumPrefix) { const key = col.enumPrefix + '.' + v; const out = t(key); return out === key ? String(v) : out; }
    return String(v);
  }

  return (
    <Shell active={active}>
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('common.search')} className="max-w-xs" />
          <div className="flex-1" />
          {toolbar && toolbar({ reload: load, t })}
          <Button onClick={() => open(null)}>+ {t('common.add')}</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {columns.map(c => <Th key={c.key}>{t(c.labelKey)}</Th>)}
              <Th className="text-end">{t('common.actions')}</Th>
            </tr></thead>
            <tbody>
              {rows === null ? (
                <tr><Td colSpan={columns.length + 1} className="text-center text-[#8C8A80]">{t('shell.loading')}</Td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length + 1}><EmptyState text={t('common.noRecords')} /></td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="hover:bg-[#F7F5F1] dark:hover:bg-white/[0.03]">
                  {columns.map(c => <Td key={c.key}>{display(row, c)}</Td>)}
                  <Td className="text-end whitespace-nowrap">
                    <button onClick={() => open(row)} className="text-brand-600 dark:text-brand-400 hover:underline text-sm me-3">{t('common.edit')}</button>
                    <button onClick={() => remove(row)} className="text-[#BC6B4E] hover:underline text-sm">{t('common.delete')}</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
      </div>

      {modal && (
        <Modal title={t(modal.row ? 'common.edit' : 'common.add') + ' — ' + t(titleKey)} onClose={() => setModal(null)} wide={wide}>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(f => (
              <Field key={f.key} label={t(f.labelKey)} required={f.required} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                {f.type === 'select' ? (
                  <Select value={form[f.key] ?? ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                    options={f.options.map(o => ({ value: o.value, label: o.labelKey ? t(o.labelKey) : o.label }))} />
                ) : f.type === 'textarea' ? (
                  <Textarea value={form[f.key] ?? ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} />
                ) : (
                  <Input type={f.type === 'number' ? 'number' : 'text'} step={f.step || (f.type === 'number' ? '0.01' : undefined)}
                    required={f.required} dir={f.dir} value={form[f.key] ?? ''}
                    onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} />
                )}
              </Field>
            ))}
            {err && <div className="md:col-span-2 text-sm text-[#BC6B4E]">{err}</div>}
            <div className="md:col-span-2 flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setModal(null)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
