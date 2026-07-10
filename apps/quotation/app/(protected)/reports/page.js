'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { Button, Input, Select, Field, EmptyState, Th, Td } from '@/components/ui';

const REPORTS = ['quotation-register', 'sales-by-customer', 'profit-margin', 'vat-summary',
  'products-pricelist', 'material-price-moves', 'top-materials', 'labour-rates', 'machines', 'expenses'];
const DATED = ['quotation-register', 'sales-by-customer', 'profit-margin', 'vat-summary', 'material-price-moves'];

export default function ReportsPage() {
  const { t, lang, formatNumber } = useLanguage();
  const [slug, setSlug] = useState('quotation-register');
  const [from, setFrom] = useState(() => new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [entities, setEntities] = useState([]);
  const [entity, setEntity] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/entities', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] }).then(d => setEntities(d.rows || [])).catch(() => {});
  }, []);

  const qs = () => `from=${from}&to=${to}&entity=${entity}&lang=${lang}`;

  async function run() {
    setBusy(true); setData(null);
    const res = await fetch(`/api/reports/${slug}?${qs()}`, { credentials: 'same-origin' }).catch(() => null);
    const d = res && res.ok ? await res.json() : { columns: [], rows: [] };
    setData(d);
    setBusy(false);
  }

  function cell(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'number') return formatNumber(v, { maximumFractionDigits: 2 });
    return String(v);
  }

  return (
    <Shell active="/reports">
      <div className="space-y-4">
        <div className="glass-card p-4 flex flex-wrap items-end gap-3">
          <Field label={t('reports.report')} className="min-w-[240px]">
            <Select value={slug} onChange={e => { setSlug(e.target.value); setData(null); }}
              options={REPORTS.map(r => ({ value: r, label: t('report.' + r) }))} />
          </Field>
          {DATED.includes(slug) && (
            <>
              <Field label={t('reports.from')}><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
              <Field label={t('reports.to')}><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
              <Field label={t('quote.entity')}>
                <Select value={entity} onChange={e => setEntity(e.target.value)}
                  options={[{ value: '', label: t('common.all') }, ...entities.map(en => ({ value: en.id, label: en.code }))]} />
              </Field>
            </>
          )}
          <Button disabled={busy} onClick={run}>{busy ? t('shell.loading') : t('reports.run')}</Button>
          <div className="flex-1" />
          <a href={`/api/reports/${slug}?${qs()}&format=xlsx`} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ Excel</a>
          <a href={`/api/reports/${slug}?${qs()}&format=csv`} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ CSV</a>
          <button onClick={() => window.print()} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ PDF</button>
        </div>

        <div className="glass-card overflow-hidden">
          {data === null ? (
            <EmptyState text={busy ? t('shell.loading') : t('reports.hint')} />
          ) : data.rows.length === 0 ? (
            <EmptyState text={t('common.noRecords')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>{data.columns.map(c => <Th key={c.key}>{c.header}</Th>)}</tr></thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-[#F7F5F1] dark:hover:bg-white/[0.03]">
                      {data.columns.map(c => <Td key={c.key} dir="auto" className="whitespace-nowrap">{cell(r[c.key])}</Td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 text-[12px] text-[#8C8A80]">{data.rows.length} {t('reports.rows')}</div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
