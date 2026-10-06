'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { ListPagination } from '@/components/ListPagination';
import DateFilter, { presetRange } from '@/components/DateFilter';
import { useLanguage } from '@/lib/i18n';
import { EmptyState, Button, Input, Modal, Th, Td } from '@/components/ui';
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

/* ───────────────────── Settings: per alert type ───────────────────── */

const ALERT_TYPES = ['insurance', 'inspection'];
const LANGS = ['en', 'ar', 'both'];

function AlertSettings() {
  const { t, formatDateTime } = useLanguage();
  const [state, setState] = useState(null);     // { types, lastRun, schedule, emailMode, canManage }
  const [pending, setPending] = useState(null); // { schedule, emailMode } when migration is missing
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    fetch('/api/alert-settings', { credentials: 'same-origin' })
      .then(r => r.json().then(b => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (ok) { setState(b); setPending(null); setError(null); }
        else if (b.code === 'SCHEMA_MISSING') setPending({ schedule: b.schedule, emailMode: b.emailMode });
        else setError(b.error);
      }).catch(e => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error && !state) return <Notice tone="red">{error}</Notice>;
  if (pending) return (
    <div className="space-y-4">
      <Notice>
        <div className="font-semibold mb-1">{t('as.pendingTitle')}</div>
        <div className="text-[13px] leading-relaxed">{t('as.pendingBody')}</div>
        <ul className="list-disc ms-5 mt-2 text-[13px] space-y-0.5">
          {['as.pend.recipients', 'as.pend.settings', 'as.pend.test', 'as.pend.history'].map(k => <li key={k}>{t(k)}</li>)}
        </ul>
      </Notice>
      <ScheduleCard schedule={pending.schedule} emailMode={pending.emailMode} lastRun={null} t={t} formatDateTime={formatDateTime} migrationPending />
    </div>
  );
  if (!state) return <div className="text-sm text-[color:var(--tx-3)]">{t('common.loading')}</div>;

  const { types, lastRun, schedule, emailMode, canManage } = state;
  const anyActive = ALERT_TYPES.some(k => types[k].settings.enabled && types[k].settings.auto_notify_enabled && types[k].recipients.some(r => r.enabled));

  return (
    <div className="space-y-4">
      {error && <Notice tone="red">{error}</Notice>}
      <div className="glass-card glass-card--pad flex items-center justify-between gap-3 flex-wrap" data-testid="global-status">
        <div>
          <div className="text-sm font-semibold">{t('as.globalTitle')}</div>
          <div className="text-xs text-[color:var(--tx-3)] mt-0.5">{anyActive ? t('as.globalOn') : t('as.globalOff')}</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <StatePill on={anyActive} onLabel={t('as.active')} offLabel={t('as.inactive')} />
          <span className={'px-2.5 py-0.5 rounded-full font-medium ' + (emailMode === 'live' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300')}>{emailMode === 'live' ? t('as.modeLive') : t('as.modeMock')}</span>
          {!canManage && <span className="text-[color:var(--tx-4)]">{t('al.adminOnly')}</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {ALERT_TYPES.map(k => <TypeCard key={k} type={k} data={types[k]} canManage={canManage} emailMode={emailMode} onChanged={load} onError={setError} />)}
      </div>

      <ScheduleCard schedule={schedule} emailMode={emailMode} lastRun={lastRun} t={t} formatDateTime={formatDateTime} canManage={canManage} />
    </div>
  );
}

function StatePill({ on, onLabel, offLabel }) {
  return (
    <span className={'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ' + (on ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/10 text-[color:var(--tx-3)]')}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? '#059669' : '#94a3b8' }} aria-hidden="true" />{on ? onLabel : offLabel}
    </span>
  );
}

async function api(url, method, body, t) {
  const res = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(b.error || t('al.errGeneric')), { code: b.code, report: b.report });
  return b;
}

/* One alert type: status, settings form (explicit Save), recipients, test send. */
function TypeCard({ type, data, canManage, emailMode, onChanged, onError }) {
  const { t, formatDateTime } = useLanguage();
  const saved = data.settings;
  const [form, setForm] = useState({ enabled: saved.enabled, auto_notify_enabled: saved.auto_notify_enabled, email_language: saved.email_language });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);     // { tone, text }
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmTest, setConfirmTest] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  useEffect(() => { setForm({ enabled: saved.enabled, auto_notify_enabled: saved.auto_notify_enabled, email_language: saved.email_language }); }, [saved.enabled, saved.auto_notify_enabled, saved.email_language]);
  const dirty = form.enabled !== saved.enabled || form.auto_notify_enabled !== saved.auto_notify_enabled || form.email_language !== saved.email_language;
  const enabledRecipients = data.recipients.filter(r => r.enabled);
  const live = saved.enabled && saved.auto_notify_enabled && enabledRecipients.length > 0;
  const title = t('alertType.' + type);
  const ids = { base: 'as-' + type };

  async function save() {
    setSaving(true); setSaveMsg(null);
    try { await api('/api/alert-settings', 'PUT', { alert_type: type, ...form }, t); setSaveMsg({ tone: 'ok', text: t('as.saved') }); onChanged(); }
    catch (e) { setSaveMsg({ tone: 'err', text: e.message }); }
    finally { setSaving(false); }
  }
  async function addRecipient(e) {
    e.preventDefault();
    const value = normalizeEmail(email);
    if (!isValidEmail(value)) { setFormErr(t('al.errInvalidEmail')); return; }
    if (data.recipients.some(r => r.email === value)) { setFormErr(t('al.errDuplicate')); return; }
    setBusy(true); setFormErr('');
    try { await api('/api/alert-settings/recipients', 'POST', { email: value, alert_type: type }, t); setEmail(''); setAdding(false); onChanged(); }
    catch (err) { setFormErr(err.code === 'DUPLICATE' ? t('al.errDuplicate') : err.code === 'INVALID_EMAIL' ? t('al.errInvalidEmail') : err.message); }
    finally { setBusy(false); }
  }
  async function toggleRecipient(r) { try { await api('/api/alert-settings/recipients', 'PATCH', { id: r.id, enabled: !r.enabled }, t); onChanged(); } catch (err) { onError(err.message); } }
  async function removeRecipient(r) {
    if (!confirm(t('al.confirmRemove', { email: r.email }))) return;
    try { await api('/api/alert-settings/recipients?id=' + encodeURIComponent(r.id), 'DELETE', null, t); onChanged(); } catch (err) { onError(err.message); }
  }
  async function sendTest() {
    setConfirmTest(false); setTesting(true); setTestMsg(null);
    try {
      const b = await api('/api/alert-settings/test', 'POST', { alert_type: type }, t);
      const r = b.report;
      const text = (r.failed ? t('as.testPartial', { sent: r.sent, failed: r.failed }) : t('as.testSent', { n: r.sent })) + (r.mode !== 'live' ? ' ' + t('as.testMockNote') : '') + (r.usedSample ? ' ' + t('as.testSampleNote') : '');
      setTestMsg({ tone: r.failed ? 'err' : 'ok', text });
      onChanged();
    } catch (e) {
      setTestMsg({ tone: 'err', text: e.code === 'COOLDOWN' ? t('as.testCooldown') : e.code === 'NO_RECIPIENTS' ? t('as.testNoRecipients') : e.message });
    } finally { setTesting(false); }
  }

  const Msg = ({ m }) => m ? <div role="status" className={'text-xs mt-2 ' + (m.tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400')}>{m.text}</div> : null;

  return (
    <section className="glass-card glass-card--pad space-y-5" aria-labelledby={ids.base + '-title'} data-testid={'type-' + type}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 id={ids.base + '-title'} className="font-semibold text-[15px]">{title}</h3>
          <p className="text-xs text-[color:var(--tx-3)] mt-0.5">{t('as.typeSub.' + type)}</p>
        </div>
        <StatePill on={live} onLabel={t('as.notifying')} offLabel={t('as.notNotifying')} />
      </div>
      {!live && saved.enabled && saved.auto_notify_enabled && enabledRecipients.length === 0 && <div className="text-xs text-amber-700 dark:text-amber-300">{t('as.whyNoRecipients')}</div>}

      {/* settings */}
      <div className="space-y-3">
        <Switch label={t('as.enabledLabel')} hint={t('as.enabledHint')} on={form.enabled} disabled={!canManage || saving} onChange={v => setForm(f => ({ ...f, enabled: v }))} />
        <Switch label={t('as.autoLabel')} hint={t('as.autoHint')} on={form.auto_notify_enabled} disabled={!canManage || saving || !form.enabled} onChange={v => setForm(f => ({ ...f, auto_notify_enabled: v }))} />
        <fieldset>
          <legend className="text-[11px] font-medium text-[color:var(--tx-3)] mb-1.5">{t('al.emailLanguage')}</legend>
          <div className="flex gap-2 flex-wrap">
            {LANGS.map(l => (
              <label key={l} className={'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[color:var(--pr)] ' + (form.email_language === l ? 'border-[color:var(--pr)] bg-[color:var(--pr-soft)]' : 'border-[color:var(--bd)]') + (!canManage ? ' opacity-60 cursor-not-allowed' : '')}>
                <input type="radio" name={ids.base + '-lang'} value={l} checked={form.email_language === l} disabled={!canManage || saving} onChange={() => setForm(f => ({ ...f, email_language: l }))} className="sr-only" />
                <span className={'h-3 w-3 rounded-full border-2 shrink-0 ' + (form.email_language === l ? 'border-[color:var(--pr)] bg-[color:var(--pr)]' : 'border-[color:var(--bd-2)]')} aria-hidden="true" />
                {t('al.lang.' + l)}
              </label>
            ))}
          </div>
        </fieldset>
        {canManage && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={save} disabled={!dirty || saving} loading={saving}>{t('as.save')}</Button>
            {dirty && !saving && <span className="text-xs text-[color:var(--tx-4)]">{t('as.unsaved')}</span>}
            <Msg m={saveMsg} />
          </div>
        )}
      </div>

      {/* recipients */}
      <div className="border-t border-[color:var(--bd)] pt-4" data-testid={'recipients-' + type}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-sm font-semibold">{t('al.settings.recipients')} <span className="text-xs font-normal text-[color:var(--tx-3)]">({enabledRecipients.length}/{data.recipients.length} {t('al.enabled').toLowerCase()})</span></div>
        </div>
        {data.recipients.length === 0 ? (
          <div className="text-sm text-[color:var(--tx-3)] py-2">{t('al.noRecipients')}</div>
        ) : (
          <ul className="divide-y divide-[color:var(--bd)]">
            {data.recipients.map(r => (
              <li key={r.id} className="py-2 flex items-center gap-3 flex-wrap">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.enabled ? '#059669' : '#94a3b8' }} aria-hidden="true" />
                <span className={'min-w-0 flex-1 text-sm font-medium break-all ' + (r.enabled ? '' : 'text-[color:var(--tx-3)] line-through')} dir="ltr">{r.email}</span>
                <span className={'text-[11px] px-2 py-0.5 rounded-full font-medium ' + (r.enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/10 text-[color:var(--tx-3)]')}>{r.enabled ? t('al.enabled') : t('al.disabled')}</span>
                {canManage && (
                  <span className="flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => toggleRecipient(r)} aria-label={(r.enabled ? t('al.disable') : t('al.enable')) + ' ' + r.email}>{r.enabled ? t('al.disable') : t('al.enable')}</Button>
                    <Button variant="danger" size="sm" onClick={() => removeRecipient(r)} aria-label={t('al.remove') + ' ' + r.email}>{t('al.remove')}</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (adding ? (
          <form onSubmit={addRecipient} className="space-y-2 mt-3" noValidate>
            <div className="flex gap-2 flex-wrap">
              <Input type="email" dir="ltr" autoFocus value={email} placeholder={t('al.emailPlaceholder')} aria-label={t('al.settings.recipients') + ' — ' + title} aria-invalid={formErr ? 'true' : undefined}
                onChange={e => { setEmail(e.target.value); setFormErr(''); }} className="flex-1 min-w-[200px]" />
              <Button type="submit" disabled={busy} loading={busy}>{t('al.add')}</Button>
              <Button type="button" variant="ghost" onClick={() => { setAdding(false); setEmail(''); setFormErr(''); }}>{t('al.cancel')}</Button>
            </div>
            {formErr && <div role="alert" className="text-xs text-red-600 dark:text-red-400">{formErr}</div>}
          </form>
        ) : <div className="mt-3"><Button variant="secondary" size="sm" onClick={() => setAdding(true)}>{t('al.addEmail')}</Button></div>)}
      </div>

      {/* test send */}
      {canManage && (
        <div className="border-t border-[color:var(--bd)] pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="secondary" onClick={() => setConfirmTest(true)} disabled={testing || enabledRecipients.length === 0} loading={testing}>{t('as.sendTest')}</Button>
            <span className="text-xs text-[color:var(--tx-4)]">{enabledRecipients.length === 0 ? t('as.testNoRecipients') : t('as.testHelp', { n: enabledRecipients.length })}</span>
          </div>
          <Msg m={testMsg} />
          {data.lastTest && <div className="text-[11px] text-[color:var(--tx-4)] mt-2">{t('as.lastTest')}: {formatDateTime(data.lastTest.created_at)} · {t('as.testStatus.' + data.lastTest.status)}</div>}
          {confirmTest && (
            <Modal title={t('as.sendTest') + ' — ' + title} onClose={() => setConfirmTest(false)}
              footer={<><Button variant="ghost" onClick={() => setConfirmTest(false)}>{t('al.cancel')}</Button><Button onClick={sendTest}>{t('as.confirmSend')}</Button></>}>
              <p className="text-sm">{t('as.testConfirmBody', { n: enabledRecipients.length })}</p>
              <ul className="mt-3 text-sm space-y-1" dir="ltr">{enabledRecipients.map(r => <li key={r.id} className="font-medium">{r.email}</li>)}</ul>
              {emailMode !== 'live' && <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">{t('as.testMockNote')}</p>}
            </Modal>
          )}
        </div>
      )}
    </section>
  );
}

function ScheduleCard({ schedule, emailMode, lastRun, t, formatDateTime, migrationPending, canManage }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  async function runPreview() {
    setBusy(true); setPreview(null);
    try { const b = await api('/api/cron/expiry-alerts', 'POST', { dryRun: true }, t); setPreview(b.report); }
    catch (err) { setPreview({ error: err.message }); }
    finally { setBusy(false); }
  }
  const row = (label, value, tone) => (
    <div className="min-w-0">
      <dt className="text-[11px] text-[color:var(--tx-4)]">{label}</dt>
      <dd className={'text-sm font-medium ' + (tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : '')}>{value}</dd>
    </div>
  );
  return (
    <section className="glass-card glass-card--pad" aria-labelledby="as-run-title" data-testid="daily-run">
      <h3 id="as-run-title" className="font-semibold text-[15px]">{t('as.runTitle')}</h3>
      <p className="text-xs text-[color:var(--tx-3)] mt-0.5 mb-4">{t('as.runSub', { time: schedule.localTime, tz: schedule.timezone })}</p>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
        {row(t('as.nextRun'), formatDateTime(schedule.nextRunAt))}
        {row(t('as.mode'), emailMode === 'live' ? t('as.modeLive') : t('as.modeMock'), emailMode === 'live' ? null : 'amber')}
        {row(t('as.cronSecret'), schedule.cronSecretConfigured ? t('as.configured') : t('as.notConfigured'), schedule.cronSecretConfigured ? null : 'amber')}
        {row(t('as.lastRun'), migrationPending ? t('fleet.emailUnavailable') : lastRun ? formatDateTime(lastRun.started_at) : t('as.noRunYet'))}
      </dl>
      {lastRun && (
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-[color:var(--bd)]">
          {row(t('as.runStatus'), t('as.runStatusVal.' + lastRun.status) + ' · ' + t('as.trigger.' + lastRun.trigger), lastRun.status === 'failed' ? 'red' : lastRun.status === 'partial' ? 'amber' : null)}
          {row(t('as.recipientsProcessed'), lastRun.recipients)}
          {row(t('as.notificationsSent'), lastRun.emails_sent)}
          {row(t('as.failures'), lastRun.emails_failed, lastRun.emails_failed ? 'red' : null)}
          {row(t('as.activeAlertsAtRun'), lastRun.active_alerts)}
        </dl>
      )}
      {lastRun?.error && <div className="text-xs text-red-600 dark:text-red-400 mt-2">{lastRun.error}</div>}
      {canManage && !migrationPending && (
        <div className="mt-4 pt-4 border-t border-[color:var(--bd)]">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="secondary" size="sm" onClick={runPreview} disabled={busy} loading={busy}>{t('al.dryRun')}</Button>
            <span className="text-xs text-[color:var(--tx-4)]">{t('al.dryRunHelp')}</span>
          </div>
          {preview && (
            <div className="mt-2 text-sm" role="status">
              {preview.error ? <span className="text-red-600 dark:text-red-400">{preview.error}</span>
                : preview.reasonsNotSent?.length ? t('al.dryRunNothing', { reason: preview.reasonsNotSent.map(r => t('al.reasonText.' + r)).join(', ') })
                : t('al.dryRunResult', { alerts: preview.activeAlerts, recipients: preview.recipients, emails: preview.plan.length })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Switch({ label, hint, on, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">
        {label}
        {hint && <span className="block text-[11px] text-[color:var(--tx-4)]">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
        className={'relative h-6 w-11 rounded-full transition-colors shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pr)] disabled:opacity-50 disabled:cursor-not-allowed ' + (on ? 'bg-[color:var(--pr)]' : 'bg-slate-400/50')}>
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
