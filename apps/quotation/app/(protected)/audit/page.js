'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { Select, Modal, EmptyState, Th, Td, Pagination } from '@/components/ui';
import { GlassIconButton } from '@/components/glass';

const TABLES = ['', 'qt_quotations', 'qt_quotation_products', 'qt_catalogue_products', 'qt_product_cost_lines',
  'qt_materials', 'customers', 'qt_suppliers', 'qt_labour_roles', 'qt_machines', 'qt_expense_templates',
  'qt_entities', 'qt_settings', 'qt_user_roles', 'project_requests'];
const ACTIONS = ['', 'insert', 'update', 'delete', 'status'];

export default function AuditPage() {
  const { t, formatDate } = useLanguage();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => {
    fetch(`/api/admin/audit?table=${table}&action=${action}&page=${page}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [], total: 0 })
      .then(d => { setRows(d.rows || []); setTotal(d.total || 0); })
      .catch(() => { setRows([]); setTotal(0); });
  }, [table, action, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [table, action]);

  return (
    <Shell active="/audit">
      <div className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Select value={table} onChange={e => setTable(e.target.value)} className="max-w-[240px]"
            options={TABLES.map(x => ({ value: x, label: x || t('common.all') }))} />
          <Select value={action} onChange={e => setAction(e.target.value)} className="max-w-[150px]"
            options={ACTIONS.map(x => ({ value: x, label: x || t('common.all') }))} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <Th>{t('f.date')}</Th><Th>{t('audit.table')}</Th><Th>{t('audit.action')}</Th>
              <Th>{t('audit.actor')}</Th><Th>{t('audit.record')}</Th><Th className="text-end">{t('common.actions')}</Th>
            </tr></thead>
            <tbody>
              {rows === null ? (
                <tr><Td colSpan={6} className="text-center text-[#7C9296]">{t('shell.loading')}</Td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6}><EmptyState text={t('common.noRecords')} /></td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-[#EEF3F4] dark:hover:bg-white/[0.03]">
                  <Td className="whitespace-nowrap text-[12px]">{formatDate(r.created_at, { dateStyle: 'short', timeStyle: 'medium' })}</Td>
                  <Td dir="ltr" className="text-[12px]">{r.table_name}</Td>
                  <Td><span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-600/10">{r.action}</span></Td>
                  <Td dir="ltr" className="text-[12px]">{r.actor_email || '—'}</Td>
                  <Td dir="ltr" className="text-[11px] text-[#7C9296]">{r.record_id ? String(r.record_id).slice(0, 8) : '—'}</Td>
                  <Td className="text-end">
                    <GlassIconButton tone="blue" label={t('audit.view')} onClick={() => setDetail(r)}>👁</GlassIconButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={50} total={total} onPage={setPage} />
      </div>

      {detail && (
        <Modal title={detail.table_name + ' · ' + detail.action} onClose={() => setDetail(null)} wide>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
            <div>
              <div className="font-medium mb-1">{t('audit.before')}</div>
              <pre dir="ltr" className="rounded-lg bg-[#E4EDEE] dark:bg-black/30 p-3 overflow-auto max-h-72 whitespace-pre-wrap">{detail.old_data ? JSON.stringify(detail.old_data, null, 2) : '—'}</pre>
            </div>
            <div>
              <div className="font-medium mb-1">{t('audit.after')}</div>
              <pre dir="ltr" className="rounded-lg bg-[#E4EDEE] dark:bg-black/30 p-3 overflow-auto max-h-72 whitespace-pre-wrap">{detail.new_data ? JSON.stringify(detail.new_data, null, 2) : '—'}</pre>
            </div>
          </div>
        </Modal>
      )}
    </Shell>
  );
}
