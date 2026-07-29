'use client';

import { useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage, trEnum } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassSelect } from '@/components/glass';

const REFRESH_MS = 20000;

const MOVEMENT_TYPE_COLORS = {
  receipt: 'text-emerald-500',
  issue: 'text-red-500',
  transfer_in: 'text-blue-500',
  transfer_out: 'text-orange-500',
  adjustment_in: 'text-teal-500',
  adjustment_out: 'text-rose-500',
  return_in: 'text-green-500',
  return_out: 'text-amber-500',
};

export default function StockMovementsPage() {
  const { t } = useLanguage();
  const [type, setType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page, limit: 50 });
  if (type) params.set('movement_type', type);
  if (warehouseId) params.set('warehouse_id', warehouseId);
  const { data: md } = useLiveData(`/api/stock-movements?${params}`, REFRESH_MS);
  const { data: wd } = useLiveData('/api/warehouses', 0);

  const movements = md?.movements || [];
  const total = md?.total || 0;
  const warehouses = wd?.warehouses || [];

  const whOptions = [{ value: '', label: t('common.allWarehouses') }, ...warehouses.map(w => ({ value: w.id, label: w.name }))];
  const typeOptions = [
    { value: '', label: t('common.allTypes') },
    ...['receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out']
      .map(v => ({ value: v, label: trEnum(t, 'movementType', v) })),
  ];

  return (
    <Shell active="/stock-movements">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <GlassSelect value={type} onChange={v => { setType(v); setPage(1); }} options={typeOptions} />
        <GlassSelect value={warehouseId} onChange={v => { setWarehouseId(v); setPage(1); }} options={whOptions} />
        <div className="ms-auto text-sm text-[color:var(--tx-3)]">{t('common.total')}: {total}</div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.date')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.movementType')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.warehouses')}</th>
                <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.qty')}</th>
                <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.unitCost')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.reference')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.createdBy')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--bd)]">
              {movements.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
              {movements.map(m => {
                const name = m.inv_products?.name || m.inv_materials?.name || '—';
                const isOut = m.movement_type?.includes('out') || m.movement_type === 'issue';
                return (
                  <tr key={m.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                    <td className="px-4 py-3 text-[color:var(--tx-3)] whitespace-nowrap">{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className={'px-4 py-3 font-medium ' + (MOVEMENT_TYPE_COLORS[m.movement_type] || '')}>
                      {trEnum(t, 'movementType', m.movement_type)}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{m.inv_warehouses?.name || '—'}</td>
                    <td className={'px-4 py-3 text-end font-semibold ' + (isOut ? 'text-red-500' : 'text-emerald-500')}>
                      {isOut ? '−' : '+'}{Number(m.qty || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-end">SAR {Number(m.unit_cost || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{m.reference || '—'}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{m.platform_users?.full_name || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[color:var(--bd)] text-sm text-[color:var(--tx-3)]">
            <span>{t('common.showing', { from: (page - 1) * 50 + 1, to: Math.min(page * 50, total), total })}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="gbtn gbtn-ghost gbtn--sm">{t('common.prev')}</button>
              <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="gbtn gbtn-ghost gbtn--sm">{t('common.next')}</button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
