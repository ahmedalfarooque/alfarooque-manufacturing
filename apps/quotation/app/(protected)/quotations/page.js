'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import StatusBadge from '@/components/StatusBadge';
import { useLanguage } from '@/lib/i18n';
import { projectStatusBadgeKey } from '@/lib/projectStatus';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Button, Input, Select, Field, Modal, EmptyState, Th, Td, Pagination } from '@/components/ui';
import { isSuperAdminEmail } from '@/lib/superAdmin';
import { pickDefaultEntityId } from '@/lib/defaultEntity';

const TABS = ['', 'draft', 'pending_approval', 'approved', 'sent', 'accepted', 'expired'];

export default function QuotationsPage() {
  const { t, tr, trL, lang, formatNumber, formatDate } = useLanguage();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('');
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

  useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    fetch(`/api/quotations?q=${encodeURIComponent(dq)}&status=${tab}&page=${page}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [], total: 0 })
      .then(d => { setRows(d.rows || []); setTotal(d.total || 0); })
      .catch(() => { setRows([]); setTotal(0); });
  }, [dq, tab, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq, tab]);

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
          <div className="flex-1" />
          <a href={'/api/export/quotations?lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.export')}</a>
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
                  <Td onClick={e => r.project_id && e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={r.status} />
                      {r.project_status && (
                        r.project_id ? (
                          <a href={(process.env.NEXT_PUBLIC_PROJECTS_APP_URL || 'https://projects.alfarooque.com') + '/projects/' + r.project_id}
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
        <Pagination page={page} pageSize={25} total={total} onPage={setPage} />
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
