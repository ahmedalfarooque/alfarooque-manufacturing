'use client';

/* One list page, two modes: Insurance and Periodic Vehicle Inspection.
   Data comes from /api/insurance or /api/inspection (already computed by
   lib/fleetExpiry.js); this component only filters, sorts and renders.
   Desktop/tablet: sortable table. Phone: one card per vehicle (a shrunken
   table is unusable at 375px). */

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { GlassIcon } from '@/components/GlassIcons';
import { EmptyState, Input, IconButton, Button, Th, Td } from '@/components/ui';
import ColumnPicker, { useColumnPrefs, pdfColumns, pdfRows } from '@/components/ColumnPicker';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage, trExpiryDays, trEnum } from '@/lib/i18n';
import { StatusPill, SeverityPill, DaysText, VehicleStatusPill, NotifyLine, Notice, sortRows, matchesFilter, matchesSearch } from '@/components/ExpiryUi';

const CONFIG = {
  insurance: {
    api: '/api/insurance', active: '/insurance', titleKey: 'ins.title', subKey: 'ins.subtitle',
    filters: ['all', 'valid', 'expiring30', 'critical', 'urgent', 'warning', 'expired', 'missing'],
  },
  inspection: {
    api: '/api/inspection', active: '/inspection', titleKey: 'insp.title', subKey: 'insp.subtitle',
    filters: ['all', 'expiring30', 'critical', 'urgent', 'warning', 'expired', 'valid', 'missingDates'],
  },
};

export default function ExpiryListPage({ kind }) {
  const cfg = CONFIG[kind];
  const { t, lang, formatDateOnly } = useLanguage();
  const { data, error } = useLiveData(cfg.api, 30000);
  const [me, setMe] = useState(null);
  const [filter, setFilter] = useState(() => {
    if (typeof window === 'undefined') return 'all';
    const f = new URLSearchParams(window.location.search).get('filter');
    return CONFIG[kind].filters.includes(f) ? f : 'all';
  });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('urgent');
  const [dir, setDir] = useState('asc');
  const [reportBusy, setReportBusy] = useState('');
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  const rows = data?.rows || [];
  const visible = useMemo(
    () => sortRows(rows.filter(r => matchesFilter(r, filter) && matchesSearch(r, search)), sort, dir),
    [rows, filter, search, sort, dir]
  );

  const summary = data?.summary;
  const kpis = summary ? [
    { key: 'all', label: t('fleet.kpi.total'), value: summary.total },
    { key: 'valid', label: t('fleet.kpi.valid'), value: summary.valid },
    { key: 'expiring30', label: t('fleet.kpi.expiring'), value: summary.expiringSoon, tone: summary.expiringSoon ? 'amber' : null },
    { key: 'expired', label: t('fleet.kpi.expired'), value: summary.expired, tone: summary.expired ? 'red' : null },
    kind === 'insurance'
      ? { key: 'missing', label: t('fleet.kpi.missing') + ' / ' + t('fleet.kpi.missingDetails'), value: summary.missingDate + ' / ' + summary.missingDetails, wide: true }
      : { key: 'missingDates', label: t('fleet.kpi.missing'), value: summary.missingDate },
  ] : [];

  const goVehicle = id => { window.location.href = '/vehicles/' + id; };
  const isInsurance = kind === 'insurance';
  const notSetCell = <span className="text-[color:var(--tx-4)]">{t('expiry.notSet')}</span>;
  const dateCell = v => (v ? formatDateOnly(v) : notSetCell);
  const datePdf = v => (v ? formatDateOnly(v) : t('expiry.notSet'));
  /* Page-view column model: the table, Print and Download PDF all read it. */
  const cols = [
    { key: 'vehicleNumber', label: t('fleet.col.vehicle'), className: 'font-medium', render: r => r.vehicleNumber, pdf: r => r.vehicleNumber || '' },
    { key: 'vehicleName', label: t('fleet.col.name'), render: r => r.vehicleName || '—', pdf: r => r.vehicleName || '' },
    ...(isInsurance ? [
      { key: 'company', label: t('fleet.col.company'), render: r => r.company || notSetCell, pdf: r => r.company || t('expiry.notSet') },
      { key: 'policyNumber', label: t('fleet.col.policy'), render: r => r.policyNumber || notSetCell, pdf: r => r.policyNumber || t('expiry.notSet') },
      { key: 'startDate', label: t('fleet.col.start'), render: r => dateCell(r.startDate), pdf: r => datePdf(r.startDate) },
    ] : [
      { key: 'lastTakenDate', label: t('fleet.col.lastTaken'), render: r => dateCell(r.lastTakenDate), pdf: r => datePdf(r.lastTakenDate) },
    ]),
    { key: 'expiryDate', label: isInsurance ? t('fleet.col.expiry') : t('fleet.col.nextExpiry'), render: r => (r.hasDate ? formatDateOnly(r.expiryDate) : notSetCell), pdf: r => (r.hasDate ? formatDateOnly(r.expiryDate) : t('expiry.notSet')) },
    { key: 'daysRemaining', label: t('fleet.col.days'), render: r => <DaysText days={r.daysRemaining} />, pdf: r => trExpiryDays(t, r.daysRemaining) },
    { key: 'status', label: t('fleet.col.status'), render: r => <StatusPill status={r.displayStatus} />, pdf: r => t('expStatus.' + r.displayStatus) },
    { key: 'alert', label: t('fleet.col.alert'), render: r => (r.isActive ? <div className="flex flex-col gap-1.5">{r.status !== 'expired' && <SeverityPill severity={r.severity} />}<NotifyLine rec={r} schemaReady={data?.schemaReady} /></div> : <NotifyLine rec={r} />),
      pdf: r => (r.isActive ? t('severity.' + r.severity) : t('fleet.noAlert')) },
    { key: 'vehicleStatus', label: t('fleet.col.vehicleStatus'), render: r => <VehicleStatusPill status={r.vehicleStatus} />, pdf: r => (r.vehicleStatus ? trEnum(t, 'status', r.vehicleStatus) : '') },
    { key: 'actions', label: t('fleet.col.actions'), required: true, noPdf: true, stop: true, className: 'text-end whitespace-nowrap', render: r => (
      <div className="flex items-center justify-end">
        <a href={'/vehicles/' + r.id} className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-[color:var(--pr-soft)]" title={t('fleet.view')} aria-label={t('fleet.view') + ' ' + r.vehicleNumber}><GlassIcon name="eye" size={18} bare /></a>
        {isAdmin && <a href={'/vehicles/' + r.id + '?edit=1'} className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-[color:var(--pr-soft)]" title={t('fleet.edit')} aria-label={t('fleet.edit') + ' ' + r.vehicleNumber}><GlassIcon name="edit" size={18} bare /></a>}
      </div>
    ) },
  ];
  const prefs = useColumnPrefs('expiry-' + kind, cols);
  const { visibleCols } = prefs;

  /* Print / PDF use exactly the visible columns and the filtered, sorted rows. */
  async function runReport(action) {
    setReportBusy(action);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: t(cfg.titleKey), columns: pdfColumns(visibleCols), rows: pdfRows(visibleCols, visible),
        lang, fileName: (isInsurance ? 'insurance' : 'inspection') + '-report.pdf', action, orientation: 'landscape',
      });
    } catch (e) { /* report failures must not break the page */ }
    finally { setReportBusy(''); }
  }

  return (
    <Shell active={cfg.active}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-semibold">{t(cfg.titleKey)}</h2>
          <p className="text-xs text-[color:var(--tx-3)]">{t(cfg.subKey)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {data?.today && <div className="text-xs text-[color:var(--tx-3)]">{t('dx.today')}: <span className="font-medium text-[color:var(--tx-2)]">{formatDateOnly(data.today)}</span></div>}
          <ColumnPicker columns={cols} prefs={prefs} />
          <Button variant="ghost" size="sm" onClick={() => runReport('print')} disabled={!visible.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('common.print')}</Button>
          <Button variant="ghost" size="sm" onClick={() => runReport('save')} disabled={!visible.length || !!reportBusy}>{reportBusy === 'save' ? '…' : t('common.downloadPdf')}</Button>
        </div>
      </div>

      {error && <Notice tone="red">{error}</Notice>}
      {data && !isInsurance && data.inspectionColumnsExist === false && <div className="mb-4"><Notice>{t('fleet.inspectionSchemaPending')}</Notice></div>}
      {data && data.schemaReady === false && (isInsurance || data.inspectionColumnsExist !== false) && <div className="mb-4"><Notice>{t('fleet.schemaPending')}</Notice></div>}

      {!data && !error && <div className="text-sm text-[color:var(--tx-3)]">{t('common.loading')}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {kpis.map(k => (
              <button key={k.key} type="button" onClick={() => setFilter(k.key)} aria-pressed={filter === k.key}
                className={'glass-card glass-card--pad text-start transition-shadow ' + (k.wide ? 'col-span-2 md:col-span-1 ' : '') + (filter === k.key ? 'ring-2 ring-[color:var(--pr)]' : 'hover:shadow-md')}>
                <div className={'text-2xl font-semibold tabular-nums ' + (k.tone === 'red' ? 'text-red-600 dark:text-red-400' : k.tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-[color:var(--tx)]')}>{k.value}</div>
                <div className="text-[11px] text-[color:var(--tx-3)] mt-1 leading-snug">{k.label}</div>
              </button>
            ))}
          </div>

          <div className="glass-card glass-card--pad mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] gap-3 items-end">
            <Input placeholder={t('fleet.search')} value={search} onChange={e => setSearch(e.target.value)} aria-label={t('fleet.search')} />
            <Dropdown value={filter} onChange={setFilter} options={cfg.filters.map(f => [f, t('fleet.filter.' + f)])} />
            <Dropdown value={sort} onChange={setSort} options={['urgent', 'expiry', 'days', 'number', 'name'].map(s => [s, t('fleet.sortBy') + ': ' + t('fleet.sort.' + s)])} />
            <IconButton onClick={() => setDir(d => d === 'asc' ? 'desc' : 'asc')} aria-label={t('fleet.sortBy') + ': ' + (dir === 'asc' ? '↑' : '↓')} title={dir === 'asc' ? '↑' : '↓'} className="text-base">{dir === 'asc' ? '↑' : '↓'}</IconButton>
          </div>

          {visible.length === 0 ? (
            <div className="glass-card glass-card--pad"><EmptyState text={rows.length === 0 ? t('fleet.noData') : t('fleet.noMatch')} /></div>
          ) : (
            <>
              {/* ≥ md: table */}
              <div className="glass-card overflow-auto max-h-[68vh] hidden md:block">
                <table className="w-full text-sm min-w-[980px]">
                  <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
                  <tr>{visibleCols.map(c => <Th key={c.key} className={c.className || ''}>{c.label}</Th>)}</tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.id} className="cursor-pointer hover:bg-[color:var(--pr-soft)] transition-colors" onClick={() => goVehicle(r.id)}>
                      {visibleCols.map(c => <Td key={c.key} className={c.className || ''} onClick={c.stop ? e => e.stopPropagation() : undefined}>{c.render(r)}</Td>)}
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>

              {/* < md: cards */}
              <ul className="md:hidden space-y-3" aria-label={t(cfg.titleKey)}>
                {visible.map(r => (
                  <li key={r.id}>
                    <a href={'/vehicles/' + r.id} className="glass-card glass-card--pad block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{r.vehicleNumber}</div>
                          <div className="text-xs text-[color:var(--tx-3)] truncate">{r.vehicleName || '—'}</div>
                        </div>
                        <StatusPill status={r.displayStatus} />
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 text-xs">
                        <Item label={isInsurance ? t('fleet.col.expiry') : t('fleet.col.nextExpiry')}>{r.hasDate ? formatDateOnly(r.expiryDate) : t('expiry.notSet')}</Item>
                        <Item label={t('fleet.col.days')}><DaysText days={r.daysRemaining} /></Item>
                        {isInsurance ? <Item label={t('fleet.col.company')}>{r.company || t('expiry.notSet')}</Item> : <Item label={t('fleet.col.lastTaken')}>{r.lastTakenDate ? formatDateOnly(r.lastTakenDate) : t('expiry.notSet')}</Item>}
                        {isInsurance ? <Item label={t('fleet.col.policy')}>{r.policyNumber || t('expiry.notSet')}</Item> : <Item label={t('fleet.col.vehicleStatus')}><VehicleStatusPill status={r.vehicleStatus} /></Item>}
                      </dl>
                      {r.isActive && <div className="mt-3 pt-3 border-t border-[color:var(--bd)] flex items-center justify-between gap-3">{r.status !== 'expired' ? <SeverityPill severity={r.severity} /> : <span />}<NotifyLine rec={r} schemaReady={data.schemaReady} /></div>}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs text-[color:var(--tx-3)]">{t('fleet.showing', { n: visible.length, total: rows.length })}</div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}

function Item({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[color:var(--tx-4)]">{label}</dt>
      <dd className="text-[color:var(--tx-2)] font-medium truncate">{children}</dd>
    </div>
  );
}
