'use client';

/* The six-tab cost-model editor (Materials | Hardware | Labour |
   Machines | Expenses | Other) with a live cost summary. Pure display/
   edit component — parent owns `lines` and `params` state and saving.
   Masters are snapshotted into lines on pick (BR-4); editing a line
   never touches master data. Totals come from lib/costing — the same
   engine the server re-runs on save. */

import { useMemo } from 'react';
import { useLanguage } from '@/lib/i18n';
import { costLineTotal, productCostSummary } from '@/lib/costing';
import ItemPicker from '@/components/ItemPicker';
import { Button, Input, Select } from '@/components/ui';

const SECTIONS = ['material', 'hardware', 'labour', 'machine', 'expense', 'other'];

function labourRateFor(extra, unit) {
  const r = (extra && extra.rates) || {};
  if (unit === 'hour') return Number(r.hourly) || 0;
  if (unit === 'month') return Number(r.monthly) || 0;
  return Number(r.daily) || 0;
}

export function lineFromMaster(section, r) {
  if (section === 'material' || section === 'hardware') {
    return {
      section, source_id: r.id, name: r.name,
      spec_text: [r.thickness, r.size_text].filter(Boolean).join(' × '),
      unit: r.unit, qty: 1, unit_cost: Number(r.latest_price) || 0,
      waste_pct: Number(r.default_waste_pct) || 0, extra: {},
    };
  }
  if (section === 'labour') {
    const extra = { rates: { hourly: r.hourly_rate, daily: r.daily_rate, monthly: r.monthly_rate } };
    const unit = r.default_unit || 'day';
    return {
      section, source_id: r.id, name: r.name,
      spec_text: null, unit, qty: 1, unit_cost: labourRateFor(extra, unit), waste_pct: 0, extra,
    };
  }
  if (section === 'machine') {
    return {
      section, source_id: r.id, name: r.name,
      spec_text: r.category || null, unit: 'hour', qty: 1,
      unit_cost: Number(r.hourly_cost) || 0, waste_pct: 0,
      extra: { setup_cost: Number(r.setup_cost) || 0 },
    };
  }
  if (section === 'expense') {
    const pct = r.unit === 'pct_production';
    return {
      section, source_id: r.id, name: r.name,
      spec_text: null, unit: r.unit, qty: 1,
      unit_cost: pct ? 0 : (Number(r.default_amount) || 0), waste_pct: 0,
      extra: pct ? { pct_of_production: Number(r.default_amount) || 0 } : {},
    };
  }
  return { section: 'other', source_id: null, name: '', spec_text: null, unit: null, qty: 1, unit_cost: 0, waste_pct: 0, extra: {} };
}

const BASIS_OPTIONS = ['auto', 'fixed', 'area', 'perimeter', 'length', 'volume'];
const SCALABLE_SECTIONS = ['material', 'hardware', 'labour', 'machine'];

export default function CostModelEditor({ lines, setLines, params, setParams, tab, setTab, markManual }) {
  const { t, tr, trL, lang, formatNumber } = useLanguage();

  const summary = useMemo(() => productCostSummary(lines, { ...params, qty: 1 }), [lines, params]);
  const sectionLines = lines.map((l, i) => ({ ...l, _i: i })).filter(l => l.section === tab);

  function patchLine(i, patch) {
    setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  }
  function removeLine(i) {
    setLines(prev => prev.filter((_, j) => j !== i));
  }
  function addLine(section, master) {
    setLines(prev => [...prev, master ? lineFromMaster(section, master) : lineFromMaster('other')]);
  }

  function money(n) { return formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  const name = (l) => trL(l, 'name');

  const sectionTotal = sectionLines.reduce((s, l) =>
    s + ((l.section === 'expense' && l.extra && l.extra.pct_of_production) ? costLineTotal(l, summary.productionCost) : costLineTotal(l)), 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr,340px] gap-4 items-start">
      {/* ── Left: tabs + section table ── */}
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap border-b border-[#E5E2DD] dark:border-white/[0.08]">
          {SECTIONS.map(s => {
            const n = lines.filter(l => l.section === s).length;
            return (
              <button key={s} type="button" onClick={() => setTab(s)}
                className={'px-3.5 py-2.5 text-sm transition-colors ' +
                  (tab === s ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-300 font-medium' : 'text-[#8C8A80] hover:text-inherit')}>
                {t('sec.' + s)}{n > 0 && <span className="ms-1.5 text-[10px] rounded-full bg-brand-600/15 px-1.5 py-0.5">{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="p-3 flex items-center gap-3">
          {tab === 'other' ? (
            <Button variant="ghost" onClick={() => addLine('other')}>+ {t('cost.addLine')}</Button>
          ) : (
            <ItemPicker section={tab} onPick={r => addLine(tab, r)} />
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[#8C8A80]">
                <th className="text-start px-3 py-1.5">{t('f.name')}</th>
                <th className="text-start px-2 py-1.5">{t('f.unit')}</th>
                <th className="text-start px-2 py-1.5 w-24">{t('cost.qty')}</th>
                <th className="text-start px-2 py-1.5 w-28">{t('cost.unitCost')}</th>
                {(tab === 'material' || tab === 'hardware') && <th className="text-start px-2 py-1.5 w-20">{t('f.wastePct')}</th>}
                {tab === 'machine' && <th className="text-start px-2 py-1.5 w-28">{t('f.setupCost')}</th>}
                {tab === 'expense' && <th className="text-start px-2 py-1.5 w-24">{t('cost.pctOfProduction')}</th>}
                <th className="text-end px-3 py-1.5 w-28">{t('cost.lineTotal')}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {sectionLines.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-[#8C8A80]">{t('cost.emptySection')}</td></tr>
              ) : sectionLines.map(l => (
                <tr key={l._i} className="border-t border-[#E5E2DD]/70 dark:border-white/[0.06] align-top">
                  <td className="px-3 py-2">
                    {l.section === 'other' || !l.source_id ? (
                      <Input value={l.name || ''} placeholder={t('f.name')}
                        onChange={e => patchLine(l._i, { name: e.target.value })} />
                    ) : (
                      <>
                        <div className="font-medium">{name(l)}</div>
                        {l.spec_text && <div className="text-[11px] text-[#8C8A80]" dir="ltr">{l.spec_text}</div>}
                      </>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {l.section === 'labour' ? (
                      <Select value={l.unit || 'day'} className="w-24"
                        onChange={e => {
                          const unit = e.target.value;
                          patchLine(l._i, { unit, unit_cost: labourRateFor(l.extra, unit) || l.unit_cost });
                        }}
                        options={['hour', 'day', 'month'].map(u => ({ value: u, label: t('unit.' + u) }))} />
                    ) : (
                      <span className="text-[#8C8A80]">{l.section === 'expense' ? t('expunit.' + (l.unit || 'fixed')) : (l.unit || '—')}</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" step="0.001" value={l.qty}
                      onChange={e => patchLine(l._i, markManual
                        ? { qty: e.target.value, extra: { ...(l.extra || {}), manual: true } }
                        : { qty: e.target.value })} className="w-24" />
                    {l.extra && l.extra.manual && (
                      <button type="button" title={t('cost.manualHint')}
                        onClick={() => patchLine(l._i, { extra: { ...(l.extra || {}), manual: false } })}
                        className="mt-0.5 block text-[10px] px-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:line-through">
                        {t('cost.manual')} ✕
                      </button>
                    )}
                    {SCALABLE_SECTIONS.includes(l.section) && (
                      <select
                        value={(l.extra && l.extra.scale_basis) || (l.section === 'hardware' ? 'fixed' : 'auto')}
                        onChange={e => patchLine(l._i, { extra: { ...(l.extra || {}), scale_basis: e.target.value } })}
                        title={t('cost.scaleBasisHint')}
                        className="mt-0.5 block w-24 text-[10px] bg-transparent text-[#8C8A80] border border-[#E5E2DD] dark:border-white/[0.1] rounded px-1 py-0.5">
                        {BASIS_OPTIONS.map(b => <option key={b} value={b}>{t('basis.' + b)}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {(l.section === 'expense' && l.extra && l.extra.pct_of_production) ? (
                      <span className="text-[#8C8A80]">—</span>
                    ) : (
                      <Input type="number" step="0.01" value={l.unit_cost}
                        onChange={e => patchLine(l._i, { unit_cost: e.target.value })} className="w-28" />
                    )}
                  </td>
                  {(tab === 'material' || tab === 'hardware') && (
                    <td className="px-2 py-2">
                      <Input type="number" step="0.1" value={l.waste_pct}
                        onChange={e => patchLine(l._i, { waste_pct: e.target.value })} className="w-20" />
                    </td>
                  )}
                  {tab === 'machine' && (
                    <td className="px-2 py-2">
                      <Input type="number" step="0.01" value={(l.extra && l.extra.setup_cost) || 0}
                        onChange={e => patchLine(l._i, { extra: { ...l.extra, setup_cost: Number(e.target.value) || 0 } })} className="w-28" />
                    </td>
                  )}
                  {tab === 'expense' && (
                    <td className="px-2 py-2">
                      {l.extra && l.extra.pct_of_production !== undefined ? (
                        <Input type="number" step="0.1" value={l.extra.pct_of_production}
                          onChange={e => patchLine(l._i, { extra: { ...l.extra, pct_of_production: Number(e.target.value) || 0 } })} className="w-24" />
                      ) : <span className="text-[#8C8A80]">—</span>}
                    </td>
                  )}
                  <td className="px-3 py-2 text-end font-medium whitespace-nowrap">
                    {money((l.section === 'expense' && l.extra && l.extra.pct_of_production) ? costLineTotal(l, summary.productionCost) : costLineTotal(l))}
                  </td>
                  <td className="px-1 py-2">
                    <button type="button" onClick={() => removeLine(l._i)} className="text-[#BC6B4E] hover:opacity-70">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {sectionLines.length > 0 && (
              <tfoot><tr className="border-t border-[#E5E2DD] dark:border-white/[0.08]">
                <td colSpan={7} className="px-3 py-2 text-end text-[12px] text-[#8C8A80]">{t('sec.' + tab)} — {t('cost.sectionTotal')}</td>
                <td className="px-3 py-2 text-end font-semibold">{money(sectionTotal)}</td><td />
              </tr></tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Right: cost summary (sticky) ── */}
      <div className="glass-card p-4 xl:sticky xl:top-20 space-y-3">
        <div className="font-semibold text-sm">{t('cost.summary')}</div>

        <Row label={t('cost.productionCost')} value={money(summary.productionCost)} />
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-[#8C8A80]">{t('cost.overhead')}</span>
          <span className="flex items-center gap-2">
            <Input type="number" step="0.1" value={params.overheadPct}
              onChange={e => setParams(p => ({ ...p, overheadPct: e.target.value }))} className="w-16 !py-1 text-end" />%
            <span className="w-24 text-end">{money(summary.overheadAmount)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-[#8C8A80]">{t('cost.risk')}</span>
          <span className="flex items-center gap-2">
            <Input type="number" step="0.1" value={params.riskPct}
              onChange={e => setParams(p => ({ ...p, riskPct: e.target.value }))} className="w-16 !py-1 text-end" />%
            <span className="w-24 text-end">{money(summary.riskAmount)}</span>
          </span>
        </div>
        <Row label={t('cost.totalCost')} value={money(summary.totalCost)} strong />

        <div className="border-t border-[#E5E2DD] dark:border-white/[0.08] pt-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[#8C8A80]">{t('cost.profit')}</span>
            <span className="flex items-center gap-2">
              <Select value={params.profitMode}
                onChange={e => setParams(p => ({ ...p, profitMode: e.target.value }))} className="w-28 !py-1"
                options={[
                  { value: 'pct', label: t('cost.mode.pct') },
                  { value: 'fixed', label: t('cost.mode.fixed') },
                  { value: 'selling', label: t('cost.mode.selling') },
                ]} />
              {params.profitMode === 'selling' ? (
                <Input type="number" step="0.01" value={params.sellingPrice}
                  onChange={e => setParams(p => ({ ...p, sellingPrice: e.target.value }))} className="w-24 !py-1 text-end" />
              ) : (
                <Input type="number" step="0.1" value={params.profitValue}
                  onChange={e => setParams(p => ({ ...p, profitValue: e.target.value }))} className="w-24 !py-1 text-end" />
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[#8C8A80]">{t('cost.rounding')}</span>
            <Select value={params.rounding}
              onChange={e => setParams(p => ({ ...p, rounding: e.target.value }))} className="w-28 !py-1"
              options={[{ value: 0, label: '—' }, { value: 1, label: '1 ' + t('common.currencyUnit') }, { value: 5, label: '5 ' + t('common.currencyUnit') }, { value: 10, label: '10 ' + t('common.currencyUnit') }]} />
          </div>
        </div>

        <div className="rounded-xl bg-brand-600/10 border border-brand-600/25 p-3 space-y-1">
          <Row label={t('cost.sellingPrice')} value={money(summary.unitPrice) + ' ' + t('common.currencyUnit')} big />
          <div className="flex justify-between text-[12px] text-[#8C8A80]">
            <span>{t('cost.profitAmount')}: {money(summary.profitAmount)}</span>
            <span className={Number(summary.marginPct) < 15 ? 'text-[#BC6B4E] font-medium' : ''}>
              {t('cost.margin')}: {formatNumber(summary.marginPct)}%
            </span>
          </div>
          {Number(summary.marginPct) < 15 && summary.totalCost > 0 && (
            <div className="text-[11px] text-[#BC6B4E]">{t('cost.lowMarginWarning')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, big }) {
  return (
    <div className={'flex items-center justify-between text-sm ' + (big ? 'text-base font-semibold' : '')}>
      <span className={strong ? 'font-medium' : 'text-[#8C8A80]'}>{label}</span>
      <span className={strong ? 'font-semibold' : ''} dir="ltr">{value}</span>
    </div>
  );
}
