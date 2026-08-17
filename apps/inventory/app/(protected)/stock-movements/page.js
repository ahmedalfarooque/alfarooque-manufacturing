'use client';

import { useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage, trEnum } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { useAllPages } from '@/lib/useAllPages';
import { GlassSelect, GlassButton } from '@/components/glass';
import DateFilter, { inDateFilter } from '@/components/DateFilter';
import Pagination from '@/components/Pagination';

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
  const { t, lang } = useLanguage();
  const [type, setType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reportBusy, setReportBusy] = useState('');

  /* Full dataset under the active type/warehouse filters — date filtering,
     newest-first sort and pagination all happen client-side over this
     complete set (never just one server page), per the ERP-wide list
     page standardization. */
  const extraParams = {};
  if (type) extraParams.movement_type = type;
  if (warehouseId) extraParams.warehouse_id = warehouseId;
  const { rows: allMovements, mutate } = useAllPages('/api/stock-movements', extraParams, 'movements', { intervalMs: REFRESH_MS, pageLimit: 200 });
  const { data: wd } = useLiveData('/api/warehouses', 0);

  const filtered = useMemo(() => {
    const rows = allMovements.filter(m => inDateFilter(dateFilter, m.created_at));
    rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return rows;
  }, [allMovements, dateFilter]);

  const total = filtered.length;
  const movements = filtered.slice((page - 1) * pageSize, page * pageSize);
  const warehouses = wd?.warehouses || [];

  function resetPage() { setPage(1); }

  const whOptions = [{ value: '', label: t('common.allWarehouses') }, ...warehouses.map(w => ({ value: w.id, label: w.name }))];
  const typeOptions = [
    { value: '', label: t('common.allTypes') },
    ...['receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out']
      .map(v => ({ value: v, label: trEnum(t, 'movementType', v) })),
  ];

  const reportColumns = [
    { key: 'date', header: t('common.date') }, { key: 'name', header: t('common.name') },
    { key: 'type', header: t('stock.movementType') }, { key: 'warehouse', header: t('nav.warehouses') },
    { key: 'qty', header: t('common.qty') }, { key: 'unitCost', header: t('stock.unitCost') },
    { key: 'reference', header: t('common.reference') },
  ];
  function toReportRow(m) {
    const isOut = m.movement_type?.includes('out') || m.movement_type === 'issue';
    return {
      date: m.created_at ? new Date(m.created_at).toLocaleDateString() : '—',
      name: m.inv_products?.name || m.inv_materials?.name || '—',
      type: trEnum(t, 'movementType', m.movement_type), warehouse: m.inv_warehouses?.name || '—',
      qty: (isOut ? '-' : '+') + Number(m.qty || 0).toLocaleString(), unitCost: 'SAR ' + Number(m.unit_cost || 0).toFixed(2),
      reference: m.reference || '—',
    };
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const rows = filtered.map(toReportRow);
      if (action === 'excel') {
        const res = await fetch('/api/export/xlsx', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ sheetName: t('nav.stockMovements') || 'Stock Movements', columns: reportColumns, rows, filename: 'stock-movements-report.xlsx' }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not generate Excel export.'); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'stock-movements-report.xlsx'; a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({ title: t('nav.stockMovements') || 'Stock Movements', columns: reportColumns, rows, lang, fileName: 'stock-movements-report.pdf', action });
    } catch (e) {} finally { setReportBusy(''); }
  }

  return (
    <Shell active="/stock-movements">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <GlassSelect value={type} onChange={e => { setType(e.target.value); resetPage(); }} options={typeOptions} />
        <GlassSelect value={warehouseId} onChange={e => { setWarehouseId(e.target.value); resetPage(); }} options={whOptions} />
        <DateFilter value={dateFilter} onChange={v => { setDateFilter(v); resetPage(); }} t={t} lang={lang} />
        <div className="flex items-center gap-2 ms-auto">
          <span className="text-sm text-[color:var(--tx-3)]">{t('common.total')}: {total}</span>
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!movements.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('materials.print')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!movements.length || !!reportBusy}>{reportBusy === 'save' ? '…' : t('materials.downloadPdf')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('excel')} disabled={!movements.length || !!reportBusy}>{reportBusy === 'excel' ? '…' : 'Download Excel'}</GlassButton>
        </div>
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
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} t={t} />
      </div>
    </Shell>
  );
}
