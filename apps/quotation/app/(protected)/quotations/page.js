'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import StatusBadge from '@/components/StatusBadge';
import { useLanguage } from '@/lib/i18n';
import { projectStatusBadgeKey } from '@/lib/projectStatus';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Button, Input, Select, Field, Modal, EmptyState, Th, Td, Pagination } from '@/components/ui';
import DateFilter, { presetRange } from '@/components/DateFilter';
import { isSuperAdminEmail } from '@/lib/superAdmin';
import { pickDefaultEntityId } from '@/lib/defaultEntity';

const TABS = ['', 'draft', 'waiting_quotation_approval', 'quotation_approved', 'quotation_rejected', 'customer_approved', 'customer_rejected', 'project_created', 'expired'];

export default function QuotationsPage() {
  const { t, tr, trL, lang, formatNumber, formatDate } = useLanguage();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('');
  /* Newest-first by quote_date is the default (server sorts by
     created_at desc, which tracks quote_date 1:1 since it's stamped at
     creation); this filter narrows the same dated list down to a
     preset/custom range, evaluated against the full server-side dataset
     — not just the 25/50/100/500 rows currently on screen. */
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const dq = useDebouncedValue(q, 300);
  const [newOpen, setNewOpen] = useState(false);
  const [entities, setEntities] = useState([]);
  const [entityId, setEntityId] = useState('');
  const [custQ, setCustQ] = useState('');
  const dCustQ = useDebouncedValue(custQ, 250);
  const [custRows, setCustRows] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [me, setMe] = useState(null);
  const [reportBusy, setReportBusy] = useState('');

  useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    const { from: rFrom, to: rTo } = dateFilter.preset === 'custom' ? dateFilter : presetRange(dateFilter.preset);
    const range = (rFrom ? `&from=${rFrom}` : '') + (rTo ? `&to=${rTo}` : '');
    fetch(`/api/quotations?q=${encodeURIComponent(dq)}&status=${tab}&page=${page}&pageSize=${pageSize}${range}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [], total: 0 })
      .then(d => { setRows(d.rows || []); setTotal(d.total || 0); })
      .catch(() => { setRows([]); setTotal(0); });
  }, [dq, tab, page, pageSize, dateFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq, tab, pageSize, dateFilter]);

  /* Dashboard cards deep-link here with ?status=... (Update 1) — adopt
     it as the initial tab once, on mount. */
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('status');
    if (fromUrl && TABS.includes(fromUrl)) setTab(fromUrl);
  }, []);

  /* Light polling so Projects-side accept/hold/reject decisions (Part 7)
     show up without a manual refresh — same ~20s convention used by the
     notification bell elsewhere in this app. */
  useEffect(() => {
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!newOpen) return;
    fetch('/api/entities', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => { setEntities(d.rows || []); setEntityId(pickDefaultEntityId(d.rows)); })
      .catch(() => {});
  }, [newOpen]);

  useEffect(() => {
    if (!newOpen) return;
    fetch(`/api/customers?q=${encodeURIComponent(dCustQ)}&page=1`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => setCustRows(d.rows || []))
      .catch(() => {});
  }, [dCustQ, newOpen]);

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ entity_id: entityId, customer_id: customerId || null, output_lang: lang }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.genericError'));
      window.location.href = '/quotations/' + d.id;
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  const custName = (c) => trL(c, 'company_name');

  /* Fetches every page of the current search/status/date-filtered result
     set (the table itself only ever holds one 25/50/100/500-row page) so
     Print/PDF reflects the full filtered dataset, not just what's on
     screen — same pattern as fetchAllCustomers() in the Customers page. */
  async function fetchAllQuotations() {
    const { from: rFrom, to: rTo } = dateFilter.preset === 'custom' ? dateFilter : presetRange(dateFilter.preset);
    const range = (rFrom ? `&from=${rFrom}` : '') + (rTo ? `&to=${rTo}` : '');
    const all = [];
    let p = 1, runningTotal = Infinity;
    while (all.length < runningTotal) {
      const res = await fetch(`/api/quotations?q=${encodeURIComponent(dq)}&status=${tab}&page=${p}&pageSize=100${range}`, { credentials: 'same-origin' });
      const d = res.ok ? await res.json() : { rows: [], total: 0 };
      if (!d.rows || d.rows.length === 0) break;
      all.push(...d.rows);
      runningTotal = d.total || 0;
      p++;
    }
    return all;
  }

  /* Prints/exports the full search/status/date-filtered result set — not
     just the page currently rendered — using the shared AL FAROOQUE report
     engine (same engine as every other Print/PDF button in this app). */
  async function runReport(action) {
    setReportBusy(action);
    try {
      const allRows = await fetchAllQuotations();
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: t('nav.quotations') || t('quote.number'),
        columns: [
          { key: 'number', header: t('quote.number') }, { key: 'customer', header: t('nav.customers') },
          { key: 'entity', header: t('quote.entity') }, { key: 'total', header: t('quote.grandTotal') },
          { key: 'status', header: t('quote.status') }, { key: 'validUntil', header: t('quote.validUntil') },
        ],
        rows: allRows.map(r => ({
          number: r.quote_number, customer: r.customer ? custName(r.customer) : '—',
          entity: r.entity ? r.entity.code : '—', total: formatNumber(r.grand_total, { minimumFractionDigits: 2 }),
          status: t('status.' + r.status), validUntil: r.valid_until ? formatDate(r.valid_until) : '—',
        })),
        lang, fileName: 'quotations-report.pdf', action,
      });
    } catch (e2) { setErr(e2.message || 'Could not generate report.'); }
    finally { setReportBusy(''); }
  }

  return (
    <Shell active="/quotations">
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex flex-wrap rounded-lg border border-[color:var(--bd)] overflow-hidden">
            {TABS.map(s => (
              <button key={s} onClick={() => setTab(s)}
                className={'px-3 py-2 text-[13px] transition-colors ' + (tab === s ? 'bg-[color:var(--pr-soft)] text-[color:var(--pr)] font-medium' : 'text-[color:var(--tx-3)] hover:bg-[color:var(--pr-soft)]')}>
                {s === '' ? t('common.all') : t('status.' + s)}
              </button>
            ))}
          </div>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('quote.searchNumber')} className="max-w-[200px]" />
          <DateFilter value={dateFilter} onChange={setDateFilter} t={t} lang={lang} />
          <div className="flex-1" />
          <a href={'/api/export/quotations?lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.export')}</a>
          <Button variant="ghost" onClick={() => runReport('print')} disabled={!rows?.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('common.print')}</Button>
          <Button variant="ghost" onClick={() => runReport('save')} disabled={!rows?.length || !!reportBusy}>⇩ {reportBusy === 'save' ? '…' : t('common.downloadPdf')}</Button>
          <Button onClick={() => { setNewOpen(true); setCustomerId(''); setCustQ(''); setErr(null); }}>+ {t('quote.new')}</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <Th>{t('quote.number')}</Th><Th>{t('nav.customers')}</Th><Th>{t('quote.entity')}</Th>
              <Th>{t('quote.grandTotal')}</Th><Th>{t('cost.margin')}</Th><Th>{t('quote.status')}</Th>
              <Th>{t('quote.validUntil')}</Th>
              <Th className="text-end">{t('common.actions')}</Th>
            </tr></thead>
            <tbody>
              {rows === null ? (
                <tr><Td colSpan={8} className="text-center text-[color:var(--tx-3)]">{t('shell.loading')}</Td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8}><EmptyState text={t('common.noRecords')} /></td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-[color:var(--pr-soft)] cursor-pointer"
                  onClick={() => { window.location.href = '/quotations/' + r.id; }}>
                  <Td dir="ltr" className="font-medium whitespace-nowrap">{r.quote_number}</Td>
                  <Td>{r.customer ? custName(r.customer) : '—'}</Td>
                  <Td>{r.entity ? r.entity.code : '—'}</Td>
                  <Td dir="ltr" className="whitespace-nowrap font-medium">{formatNumber(r.grand_total, { minimumFractionDigits: 2 })}</Td>
                  <Td>{r.blended_margin_pct != null ? formatNumber(r.blended_margin_pct, { maximumFractionDigits: 1 }) + '%' : '—'}</Td>
                  <Td onClick={e => r.pm_project_id && e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={r.status} />
                      {r.project_status && (
                        r.pm_project_id ? (
                          <a href={(process.env.NEXT_PUBLIC_PROJECTS_APP_URL || 'https://projects.alfarooque.com') + '/projects/' + r.pm_project_id}
                            target="_blank" rel="noreferrer" title={t('quote.openProject')}>
                            <StatusBadge status={projectStatusBadgeKey(r.project_status)} />
                          </a>
                        ) : <StatusBadge status={projectStatusBadgeKey(r.project_status)} />
                      )}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{r.valid_until ? formatDate(r.valid_until) : '—'}</Td>
                  <Td className="text-end whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <a href={'/quotations/' + r.id} className="text-brand-600 dark:text-brand-400 hover:underline text-sm me-3">{t('common.edit')}</a>
                    <button onClick={async () => {
                      const res = await fetch('/api/quotations/' + r.id + '/duplicate', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
                      const d = res && res.ok ? await res.json() : null;
                      if (d && d.id) window.location.href = '/quotations/' + d.id;
                    }} className="text-[color:var(--tx-3)] hover:underline text-sm me-3">{t('catalogue.duplicate')}</button>
                    {(['draft', 'cancelled', 'rejected', 'expired'].includes(r.status) || (me && isSuperAdminEmail(me.email))) && (
                      <button onClick={async () => {
                        if (!window.confirm(t('quote.deleteConfirm'))) return;
                        const res = await fetch('/api/quotations/' + r.id, { method: 'DELETE', credentials: 'same-origin' }).catch(() => null);
                        if (!res || !res.ok) { const d = res ? await res.json().catch(() => ({})) : {}; alert(d.error || t('common.genericError')); return; }
                        load();
                      }} className="text-[#ef4444] hover:underline text-sm">{t('common.delete')}</button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {newOpen && (
        <Modal title={t('quote.new')} onClose={() => setNewOpen(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label={t('quote.entity')} required>
              <Select value={entityId} onChange={e => setEntityId(e.target.value)}
                options={entities.map(en => ({ value: en.id, label: (lang === 'ar' ? (en.name_ar || en.name_en) : en.name_en) + ' (' + en.code + ')' }))} />
            </Field>
            <Field label={t('nav.customers')}>
              <Input value={custQ} onChange={e => { setCustQ(e.target.value); setCustomerId(''); }} placeholder={t('common.search')} />
              {custQ && !customerId && custRows.length > 0 && (
                <div className="mt-1 border border-[color:var(--bd)] rounded-lg max-h-48 overflow-y-auto">
                  {custRows.slice(0, 8).map(c => (
                    <button key={c.id} type="button" onClick={() => { setCustomerId(c.id); setCustQ(custName(c)); }}
                      className="w-full text-start px-3 py-2 text-sm hover:bg-[color:var(--pr-soft)] border-b border-[color:var(--bd)]">
                      {custName(c)} <span className="text-[11px] text-[color:var(--tx-3)]" dir="ltr">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-[color:var(--tx-3)] mt-1">{t('quote.customerOptional')}</div>
            </Field>
            {err && <div className="text-sm text-[#ef4444]">{err}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNewOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={busy || !entityId}>{busy ? t('common.saving') : t('quote.create')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
