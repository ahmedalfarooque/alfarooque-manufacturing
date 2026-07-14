'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import StatCard from '@/components/StatCard';
import { useLanguage, trEnum } from '@/lib/i18n';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#f59e0b', '#6366f1', '#3b82f6', '#ef4444', '#f97316', '#a855f7', '#06b6d4', '#94a3b8', '#eab308', '#0ea5e9', '#10b981'];

export const STATUS_BADGE = {
  Pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Under Review': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  Approved: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  'On Hold': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  Purchased: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Delivered: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  Cancelled: 'bg-slate-500/10 text-slate-500',
  'Payment Pending': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Payment Approved': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Payment Completed': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Ordered: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};
const PRIORITY_BADGE = {
  Normal: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  Urgent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const ALL_STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'On Hold', 'Purchased', 'Delivered', 'Cancelled', 'Payment Pending', 'Payment Approved', 'Payment Completed'];

const REFRESH_MS = 15000;

export default function PurchaseRequestsPage() {
  const { t, lang } = useLanguage();
  const [me, setMe] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  // Always starts at 'All' so server and client render identically (no hydration mismatch), then synced from ?status= right after mount.
  const [status, setStatus] = useState('All');
  const [priority, setPriority] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('status');
    if (fromUrl) setStatus(fromUrl);
  }, []);

  const isAdmin = me?.role === 'admin';
  const { data, error, refresh } = useLiveData('/api/purchase-requests', REFRESH_MS);
  const allRows = data?.purchaseRequests || [];

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return allRows.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      if (priority !== 'All' && r.priority !== priority) return false;
      if (!q) return true;
      return [r.material_description, r.project_name, r.customer_name, r.requested_by_name, r.supplier]
        .filter(Boolean).some(s => s.toLowerCase().includes(q));
    });
  }, [allRows, status, priority, debouncedSearch]);

  const { sorted: rows, sortKey, sortDir, toggleSort } = useSortableData(filtered);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const kpis = useMemo(() => {
    const c = {};
    ALL_STATUSES.forEach(s => { c[s] = 0; });
    allRows.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [allRows]);

  const charts = useMemo(() => {
    const now = new Date();
    const byMonth = Array(12).fill(0);
    allRows.forEach(r => {
      if (!r.created_at) return;
      const d = new Date(r.created_at);
      if (d.getFullYear() === now.getFullYear()) byMonth[d.getMonth()]++;
    });
    const bySupplier = {}, byProject = {}, byStatus = {};
    allRows.forEach(r => {
      bySupplier[r.supplier || 'Unspecified'] = (bySupplier[r.supplier || 'Unspecified'] || 0) + 1;
      byProject[r.project_name || 'Unassigned'] = (byProject[r.project_name || 'Unassigned'] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });
    const topN = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
    return {
      perMonth: MONTHS.map((m, i) => ({ month: m, count: byMonth[i] })),
      bySupplier: topN(bySupplier, 6),
      byProject: topN(byProject, 6),
      byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
    };
  }, [allRows]);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => { setPage(1); }, [debouncedSearch, status, priority]);

  async function deleteRequest(id) {
    if (!confirm(t('pr.deleteConfirm'))) return;
    const res = await fetch(`/api/purchase-requests/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) refresh();
  }

  function exportExcel() {
    const header = ['Date', 'Project', 'Customer', 'Materials', 'Priority', 'Requested By', 'Status'];
    const lines = [header.join(',')].concat(rows.map(r => [
      r.request_date, r.project_name, r.customer_name, `"${(r.material_description || '').replace(/"/g, '""')}"`,
      r.priority, r.requested_by_name, r.status,
    ].join(',')));
    /* Prepend a UTF-8 BOM so Excel opens Arabic data as Unicode instead
       of ANSI (which would show mojibake like "Ø§Ù„Ø®Ø´Ø¨"). */
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'purchase-requests.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  /* Standardized A4 report PDF — shared engine (lib/reportPdf.js).
     Exports exactly the same rows and columns as the Excel/CSV export
     above, so both formats always carry identical data. */
  async function exportPdf() {
    const ar = lang === 'ar';
    const { exportReportPdf } = await import('@/lib/reportPdf');
    await exportReportPdf({
      title: ar ? 'تقرير طلبات الشراء' : 'Purchase Requests Report',
      columns: [
        { key: 'request_date', header: ar ? 'التاريخ' : 'Date' },
        { key: 'project_name', header: ar ? 'المشروع' : 'Project' },
        { key: 'customer_name', header: ar ? 'العميل' : 'Customer' },
        { key: 'material_description', header: ar ? 'المواد' : 'Materials' },
        { key: 'priority', header: ar ? 'الأولوية' : 'Priority' },
        { key: 'requested_by_name', header: ar ? 'مقدم الطلب' : 'Requested By' },
        { key: 'status', header: ar ? 'الحالة' : 'Status' },
      ],
      rows,
      lang,
      fileName: 'purchase-requests-report.pdf',
    });
  }

  function printReport() { window.print(); }

  if (!isAdmin && me) return <Shell active="/purchase-requests"><div className="text-red-500 text-sm">{t('pr.adminOnly')}</div></Shell>;

  return (
    <Shell active="/purchase-requests">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('pr.title')}</h2>
          <p className="text-xs text-slate-500">{t('pr.breadcrumb')}</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <button onClick={exportExcel} className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white">⤓ {t('common.exportExcel')}</button>
          <button onClick={exportPdf} className="text-sm px-3 py-2 rounded-lg bg-red-600 text-white">⤓ {t('common.exportPdf')}</button>
          <button onClick={printReport} className="text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10">🖶 {t('common.print')}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        <StatCard icon="clock" tone="amber" label={t('pr.kpi.pending')} value={kpis.Pending} />
        <StatCard icon="search" tone="blue" label={t('pr.kpi.underReview')} value={kpis['Under Review']} />
        <StatCard icon="shield" tone="brand" label={t('pr.kpi.approved')} value={kpis.Approved} />
        <StatCard icon="x" tone="red" label={t('pr.kpi.rejected')} value={kpis.Rejected} />
        <StatCard icon="box" tone="slate" label={t('pr.kpi.purchased')} value={kpis.Purchased} />
        <StatCard icon="receipt" tone="amber" label={t('pr.kpi.paymentPending')} value={kpis['Payment Pending']} />
        <StatCard icon="target" tone="emerald" label={t('pr.kpi.paymentCompleted')} value={kpis['Payment Completed']} />
      </div>

      <div className="grid lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('pr.chart.requestsPerMonth')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={charts.perMonth}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6B7A4F" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('pr.chart.bySupplier')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={charts.bySupplier}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('pr.chart.byProject')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={charts.byProject}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('pr.chart.byStatus')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={charts.byStatus} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                {charts.byStatus.map((d, i) => <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder={t('pr.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={status} onChange={setStatus} options={['All', ...ALL_STATUSES].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
        <Dropdown value={priority} onChange={setPriority} options={['All', 'Normal', 'Urgent', 'Critical'].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">#</th>
              <th onClick={() => toggleSort('request_date')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('pr.col.date')}<SortIndicator column="request_date" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('project_name')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('pr.col.project')}<SortIndicator column="project_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th>{t('pr.col.materials')}</th>
              <th onClick={() => toggleSort('priority')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('pr.col.priority')}<SortIndicator column="priority" sortKey={sortKey} sortDir={sortDir} /></th>
              <th>{t('pr.col.requestedBy')}</th>
              <th onClick={() => toggleSort('status')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('common.status')}<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('pr.noMatch')}</td></tr>
            ) : pageRows.map((r, i) => (
              <tr key={r.id} onClick={() => { window.location.href = '/purchase-requests/' + r.id; }}
                className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-150">
                <td className="py-3 px-4">{(page - 1) * pageSize + i + 1}</td>
                <td>{r.request_date}</td>
                <td className="max-w-[160px] truncate">{r.project_name}</td>
                <td className="max-w-[220px] truncate">{r.material_description}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PRIORITY_BADGE[r.priority] || '')}>{trEnum(t, 'status', r.priority)}</span></td>
                <td>{r.requested_by_name || '—'}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span></td>
                <td className="text-right px-4 space-x-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <a href={'/purchase-requests/' + r.id} title={t('pr.viewDetails')} className="text-slate-400">{'\u{1F441}'}</a>
                  <a href={'/projects/' + r.project_id + '?tab=purchase-requests'} title={t('pr.openProject')} className="text-brand-500">↗</a>
                  <button onClick={() => deleteRequest(r.id)} title={t('common.delete')} className="text-red-500">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('common.showingEntries', { from: pageRows.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + pageRows.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('common.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">›</button>
        </div>
      </div>

    </Shell>
  );
}
