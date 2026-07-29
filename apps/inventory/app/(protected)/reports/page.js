'use client';

import { useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassSelect } from '@/components/glass';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#06B6D4', '#22D3EE', '#0891B2', '#67E8F9', '#155E75', '#A5F3FC', '#0E7490', '#CFFAFE'];

export default function ReportsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('stock');
  const [warehouseId, setWarehouseId] = useState('');

  const { data: statsData } = useLiveData('/api/stats', 30000);
  const { data: wd } = useLiveData('/api/warehouses', 0);
  const { data: movData } = useLiveData(`/api/stock-movements?limit=200${warehouseId ? '&warehouse_id=' + warehouseId : ''}`, 30000);
  const { data: stockData } = useLiveData(`/api/stock?limit=200${warehouseId ? '&warehouse_id=' + warehouseId : ''}`, 30000);
  const { data: prData } = useLiveData('/api/purchase-requests?limit=200', 30000);
  const { data: poData } = useLiveData('/api/purchase-orders?limit=200', 30000);

  const warehouses = wd?.warehouses || [];
  const whOptions = [{ value: '', label: t('common.allWarehouses') }, ...warehouses.map(w => ({ value: w.id, label: w.name }))];

  const stockByWarehouse = statsData?.stockByWarehouse || [];
  const topProducts = statsData?.topProducts || [];
  const movements = movData?.movements || [];
  const stock = stockData?.stock || [];
  const requests = prData?.requests || [];
  const orders = poData?.orders || [];

  const lowStock = stock.filter(s => {
    const qty = Number(s.qty_on_hand || 0);
    const minQty = Number(s.inv_products?.min_stock_qty || s.inv_materials?.min_stock_qty || 0);
    return qty <= minQty && minQty > 0;
  });

  const outOfStock = stock.filter(s => Number(s.qty_on_hand || 0) <= 0);

  const totalStockValue = stock.reduce((sum, s) => sum + (Number(s.qty_on_hand || 0) * Number(s.avg_cost || 0)), 0);

  const movByType = movements.reduce((acc, m) => {
    acc[m.movement_type] = (acc[m.movement_type] || 0) + 1;
    return acc;
  }, {});
  const movChartData = Object.entries(movByType).map(([name, value]) => ({ name, value }));

  const poByStatus = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const tabs = [
    { key: 'stock', label: t('nav.stock') },
    { key: 'movements', label: t('nav.stockMovements') },
    { key: 'purchasing', label: t('nav.purchaseOrders') },
    { key: 'lowstock', label: t('reports.lowStock') },
  ];

  return (
    <Shell active="/reports">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 p-1 glass-card rounded-lg">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-[color:var(--pr)] text-white' : 'text-[color:var(--tx-3)] hover:text-[color:var(--tx)]'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="ms-auto">
          <GlassSelect value={warehouseId} onChange={setWarehouseId} options={whOptions} />
        </div>
      </div>

      {activeTab === 'stock' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold text-[color:var(--pr)]">SAR {totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('reports.totalStockValue')}</div>
            </div>
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold">{stock.length}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('reports.stockLines')}</div>
            </div>
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold text-amber-500">{lowStock.length}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('reports.lowStockItems')}</div>
            </div>
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold text-red-500">{outOfStock.length}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('reports.outOfStock')}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card glass-card--pad">
              <div className="text-sm font-semibold mb-4">{t('reports.stockByWarehouse')}</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stockByWarehouse}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--tx-3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--tx-3)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)' }} />
                  <Bar dataKey="value" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card glass-card--pad">
              <div className="text-sm font-semibold mb-4">{t('reports.topByValue')}</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={topProducts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[color:var(--bd)] text-sm font-semibold">{t('reports.stockValuation')}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                  <tr>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.warehouses')}</th>
                    <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.qtyOnHand')}</th>
                    <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.avgCost')}</th>
                    <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('reports.totalValue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--bd)]">
                  {stock.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
                  {stock.slice(0, 50).map(row => {
                    const name = row.inv_products?.name || row.inv_materials?.name || '—';
                    const qty = Number(row.qty_on_hand || 0);
                    const cost = Number(row.avg_cost || 0);
                    const val = qty * cost;
                    return (
                      <tr key={row.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                        <td className="px-4 py-3 font-medium">{name}</td>
                        <td className="px-4 py-3 text-[color:var(--tx-3)]">{row.inv_warehouses?.name || '—'}</td>
                        <td className="px-4 py-3 text-end">{qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-end">SAR {cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-end font-semibold">SAR {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="space-y-6">
          <div className="glass-card glass-card--pad">
            <div className="text-sm font-semibold mb-4">{t('reports.movementsByType')}</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={movChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {movChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--tx-3)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[color:var(--bd)] text-sm font-semibold">{t('reports.recentMovements')}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                  <tr>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.date')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.movementType')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.warehouses')}</th>
                    <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.qty')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.reference')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--bd)]">
                  {movements.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
                  {movements.slice(0, 100).map(m => {
                    const name = m.inv_products?.name || m.inv_materials?.name || '—';
                    const isOut = m.movement_type?.includes('out') || m.movement_type === 'issue';
                    return (
                      <tr key={m.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                        <td className="px-4 py-3 text-[color:var(--tx-3)]">{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 font-medium">{name}</td>
                        <td className="px-4 py-3 text-[color:var(--tx-3)]">{m.movement_type}</td>
                        <td className="px-4 py-3 text-[color:var(--tx-3)]">{m.inv_warehouses?.name || '—'}</td>
                        <td className={'px-4 py-3 text-end font-semibold ' + (isOut ? 'text-red-500' : 'text-emerald-500')}>
                          {isOut ? '−' : '+'}{Number(m.qty || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--tx-3)]">{m.reference || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'purchasing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold">{requests.length}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('nav.purchaseRequests')}</div>
            </div>
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold text-amber-500">{requests.filter(r => r.status === 'pending').length}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('reports.pendingPRs')}</div>
            </div>
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold">{orders.length}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('nav.purchaseOrders')}</div>
            </div>
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold text-[color:var(--pr)]">
                SAR {orders.reduce((s, o) => s + Number(o.total_amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('reports.totalPOValue')}</div>
            </div>
          </div>

          <div className="glass-card glass-card--pad">
            <div className="text-sm font-semibold mb-4">{t('reports.poByStatus')}</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.entries(poByStatus).map(([name, value]) => ({ name, value }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--tx-3)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--tx-3)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)' }} />
                <Bar dataKey="value" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[color:var(--bd)] text-sm font-semibold">{t('nav.purchaseOrders')}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                  <tr>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.number')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.suppliers')}</th>
                    <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.amount')}</th>
                    <th className="text-center px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.status')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--bd)]">
                  {orders.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
                  {orders.slice(0, 50).map(o => (
                    <tr key={o.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{o.po_number || o.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-medium">{o.inv_suppliers?.name || '—'}</td>
                      <td className="px-4 py-3 text-end font-semibold">SAR {Number(o.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center text-xs">{o.status}</td>
                      <td className="px-4 py-3 text-[color:var(--tx-3)]">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lowstock' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold text-amber-500">{lowStock.length}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('reports.lowStockItems')}</div>
            </div>
            <div className="glass-card glass-card--pad text-center">
              <div className="text-2xl font-bold text-red-500">{outOfStock.length}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('reports.outOfStock')}</div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[color:var(--bd)] text-sm font-semibold">{t('reports.lowStockReport')}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                  <tr>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.warehouses')}</th>
                    <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.qtyOnHand')}</th>
                    <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.minStock')}</th>
                    <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('reports.shortage')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--bd)]">
                  {lowStock.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('reports.noLowStock')}</td></tr>}
                  {lowStock.map(row => {
                    const name = row.inv_products?.name || row.inv_materials?.name || '—';
                    const qty = Number(row.qty_on_hand || 0);
                    const minQty = Number(row.inv_products?.min_stock_qty || row.inv_materials?.min_stock_qty || 0);
                    const shortage = Math.max(0, minQty - qty);
                    return (
                      <tr key={row.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                        <td className="px-4 py-3 font-medium">{name}</td>
                        <td className="px-4 py-3 text-[color:var(--tx-3)]">{row.inv_warehouses?.name || '—'}</td>
                        <td className={'px-4 py-3 text-end font-semibold ' + (qty <= 0 ? 'text-red-500' : 'text-amber-500')}>{qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-end text-[color:var(--tx-3)]">{minQty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-end text-red-500 font-semibold">{shortage.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
