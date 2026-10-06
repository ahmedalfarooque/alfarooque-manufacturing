'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { ListPagination } from '@/components/ListPagination';
import DateFilter, { presetRange } from '@/components/DateFilter';
import { useLanguage } from '@/lib/i18n';
import { EmptyState, Button, Input, Th, Td } from '@/components/ui';
import { StatusPill, SeverityPill, DaysText, NotifyLine, Notice } from '@/components/ExpiryUi';
import { normalizeEmail, isValidEmail } from '@/lib/alertSettings';

const TABS = ['expiry', 'system', 'resolved', 'settings'];

export default function AlertsPage() {
  const { t } = useLanguage();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'expiry';
    const q = new URLSearchParams(window.location.search).get('tab');
    return TABS.includes(q) ? q : 'expiry';
  });
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  const tabLabel = { expiry: t('al.tabExpiry'), system: t('al.tabSystem'), resolved: t('al.tabResolved'), settings: t('al.tabSettings') };

  return (
    <Shell active="/alerts">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold">{t('nav.alerts')}</h2>
      </div>
      <div role="tablist" aria-label={t('nav.alerts')} className="flex gap-1 mb-4 overflow-x-auto border-b border-[color:var(--bd)]">
        {TABS.map(k => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ' + (tab === k ? 'border-[color:var(--pr)] text-[color:var(--tx)]' : 'border-transparent text-[color:var(--tx-3)] hover:text-[color:var(--tx)]')}>
            {tabLabel[k]}
          </button>
        ))}
      </div>
      {tab === 'expiry' && <ExpiryAlerts />}
      {tab === 'system' && <SystemAlerts isAdmin={isAdmin} />}
      {tab === 'resolved' && <ResolvedAlerts />}
      {tab === 'settings' && <AlertSettings />}
    </Shell>
  );
}

/* ───────────────────────── Expiry alerts ───────────────────────── */

function ExpiryAlerts() {
  const { t, formatDateOnly } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [f, setF] = useState({ type: 'all', status: 'all', vehicle: 'all', severity: 'all', from: '', to: '' });

  useEffect(() => {
    fetch('/api/expiry-alerts', { credentials: 'same-origin' })
      .then(r => r.json().then(b => r.ok ? b : Promise.reject(new Error(b.error))))
      .then(setData).catch(e => setError(e.message));
  }, []);

  const alerts = data?.alerts || [];
  const vehicles = useMemo(() => [...new Map(alerts.map(a => [a.carId, a.vehicleNumber])).entries()], [alerts]);
  const rows = alerts.filter(a =>
    (f.type === 'all' || a.alertType === f.type) &&
    (f.status === 'all' || a.status === f.status) &&
    (f.vehicle === 'all' || a.carId === f.vehicle) &&
    (f.severity === 'all' || a.severity === f.severity) &&
    (!f.from || a.expiryDate >= f.from) && (!f.to || a.expiryDate <= f.to));
  const filtered = f.type !== 'all' || f.status !== 'all' || f.vehicle !== 'all' || f.severity !== 'all' || f.from || f.to;
  const set = k => v => setF(s => ({ ...s, [k]: v }));

  if (error) return <Notice tone="red">{error}</Notice>;
  if (!data) return <div className="text-sm text-[color:var(--tx-3)]">{t('common.loading')}</div>;

  return (
    <>
      {data.schemaReady === false && <div className="mb-4"><Notice>{t('fleet.schemaPending')}</Notice></div>}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <span className="px-3 py-1 rounded-full bg-[color:var(--pr-soft)] font-semibold text-[color:var(--tx)]">{t('al.activeCount', { n: data.activeAlertCount })}</span>
        {['expired', 'critical', 'urgent', 'warning'].map(k => data.severity[k] > 0 && <span key={k} className="inline-flex items-center gap-1.5"><SeverityPill severity={k} /><span className="tabular-nums font-medium">{data.severity[k]}</span></span>)}
      </div>

      <div className="glass-card glass-card--pad mb-4 grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <Labeled label={t('al.f.type')}><Dropdown value={f.type} onChange={set('type')} options={[['all', t('al.f.allTypes')], ['insurance', t('alertType.insurance')], ['inspection', t('alertType.inspection')]]} /></Labeled>
        <Labeled label={t('al.f.status')}><Dropdown value={f.status} onChange={set('status')} options={[['all', t('al.f.allStatus')], ['expiring_soon', t('expStatus.expiring_soon')], ['expired', t('expStatus.expired')]]} /></Labeled>
        <Labeled label={t('al.f.vehicle')}><Dropdown value={f.vehicle} onChange={set('vehicle')} options={[['all', t('al.f.allVehicles')], ...vehicles.map(([id, n]) => [id, n])]} /></Labeled>
        <Labeled label={t('al.f.severity')}><Dropdown value={f.severity} onChange={set('severity')} options={[['all', t('al.f.allSeverity')], ...['expired', 'critical', 'urgent', 'warning'].map(s => [s, t('severity.' + s)])]} /></Labeled>
        <Labeled label={t('al.f.date') + ' · ' + t('al.f.from')}><Input type="date" value={f.from} onChange={e => set('from')(e.target.value)} /></Labeled>
        <Labeled label={t('al.f.date') + ' · ' + t('al.f.to')}><Input type="date" value={f.to} min={f.from || undefined} onChange={e => set('to')(e.target.value)} /></Labeled>
        {filtered && <div className="col-span-2 lg:col-span-6"><button type="button" className="text-xs text-brand-500 hover:underline" onClick={() => setF({ type: 'all', status: 'all', vehicle: 'all', severity: 'all', from: '', to: '' })}>{t('al.f.clear')}</button></div>}
      </div>

      {rows.length === 0 ? (
        <div className="glass-card glass-card--pad"><EmptyState text={alerts.length === 0 ? t('al.noActive') : t('fleet.noMatch')} /></div>
      ) : (
        <>
          <div className="glass-card overflow-auto max-h-[68vh] hidden md:block">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
                <tr>
                  <Th>{t('fleet.col.vehicle')}</Th><Th>{t('fleet.col.alertType')}</Th><Th>{t('fleet.col.expiry')}</Th>
                  <Th>{t('fleet.col.days')}</Th><Th>{t('fleet.col.status')}</Th><Th>{t('fleet.col.severity')}</Th><Th>{t('vd.emailNotification')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(a => (
                  <tr key={a.key} className="cursor-pointer hover:bg-[color:var(--pr-soft)] transition-colors" onClick={() => { window.location.href = '/vehicles/' + a.carId; }}>
                    <Td><div className="font-medium">{a.vehicleNumber}</div><div className="text-xs text-[color:var(--tx-3)]">{a.vehicleName || '—'}</div></Td>
                    <Td>{t('alertType.' + a.alertType)}</Td>
                    <Td>{formatDateOnly(a.expiryDate)}</Td>
                    <Td><DaysText days={a.daysRemaining} /></Td>
                    <Td><StatusPill status={a.status} /></Td>
                    <Td><SeverityPill severity={a.severity} /></Td>
                    <Td><NotifyLine rec={{ isActive: true, notification: a.notification }} schemaReady={data.schemaReady} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-3">
            {rows.map(a => (
              <li key={a.key}>
                <a href={'/vehicles/' + a.carId} className="glass-card glass-card--pad block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="font-semibold truncate">{a.vehicleNumber}</div><div className="text-xs text-[color:var(--tx-3)] truncate">{t('alertType.' + a.alertType)}</div></div>
                    <SeverityPill severity={a.severity} />
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-3 text-xs">
                    <span>{formatDateOnly(a.expiryDate)}</span><DaysText days={a.daysRemaining} />
                  </div>
                  <div className="mt-3 pt-3 border-t border-[color:var(--bd)]"><NotifyLine rec={{ isActive: true, notification: a.notification }} schemaReady={data.schemaReady} /></div>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Labeled({ label, children }) {
  return <div className="min-w-0"><div className="text-[11px] font-medium text-[color:var(--tx-3)] mb-1.5">{label}</div>{children}</div>;
}

/* ───────────────────────── Resolved history ───────────────────────── */

function ResolvedAlerts() {
  const { t, formatDateOnly } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch('/api/expiry-alerts', { credentials: 'same-origin' })
      .then(r => r.json().then(b => r.ok ? b : Promise.reject(new Error(b.error)))).then(setData).catch(e => setError(e.message));
  }, []);
  if (error) return <Notice tone="red">{error}</Notice>;
  if (!data) return <div className="text-sm text-[color:var(--tx-3)]">{t('common.loading')}</div>;
  if (data.schemaReady === false) return <Notice>{t('fleet.schemaPending')}</Notice>;
  if (data.resolved.length === 0) return <div className="glass-card glass-card--pad"><EmptyState text={t('al.noResolved')} /></div>;
  return (
    <div className="glass-card overflow-auto max-h-[68vh]">
      <table className="w-full text-sm min-w-[760px]">
        <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
          <tr><Th>{t('fleet.col.vehicle')}</Th><Th>{t('fleet.col.alertType')}</Th><Th>{t('fleet.col.expiry')}</Th><Th>{t('al.firstDetected')}</Th><Th>{t('fleet.col.notified')}</Th><Th>{t('al.resolvedOn')}</Th></tr>
        </thead>
        <tbody>
          {data.resolved.map(r => (
            <tr key={r.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
              <Td><a href={'/vehicles/' + r.carId} className="font-medium hover:underline">{r.vehicleNumber || '—'}</a></Td>
              <Td>{t('alertType.' + r.alertType)}</Td>
              <Td>{formatDateOnly(r.expiryDate)}</Td>
              <Td>{r.firstDetectedOn ? formatDateOnly(r.firstDetectedOn) : '—'}</Td>
              <Td>{r.lastSentOn ? formatDateOnly(r.lastSentOn) : t('fleet.neverNotified')}</Td>
              <Td>{formatDateOnly(r.resolvedOn)} <span className="text-xs text-[color:var(--tx-3)]">· {t('al.reason.' + r.resolvedReason)}</span></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────── Settings: recipients + switches ───────────────────── */

function AlertSettings() {
  const { t } = useLanguage();
  const [state, setState] = useState(null);   // { settings, recipients, canManage }
  const [error, setError] = useState(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = useCallback(() => {
    fetch('/api/alert-settings', { credentials: 'same-origin' })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (ok) { setState(b); setError(null); setSchemaMissing(false); }
        else if (b.code === 'SCHEMA_MISSING') setSchemaMissing(true);
        else setError(b.error);
      }).catch(e => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function call(url, method, body) {
    const res = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(b.error || t('al.errGeneric')), { code: b.code });
    return b;
  }

  async function addRecipient(e) {
    e.preventDefault();
    const value = normalizeEmail(email);
    if (!isValidEmail(value)) { setFormErr(t('al.errInvalidEmail')); return; }
    if (state.recipients.some(r => r.email === value)) { setFormErr(t('al.errDuplicate')); return; }
    setBusy(true); setFormErr('');
    try { await call('/api/alert-settings/recipients', 'POST', { email: value }); setEmail(''); setAdding(false); load(); }
    catch (err) { setFormErr(err.code === 'DUPLICATE' ? t('al.errDuplicate') : err.code === 'INVALID_EMAIL' ? t('al.errInvalidEmail') : err.message); }
    finally { setBusy(false); }
  }
  async function toggleRecipient(r) { try { await call('/api/alert-settings/recipients', 'PATCH', { id: r.id, enabled: !r.enabled }); load(); } catch (err) { setError(err.message); } }
  async function removeRecipient(r) {
    if (!confirm(t('al.confirmRemove', { email: r.email }))) return;
    try { await call('/api/alert-settings/recipients?id=' + encodeURIComponent(r.id), 'DELETE'); load(); } catch (err) { setError(err.message); }
  }
  async function saveSetting(patch) {
    const prev = state;
    setState(s => ({ ...s, settings: { ...s.settings, ...patch } }));      // optimistic
    try { await call('/api/alert-settings', 'PUT', patch); }
    catch (err) { setState(prev); setError(err.message); }
  }
  async function runPreview() {
    setBusy(true); setPreview(null);
    try { const b = await call('/api/cron/expiry-alerts', 'POST', { dryRun: true }); setPreview(b.report); }
    catch (err) { setPreview({ error: err.message }); }
    finally { setBusy(false); }
  }

  if (schemaMissing) return <Notice>{t('fleet.schemaPending')}</Notice>;
  if (error && !state) return <Notice tone="red">{error}</Notice>;
  if (!state) return <div className="text-sm text-[color:var(--tx-3)]">{t('common.loading')}</div>;
  const { settings, recipients, canManage } = state;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="glass-card glass-card--pad" data-testid="recipients">
        <h3 className="font-semibold text-sm">{t('al.settings.recipients')}</h3>
        <p className="text-xs text-[color:var(--tx-3)] mt-0.5 mb-4">{t('al.settings.recipientsHelp')}</p>
        {error && <div className="mb-3"><Notice tone="red">{error}</Notice></div>}

        {recipients.length === 0 ? (
          <div className="text-sm text-[color:var(--tx-3)] py-3">{t('al.noRecipients')}</div>
        ) : (
          <ul className="divide-y divide-[color:var(--bd)] mb-4">
            {recipients.map(r => (
              <li key={r.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                <span className="min-w-0 flex-1 text-sm font-medium break-all" dir="ltr">{r.email}</span>
                <span className={'text-[11px] px-2 py-0.5 rounded-full font-medium ' + (r.enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/10 text-[color:var(--tx-3)]')}>{r.enabled ? t('al.enabled') : t('al.disabled')}</span>
                {canManage && (
                  <span className="flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => toggleRecipient(r)}>{r.enabled ? t('al.disable') : t('al.enable')}</Button>
                    <Button variant="danger" size="sm" onClick={() => removeRecipient(r)}>{t('al.remove')}</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (adding ? (
          <form onSubmit={addRecipient} className="space-y-2" noValidate>
            <div className="flex gap-2 flex-wrap">
              <Input type="email" dir="ltr" autoFocus value={email} placeholder={t('al.emailPlaceholder')} aria-label={t('al.settings.recipients')} aria-invalid={formErr ? 'true' : undefined}
                onChange={e => { setEmail(e.target.value); setFormErr(''); }} className="flex-1 min-w-[200px]" />
              <Button type="submit" disabled={busy}>{t('al.add')}</Button>
              <Button type="button" variant="ghost" onClick={() => { setAdding(false); setEmail(''); setFormErr(''); }}>{t('al.cancel')}</Button>
            </div>
            {formErr && <div role="alert" className="text-xs text-red-600 dark:text-red-400">{formErr}</div>}
          </form>
        ) : <Button variant="secondary" onClick={() => setAdding(true)}>{t('al.addEmail')}</Button>
        ) : <div className="text-xs text-[color:var(--tx-4)]">{t('al.adminOnly')}</div>}
      </div>

      <div className="space-y-4">
        <div className="glass-card glass-card--pad">
          <h3 className="font-semibold text-sm mb-3">{t('al.settings.title')}</h3>
          <div className="space-y-3">
            <Switch label={t('al.toggle.insurance')} on={settings.insurance_alerts_enabled} disabled={!canManage} onChange={v => saveSetting({ insurance_alerts_enabled: v })} />
            <Switch label={t('al.toggle.inspection')} on={settings.inspection_alerts_enabled} disabled={!canManage} onChange={v => saveSetting({ inspection_alerts_enabled: v })} />
            <Switch label={t('al.toggle.daily')} on={settings.daily_notification_enabled} disabled={!canManage} onChange={v => saveSetting({ daily_notification_enabled: v })} />
            <div>
              <div className="text-[11px] font-medium text-[color:var(--tx-3)] mb-1.5">{t('al.emailLanguage')}</div>
              <Dropdown value={settings.email_language} disabled={!canManage} onChange={v => saveSetting({ email_language: v })} options={['en', 'ar', 'both'].map(l => [l, t('al.lang.' + l)])} />
            </div>
          </div>
          <p className="text-xs text-[color:var(--tx-3)] mt-4 leading-relaxed">{t('al.scheduleNote')}</p>
        </div>

        {canManage && (
          <div className="glass-card glass-card--pad">
            <h3 className="font-semibold text-sm">{t('al.dryRun')}</h3>
            <p className="text-xs text-[color:var(--tx-3)] mt-0.5 mb-3">{t('al.dryRunHelp')}</p>
            <Button variant="secondary" onClick={runPreview} disabled={busy}>{t('al.dryRun')}</Button>
            {preview && (
              <div className="mt-3 text-sm" role="status">
                {preview.error ? <span className="text-red-600 dark:text-red-400">{preview.error}</span>
                  : preview.reasonsNotSent?.length ? t('al.dryRunNothing', { reason: preview.reasonsNotSent.map(r => t('al.reasonText.' + r)).join(', ') })
                  : t('al.dryRunResult', { alerts: preview.activeAlerts, recipients: preview.recipients, emails: preview.plan.length })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Switch({ label, on, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <button type="button" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
        className={'relative h-6 w-11 rounded-full transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ' + (on ? 'bg-[color:var(--pr)]' : 'bg-slate-400/50')}>
        <span className={'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ' + (on ? 'start-[22px]' : 'start-0.5')} />
      </button>
    </div>
  );
}

/* ───────────────────── System notifications (existing) ───────────────────── */

function SystemAlerts({ isAdmin }) {
  const { t, lang, formatDateTime } = useLanguage();
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(null);
  const [reportBusy, setReportBusy] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { from: dateFrom, to: dateTo } = dateFilter.preset === 'custom' ? dateFilter : presetRange(dateFilter.preset);

  function load() {
    const q = new URLSearchParams({ dateFrom: dateFrom || '', dateTo: dateTo || '' });
    fetch('/api/alerts?' + q.toString(), { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error))))
      .then(d => setAlerts(d.alerts))
      .catch(e => setError(e.message));
  }
  useEffect(load, [dateFrom, dateTo]);
  useEffect(() => { setPage(1); }, [dateFrom, dateTo]);

  const total = alerts ? alerts.length : 0;
  const pageRows = (alerts || []).slice((page - 1) * pageSize, page * pageSize);

  async function markRead(id) {
    await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id }) });
    load();
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      const ar = lang === 'ar';
      await exportReportPdf({
        title: ar ? 'تقرير التنبيهات' : 'Alerts Report',
        columns: [
          { key: 'title', header: ar ? 'العنوان' : 'Title' },
          { key: 'vehicle', header: ar ? 'المركبة' : 'Vehicle' },
          { key: 'body', header: ar ? 'التفاصيل' : 'Details' },
          { key: 'date', header: ar ? 'التاريخ' : 'Date' },
          { key: 'status', header: ar ? 'الحالة' : 'Status' },
        ],
        rows: (alerts || []).map(a => ({
          title: a.title || '—', vehicle: a.cars?.vehicle_number || '—', body: a.body || '—',
          date: formatDateTime(a.created_at), status: a.is_read ? (ar ? 'مقروء' : 'Read') : (ar ? 'غير مقروء' : 'Unread'),
        })),
        lang, fileName: 'alerts-report.pdf', action,
      });
    } catch (e) { /* keep page silent-safe; error state below stays untouched */ }
    finally { setReportBusy(''); }
  }

  return (
    <>
      <div className="flex items-center justify-end mb-4 flex-wrap gap-2">
        <DateFilter value={dateFilter} onChange={setDateFilter} t={t} lang={lang} />
        <Button variant="ghost" onClick={() => runReport('print')} disabled={!alerts?.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('common.print')}</Button>
        <Button variant="ghost" onClick={() => runReport('save')} disabled={!alerts?.length || !!reportBusy}>{reportBusy === 'save' ? '…' : t('common.downloadPdf')}</Button>
      </div>
      {error && <div className="text-[#ef4444] text-sm">{error}</div>}
      {!alerts ? (
        <div className="text-[color:var(--tx-3)] text-sm">{t('common.loading')}</div>
      ) : alerts.length === 0 ? (
        <div className="glass-card glass-card--pad"><EmptyState text={t('dash.noAlertsYet')} /></div>
      ) : (
        <>
          <div className="space-y-2">
            {pageRows.map(a => (
              <div key={a.id} className={a.is_read
                ? 'glass-card glass-card--pad flex items-start justify-between gap-3 opacity-60'
                : 'rounded-2xl border border-[#ef4444]/30 bg-[#ef4444]/5 p-4 flex items-start justify-between gap-3'}>
                <div>
                  <div className="font-medium text-sm">{a.title} {a.cars?.vehicle_number && <span className="text-[color:var(--tx-3)]">— {a.cars.vehicle_number}</span>}</div>
                  <div className="text-xs text-[color:var(--tx-3)] mt-1">{a.body}</div>
                  <div className="text-[11px] text-[color:var(--tx-4)] mt-1">{formatDateTime(a.created_at)}</div>
                </div>
                {isAdmin && !a.is_read && <button onClick={() => markRead(a.id)} className="text-xs px-2 py-1 rounded-lg border border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)] transition-colors shrink-0">{t('alerts.markRead')}</button>}
              </div>
            ))}
          </div>
          <ListPagination
            page={page} pageSize={pageSize} total={total} count={pageRows.length}
            onPage={setPage} onPageSize={v => { setPageSize(v); setPage(1); }}
            showingLabel={({ from, to, total }) => t('alerts.showingEntries', { from, to, total })}
            rowsLabel={t('alerts.rows')}
          />
        </>
      )}
    </>
  );
}
