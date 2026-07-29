'use client';

import { useState, useEffect } from 'react';
import Shell from '@/components/Shell';
import StatCard from '@/components/StatCard';
import { GlassIcon } from '@/components/GlassIcons';
import { CHART_COLORS, chartTheme } from '@/components/glass';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage, trEnum } from '@/lib/i18n';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const REFRESH_MS = 20000;

export default function DashboardPage() {
  const { t } = useLanguage();
  const { data: stats, error } = useLiveData('/api/stats', REFRESH_MS);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  const ct = chartTheme(dark);

  if (error) return <Shell active="/dashboard"><div className="text-red-500">{error}</div></Shell>;
  if (!stats) return <Shell active="/dashboard"><div className="text-[color:var(--tx-3)]">{t('dash.loadingDashboard')}</div></Shell>;

  const warehouseData = (stats.stockByWarehouse || []).map(w => ({ name: w.name, qty: Number(w.qty) }));
  const topProductsData = (stats.topProducts || []).map(p => ({ name: p.name, value: Number(p.value) }));

  return (
    <Shell active="/dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 gfade-up">
        <a href="/products" className="glass-card glass-card--pad flex items-center gap-3 hover:bg-[color:var(--pr-soft)] transition-colors duration-200">
          <span className="icon-tile icon-tile--sm shrink-0"><GlassIcon name="package" size={20} bare /></span>
          <span className="text-sm font-medium truncate">{t('products.addProduct')}</span>
        </a>
        <a href="/materials" className="glass-card glass-card--pad flex items-center gap-3 hover:bg-[color:var(--pr-soft)] transition-colors duration-200">
          <span className="icon-tile icon-tile--sm shrink-0"><GlassIcon name="layers" size={20} bare /></span>
          <span className="text-sm font-medium truncate">{t('materials.addMaterial')}</span>
        </a>
        <a href="/purchase-requests" className="glass-card glass-card--pad flex items-center gap-3 hover:bg-[color:var(--pr-soft)] transition-colors duration-200">
          <span className="icon-tile icon-tile--sm shrink-0"><GlassIcon name="clipboard" size={20} bare /></span>
          <span className="text-sm font-medium truncate">{t('pr.addRequest')}</span>
        </a>
        <a href="/goods-receipts" className="glass-card glass-card--pad flex items-center gap-3 hover:bg-[color:var(--pr-soft)] transition-colors duration-200">
          <span className="icon-tile icon-tile--sm shrink-0"><GlassIcon name="check-square" size={20} bare /></span>
          <span className="text-sm font-medium truncate">{t('gr.addReceipt')}</span>
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 gfade-up">
        <StatCard icon="package" tone="brand" label={t('dash.totalProducts')} value={fmt(stats.totalProducts)} sub={t('dash.activeProducts')} href="/products" />
        <StatCard icon="layers" tone="blue" label={t('dash.totalMaterials')} value={fmt(stats.totalMaterials)} sub={t('dash.activeMaterials')} href="/materials" />
        <StatCard icon="box" tone="emerald" label={t('dash.stockValue')} value={'SAR ' + fmtNum(stats.stockValue)} sub={t('dash.totalInventoryValue')} />
        <StatCard icon="bell" tone={stats.lowStockCount > 0 ? 'amber' : 'emerald'} label={t('dash.lowStock')} value={fmt(stats.lowStockCount)} sub={t('dash.itemsBelowMinimum')} href="/stock" />
        <StatCard icon="x" tone={stats.outOfStock > 0 ? 'red' : 'emerald'} label={t('dash.outOfStock')} value={fmt(stats.outOfStock)} sub={t('dash.zeroQtyItems')} href="/stock" />
        <StatCard icon="clipboard" tone="amber" label={t('dash.pendingPRs')} value={fmt(stats.pendingPRs)} sub={t('dash.awaitingApproval')} href="/purchase-requests" />
        <StatCard icon="file-text" tone="blue" label={t('dash.pendingPOs')} value={fmt(stats.pendingPOs)} sub={t('dash.openOrders')} href="/purchase-orders" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6 gfade-up">
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('dash.stockByWarehouse')}</h3>
          {warehouseData.length === 0 ? <EmptyNote text={t('dash.noWarehouseData')} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={warehouseData}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="name" stroke={ct.axis} tick={{ fontSize: 11, fill: ct.axis }} />
                <YAxis stroke={ct.axis} tick={{ fontSize: 10, fill: ct.axis }} />
                <Tooltip contentStyle={ct.tooltip} labelStyle={{ color: ct.axis }} itemStyle={{ color: ct.tooltip.color }} cursor={{ fill: ct.primarySoft }} />
                <Bar dataKey="qty" name={t('dash.quantity')} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('dash.topProductsByValue')}</h3>
          {topProductsData.length === 0 ? <EmptyNote text={t('dash.noProductData')} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={topProductsData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {topProductsData.map((d, i) => <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={ct.tooltip} labelStyle={{ color: ct.axis }} itemStyle={{ color: ct.tooltip.color }} cursor={{ fill: ct.primarySoft }} formatter={(v) => ['SAR ' + fmtNum(v)]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6 gfade-up">
        <div className="glass-card glass-card--pad">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">{t('dash.recentMovements')}</h3>
            <a href="/stock-movements" className="text-xs text-[color:var(--pr)] hover:underline">{t('common.viewAll')}</a>
          </div>
          {(!stats.recentMovements || stats.recentMovements.length === 0) ? <EmptyNote text={t('dash.noMovementsYet')} /> : (
            <ul className="divide-y divide-[color:var(--bd)]">
              {stats.recentMovements.map(m => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.inv_products?.name || m.inv_materials?.name || '—'}</div>
                    <div className="text-xs text-[color:var(--tx-3)]">{trEnum(t, 'movementType', m.movement_type)}</div>
                  </div>
                  <span className={'text-sm font-semibold shrink-0 ' + (m.movement_type?.includes('out') ? 'text-red-500' : 'text-emerald-500')}>
                    {m.movement_type?.includes('out') ? '−' : '+'}{fmt(m.qty)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card glass-card--pad">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">{t('dash.recentReceipts')}</h3>
            <a href="/goods-receipts" className="text-xs text-[color:var(--pr)] hover:underline">{t('common.viewAll')}</a>
          </div>
          {(!stats.recentReceipts || stats.recentReceipts.length === 0) ? <EmptyNote text={t('dash.noReceiptsYet')} /> : (
            <ul className="divide-y divide-[color:var(--bd)]">
              {stats.recentReceipts.map(r => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.inv_suppliers?.name || '—'}</div>
                    <div className="text-xs text-[color:var(--tx-3)]">{r.receipt_date}</div>
                  </div>
                  <span className="text-xs text-[color:var(--tx-3)] shrink-0">{r.gr_number || r.id.slice(0, 8)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {stats.lowStockItems && stats.lowStockItems.length > 0 && (
        <div className="glass-card glass-card--pad mb-6 gfade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm text-amber-500">{t('dash.lowStockAlert')}</h3>
            <a href="/stock" className="text-xs text-[color:var(--pr)] hover:underline">{t('common.viewAll')}</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-start text-[color:var(--tx-3)] text-xs">
                <tr>
                  <th className="py-1.5 text-start">{t('common.name')}</th>
                  <th className="text-start">{t('common.code')}</th>
                  <th className="text-end">{t('stock.qtyOnHand')}</th>
                  <th className="text-end">{t('stock.minQty')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStockItems.map(item => (
                  <tr key={item.id} className="border-t border-[color:var(--bd)]">
                    <td className="py-2">{item.name}</td>
                    <td className="text-[color:var(--tx-3)]">{item.sku || item.material_code || '—'}</td>
                    <td className="text-end font-semibold text-amber-500">{fmt(item.qty_on_hand)}</td>
                    <td className="text-end text-[color:var(--tx-3)]">{fmt(item.min_stock_qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}

function EmptyNote({ text }) { return <div className="text-sm text-[color:var(--tx-3)] py-6 text-center">{text}</div>; }
function fmt(n) { return Number(n || 0).toLocaleString(); }
function fmtNum(n) { return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
