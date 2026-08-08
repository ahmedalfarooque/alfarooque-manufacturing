'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Button, Input, Textarea, Select, Field, Modal, EmptyState, Th, Td, Pagination } from '@/components/ui';

const TYPES = ['hotel', 'contractor', 'individual', 'engineer', 'government', 'other'];

const FIELD_DEFS = [
  ['company_name_en', 'f.companyNameEn', 'text'],
  ['company_name_ar', 'f.companyNameAr', 'text', false, 'rtl'],
  ['contact_person', 'f.contactPerson', 'text'],
  ['phone', 'f.phone', 'text'],
  ['phone2', 'f.phone2', 'text'],
  ['email', 'f.email', 'text'],
  ['city', 'f.city', 'text'],
  ['customer_type', 'f.customerType', 'select'],
  ['vat_number', 'f.vatNumber', 'text'],
  ['cr_number', 'f.crNumber', 'text'],
  ['address', 'f.address', 'text'],
  ['notes', 'f.notes', 'textarea'],
];

export default function CustomersPage() {
  const { t, tr, trL, lang, formatNumber } = useLanguage();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const dq = useDebouncedValue(q, 300);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    fetch(`/api/customers?q=${encodeURIComponent(dq)}&type=${type}&page=${page}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [], total: 0 })
      .then(d => { setRows(d.rows || []); setTotal(d.total || 0); })
      .catch(() => { setRows([]); setTotal(0); });
  }, [dq, type, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq, type]);

  function open(row) {
    const init = { customer_type: 'other', city: 'Jeddah' };
    FIELD_DEFS.forEach(([k]) => { if (row) init[k] = row[k] ?? ''; });
    setForm(init); setErr(null); setModal({ row });
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const isEdit = !!modal.row;
      const res = await fetch(isEdit ? `/api/customers/${modal.row.id}` : '/api/customers', {
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
    await fetch(`/api/customers/${row.id}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
    load();
  }

  async function doImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/customers', { method: 'POST', credentials: 'same-origin', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.importFailed'));
      setImportResult(t('import.customersResult', { inserted: d.inserted, duplicates: d.duplicates }));
      load();
    } catch (e2) { setImportResult('⚠ ' + e2.message); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <Shell active="/customers">
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('common.search')} className="max-w-xs" />
          <Select value={type} onChange={e => setType(e.target.value)} className="max-w-[180px]"
            options={[{ value: '', label: t('common.allTypes') }, ...TYPES.map(x => ({ value: x, label: t('ctype.' + x) }))]} />
          <div className="flex-1" />
          <a href={'/api/export/customers?template=1&lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.template')}</a>
          <a href={'/api/export/customers?lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.export')}</a>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={doImport} />
          <Button variant="ghost" disabled={importing} onClick={() => fileRef.current && fileRef.current.click()}>
            {importing ? t('common.importing') : '⇪ ' + t('common.importExcel')}
          </Button>
          <Button onClick={() => open(null)}>+ {t('common.add')}</Button>
        </div>
        {importResult && <div className="mx-4 mb-2 rounded-lg bg-brand-600/10 border border-brand-600/25 px-3 py-2 text-sm">{importResult}</div>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <Th>{t('f.companyName')}</Th><Th>{t('f.contactPerson')}</Th><Th>{t('f.phone')}</Th>
              <Th>{t('f.customerType')}</Th><Th>{t('f.city')}</Th><Th className="text-end">{t('common.actions')}</Th>
            </tr></thead>
            <tbody>
              {rows === null ? (
                <tr><Td colSpan={6} className="text-center text-[color:var(--tx-3)]">{t('shell.loading')}</Td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6}><EmptyState text={t('common.noRecords')} /></td></tr>
              ) : rows.map(row => (
                <tr key={row.id} onClick={() => open(row)}
                  className="cursor-pointer transition-colors duration-150 hover:bg-[color:var(--pr-soft)]">
                  <Td>{trL(row, 'company_name') || '—'}</Td>
                  <Td>{trL(row, 'contact_person') || row.contact_person || '—'}</Td>
                  <Td dir="ltr">{row.phone || '—'}</Td>
                  <Td>{t('ctype.' + (row.customer_type || 'other'))}</Td>
                  <Td>{row.city || '—'}</Td>
                  <Td className="text-end whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => open(row)} className="text-brand-600 dark:text-brand-400 hover:underline text-sm me-3">{t('common.edit')}</button>
                    <button onClick={() => remove(row)} className="text-[#ef4444] hover:underline text-sm">{t('common.delete')}</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={25} total={total} onPage={setPage} />
      </div>

      {modal && (
        <Modal title={t(modal.row ? 'common.edit' : 'common.add') + ' — ' + t('nav.customers')} onClose={() => setModal(null)} wide>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELD_DEFS.map(([key, labelKey, kind, required, dir]) => (
              <Field key={key} label={t(labelKey)} required={required} className={kind === 'textarea' ? 'md:col-span-2' : ''}>
                {kind === 'select' ? (
                  <Select value={form[key] ?? 'other'} onChange={e => setForm(s => ({ ...s, [key]: e.target.value }))}
                    options={TYPES.map(x => ({ value: x, label: t('ctype.' + x) }))} />
                ) : kind === 'textarea' ? (
                  <Textarea value={form[key] ?? ''} onChange={e => setForm(s => ({ ...s, [key]: e.target.value }))} />
                ) : (
                  <Input required={required} dir={dir} value={form[key] ?? ''} onChange={e => setForm(s => ({ ...s, [key]: e.target.value }))} />
                )}
              </Field>
            ))}
            {err && <div className="md:col-span-2 text-sm text-[#ef4444]">{err}</div>}
            <div className="md:col-span-2 flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setModal(null)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={busy || !(form.company_name_en || form.company_name_ar)}>{busy ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
