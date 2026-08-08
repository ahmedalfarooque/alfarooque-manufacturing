'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { Button, Input, Select, Field, EmptyState, Th, Td } from '@/components/ui';
import { GlassButton } from '@/components/glass';
import { pickDefaultEntityId } from '@/lib/defaultEntity';

const REPORTS = ['quotation-register', 'sales-by-customer', 'profit-margin', 'vat-summary',
  'products-pricelist', 'material-price-moves', 'top-materials', 'labour-rates', 'machines', 'expenses',
  'materials-report'];

/* Relative column-width weights so the table always fills 100% of the
   content area (never overflows) while giving descriptive columns more
   room and keeping numeric/short columns compact. Matched by the column
   key; anything unlisted gets the default weight. Layout only — no data,
   colour or logic change. */
const WIDTH_WEIGHTS = {
  name: 5, product: 5, material: 5, project: 5, vehicle: 5, machine: 5,
  category: 4, sub_category: 4,
  customer_name: 3, customer: 3, supplier: 3,
  code: 2, quote_number: 2, date: 2, quote_date: 2, effective_date: 2, created_at: 2, updated_at: 2, month: 2,
  unit: 1, standard_price: 1, last_calculated_cost: 1, latest_price: 1, price: 1, previous_price: 1,
  cost: 1, total_cost: 1, margin: 1, blended_margin_pct: 1, status: 1, source: 1,
};
function colWidthPercents(columns) {
  const w = columns.map(c => WIDTH_WEIGHTS[c.key] ?? 2);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map(x => (x / sum * 100).toFixed(3) + '%');
}
const DATED = ['quotation-register', 'sales-by-customer', 'profit-margin', 'vat-summary', 'material-price-moves'];
/* These two report types are per-quotation rows (share the same base
   query) — clicking a row opens that quotation. Other report types are
   aggregates or master-data snapshots with no single record to open. */
const LINKS_TO_QUOTATION = ['quotation-register', 'profit-margin'];

export default function ReportsPage() {
  const { t, lang, formatNumber } = useLanguage();
  const [slug, setSlug] = useState('quotation-register');
  const [from, setFrom] = useState(() => new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [entities, setEntities] = useState([]);
  const [entity, setEntity] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    fetch('/api/entities', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => { setEntities(d.rows || []); setEntity(pickDefaultEntityId(d.rows)); })
      .catch(() => {});
  }, []);

  const qs = () => `from=${from}&to=${to}&entity=${entity}&lang=${lang}`;

  async function run() {
    setBusy(true); setData(null);
    const res = await fetch(`/api/reports/${slug}?${qs()}`, { credentials: 'same-origin' }).catch(() => null);
    const d = res && res.ok ? await res.json() : { columns: [], rows: [] };
    setData(d);
    setBusy(false);
  }

  /* Standardized A4 report PDF — same shared engine as the Projects and
     Car Inventory apps (lib/reportPdf.js). Pulls the SAME dataset as the
     Excel/CSV links (same API, same query string), so all three formats
     always carry identical data. The quotation DOCUMENT pdf pipeline
     (lib/pdf/*) is untouched. */
  async function exportPdf() {
    if (pdfBusy) return; // guards against a double-click firing two concurrent fetch+generate cycles
    setPdfBusy(true);
    try {
      const res = await fetch(`/api/reports/${slug}?${qs()}`, { credentials: 'same-origin' }).catch(() => null);
      const d = res && res.ok ? await res.json() : null;
      if (!d || !d.columns) return;
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: t('report.' + slug),
        columns: d.columns.map(c => ({ key: c.key, header: c.header })),
        rows: d.rows || [],
        lang,
        fileName: slug + '-report.pdf',
      });
    } finally { setPdfBusy(false); }
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
          <a href={`/api/reports/${slug}?${qs()}&format=xlsx`} className="af-btn af-btn--secondary text-sm">⇩ Excel</a>
          <a href={`/api/reports/${slug}?${qs()}&format=csv`} className="af-btn af-btn--secondary text-sm">⇩ CSV</a>
          <GlassButton variant="secondary" className="text-sm" onClick={exportPdf} disabled={pdfBusy}>⇩ PDF</GlassButton>
        </div>

        <div className="glass-card overflow-hidden">
          {data === null ? (
            <EmptyState text={busy ? t('shell.loading') : t('reports.hint')} />
          ) : data.rows.length === 0 ? (
            <EmptyState text={t('common.noRecords')} />
          ) : (
            <div className="w-full">
              {/* table-fixed + colgroup percentages → always fills the
                  content width and wraps long text instead of forcing
                  horizontal scroll (Part 1). */}
              <table className="w-full table-fixed">
                <colgroup>
                  {colWidthPercents(data.columns).map((wpc, ci) => <col key={ci} style={{ width: wpc }} />)}
                </colgroup>
                {/* header cells mirror <Th> exactly but wrap instead of
                    nowrap, so long headers never widen the table */}
                <thead><tr>{data.columns.map(c => (
                  <th key={c.key} className="text-start px-3 py-2.5 text-[11px] uppercase tracking-wider text-[#7C9296] font-medium align-top break-words whitespace-normal">{c.header}</th>
                ))}</tr></thead>
                <tbody>
                  {data.rows.map((r, i) => {
                    const clickable = LINKS_TO_QUOTATION.includes(slug) && r.id;
                    return (
                      <tr key={i}
                        onClick={clickable ? () => { window.location.href = '/quotations/' + r.id; } : undefined}
                        className={'transition-colors duration-150 hover:bg-[#EEF3F4] dark:hover:bg-white/[0.03] ' + (clickable ? 'cursor-pointer' : '')}>
                        {data.columns.map(c => <Td key={c.key} dir="auto" className="align-top break-words whitespace-normal">{cell(r[c.key])}</Td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 text-[12px] text-[#7C9296]">{data.rows.length} {t('reports.rows')}</div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
