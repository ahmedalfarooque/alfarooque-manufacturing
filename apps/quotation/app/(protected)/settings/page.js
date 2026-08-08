'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { Button, Input, Field } from '@/components/ui';
import { GlassTabs } from '@/components/glass';

const TABS = ['entities', 'defaults', 'profit', 'approvals', 'numbering', 'system'];

export default function SettingsPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('entities');
  const [entities, setEntities] = useState([]);
  const [settings, setSettings] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setEntities(d.entities || []); setSettings(d.settings || {}); } })
      .catch(() => {});
  }, []);

  function patchEntity(i, patch) { setEntities(es => es.map((e, j) => j === i ? { ...e, ...patch } : e)); }
  function patchSetting(key, field, value) {
    setSettings(s => ({ ...s, [key]: { ...(s[key] || {}), [field]: value } }));
  }

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ entities, settings }),
    }).catch(() => null);
    setBusy(false);
    setMsg(res && res.ok ? t('settings.saved') : '⚠ ' + t('common.genericError'));
  }

  const num = (v) => v === '' || v === null || v === undefined ? '' : v;

  return (
    <Shell active="/settings">
      <div className="space-y-4">
        <div className="glass-card p-2 flex flex-wrap items-center gap-1">
          <GlassTabs tabs={TABS.map(s => ({ value: s, label: t('settings.' + s) }))} value={tab} onChange={setTab} />
          <div className="flex-1" />
          <Button disabled={busy} onClick={save}>{busy ? t('common.saving') : t('common.save')}</Button>
        </div>
        {msg && <div className="rounded-lg bg-brand-600/10 border border-brand-600/25 px-3 py-2 text-sm">{msg}</div>}

        {tab === 'entities' && entities.map((e, i) => (
          <div key={e.id} className="glass-card p-4">
            <div className="font-semibold text-sm mb-3">{e.code} — {e.name_en}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label={t('f.nameEn')}><Input value={num(e.name_en)} onChange={ev => patchEntity(i, { name_en: ev.target.value })} /></Field>
              <Field label={t('f.nameAr')}><Input dir="rtl" value={num(e.name_ar)} onChange={ev => patchEntity(i, { name_ar: ev.target.value })} /></Field>
              <Field label={t('f.phone')}><Input dir="ltr" value={num(e.phone)} onChange={ev => patchEntity(i, { phone: ev.target.value })} /></Field>
              <Field label={t('f.crNumber')}><Input dir="ltr" value={num(e.cr_number)} onChange={ev => patchEntity(i, { cr_number: ev.target.value })} /></Field>
              <Field label={t('f.vatNumber')}><Input dir="ltr" value={num(e.vat_number)} onChange={ev => patchEntity(i, { vat_number: ev.target.value })} /></Field>
              <Field label={t('settings.vatRate')}><Input type="number" step="0.1" dir="ltr" value={num(e.default_vat_rate)} onChange={ev => patchEntity(i, { default_vat_rate: ev.target.value })} /></Field>
              <Field label={t('settings.addressEn')}><Input value={num(e.address_en)} onChange={ev => patchEntity(i, { address_en: ev.target.value })} /></Field>
              <Field label={t('settings.addressAr')}><Input dir="rtl" value={num(e.address_ar)} onChange={ev => patchEntity(i, { address_ar: ev.target.value })} /></Field>
              <Field label={t('f.email')}><Input dir="ltr" value={num(e.email)} onChange={ev => patchEntity(i, { email: ev.target.value })} /></Field>
              <Field label={t('settings.website')}><Input dir="ltr" value={num(e.website)} onChange={ev => patchEntity(i, { website: ev.target.value })} /></Field>
              <Field label={t('settings.quotePrefix')}><Input dir="ltr" value={num(e.quote_prefix)} onChange={ev => patchEntity(i, { quote_prefix: ev.target.value })} /></Field>
              <Field label={t('settings.nextSeq')}><Input type="number" dir="ltr" value={num(e.next_seq)} onChange={ev => patchEntity(i, { next_seq: ev.target.value })} /></Field>
            </div>
          </div>
        ))}

        {tab === 'defaults' && (
          <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={t('settings.validityDays')}>
              <Input type="number" dir="ltr" value={num((settings.defaults || {}).validity_days)} onChange={e => patchSetting('defaults', 'validity_days', Number(e.target.value))} />
            </Field>
            <Field label={t('settings.vatRate')}>
              <Input type="number" step="0.1" dir="ltr" value={num((settings.defaults || {}).vat_rate)} onChange={e => patchSetting('defaults', 'vat_rate', Number(e.target.value))} />
            </Field>
            <Field label={t('settings.currency')}>
              <Input dir="ltr" value={num((settings.defaults || {}).currency) || 'SAR'} onChange={e => patchSetting('defaults', 'currency', e.target.value)} />
            </Field>
            <Field label={t('settings.autoTranslate')}>
              <label className="flex items-center gap-2 text-sm mt-2">
                <input type="checkbox" checked={(settings.translation || {}).auto !== false}
                  onChange={e => patchSetting('translation', 'auto', e.target.checked)} />
                {t('settings.autoTranslateHint')}
              </label>
            </Field>
          </div>
        )}

        {tab === 'profit' && (
          <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            {['overhead_pct', 'risk_pct', 'profit_pct', 'rounding'].map(k => (
              <Field key={k} label={t('settings.' + k)}>
                <Input type="number" step="0.1" dir="ltr" value={num((settings.profit_defaults || {})[k])}
                  onChange={e => patchSetting('profit_defaults', k, Number(e.target.value))} />
              </Field>
            ))}
          </div>
        )}

        {tab === 'approvals' && (
          <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={t('settings.approvalAmount')}>
              <Input type="number" dir="ltr" value={num((settings.approval_thresholds || {}).amount)}
                onChange={e => patchSetting('approval_thresholds', 'amount', Number(e.target.value))} />
            </Field>
            <Field label={t('settings.approvalMargin')}>
              <Input type="number" step="0.1" dir="ltr" value={num((settings.approval_thresholds || {}).min_margin_pct)}
                onChange={e => patchSetting('approval_thresholds', 'min_margin_pct', Number(e.target.value))} />
            </Field>
            <Field label={t('settings.approvalDiscount')}>
              <Input type="number" step="0.1" dir="ltr" value={num((settings.approval_thresholds || {}).max_discount_pct)}
                onChange={e => patchSetting('approval_thresholds', 'max_discount_pct', Number(e.target.value))} />
            </Field>
          </div>
        )}

        {tab === 'numbering' && (
          <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={t('settings.productPrefix')}>
              <Input dir="ltr" value={num((settings.numbering || {}).product_prefix) || 'P-'}
                onChange={e => patchSetting('numbering', 'product_prefix', e.target.value)} />
            </Field>
            <div className="md:col-span-3 text-[12px] text-[#7C9296]">{t('settings.numberingNote')}</div>
          </div>
        )}

        {tab === 'system' && (
          <div className="glass-card p-4 text-sm space-y-2">
            <div className="font-semibold">{t('settings.system')}</div>
            <p className="text-[#7C9296]">{t('settings.systemNote')}</p>
            <ul className="text-[13px] space-y-1 text-[#7C9296]">
              <li>• Email (Resend): <code>RESEND_API_KEY</code>, <code>EMAIL_FROM</code></li>
              <li>• Expiry cron secret: <code>CRON_SECRET</code></li>
              <li>• Database & storage: <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code></li>
              <li>• Sessions: <code>JWT_SECRET</code></li>
            </ul>
            <p className="text-[#7C9296]">{t('settings.backupNote')}</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
