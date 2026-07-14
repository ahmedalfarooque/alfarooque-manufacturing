'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { ShopModal, EMPTY_FORM as EMPTY_SHOP_FORM } from '@/app/(protected)/maintenance-shops/page';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Button, Input, Field, Textarea, Modal, EmptyState, Th, Td } from '@/components/ui';

const PAYMENT_BADGE = {
  Paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Unpaid: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const sortHeaderCls = 'cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#3d3d33] dark:hover:text-white/90 transition-colors';

export const EMPTY_FORM = {
  car_id: '', driver_id: '', maintenance_date: new Date().toISOString().slice(0, 10), category: '', maintenance_type: '',
  shop_id: '', odometer_km: '', amount: '', currency: 'SAR', invoice_number: '', payment_status: 'Unpaid',
  technician: '', warranty: '', work_performed: '', parts_changed: '', labor_details: '', notes: '',
};

export default function MaintenanceRecordsPage() {
  const { t } = useLanguage();
  const [me, setMe] = useState(null);
  const [records, setRecords] = useState([]);
  const [cars, setCars] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [carId, setCarId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [shopId, setShopId] = useState('');
  const [category, setCategory] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [costMin, setCostMin] = useState('');
  const [costMax, setCostMax] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const isAdmin = me?.role === 'admin';

  const loadRefs = useCallback(() => {
    fetch('/api/cars?pageSize=100', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setCars(d.vehicles || [])).catch(() => {});
    fetch('/api/drivers', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setDrivers(d.drivers || [])).catch(() => {});
    fetch('/api/shops', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setShops(d.shops || [])).catch(() => {});
    fetch('/api/categories', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setCategories(d.categories || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({
      search: debouncedSearch, carId, driverId, shopId, category, paymentStatus, dateFrom, dateTo, costMin, costMax,
      page: String(page), pageSize: String(pageSize),
    });
    try {
      const res = await fetch('/api/maintenance-records?' + q.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecords(data.records); setTotal(data.total); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [debouncedSearch, carId, driverId, shopId, category, paymentStatus, dateFrom, dateTo, costMin, costMax, page, pageSize]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(records, {
    vehicle: r => r.cars?.vehicle_number, driver: r => r.drivers?.full_name, shop: r => r.maintenance_shops?.name,
    amount: r => Number(r.amount || 0), created_by: r => r.platform_users?.full_name || r.platform_users?.email,
  });

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
    loadRefs();
  }, [loadRefs]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function deleteRecord(id) {
    if (!confirm(t('maint.confirmDelete'))) return;
    const res = await fetch(`/api/maintenance-records/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Shell active="/maintenance">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('maint.title')}</h2>
          <p className="text-xs text-[#8C8A80]">{t('maint.breadcrumb')}</p>
        </div>
        {isAdmin && <Button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>+ {t('maint.addRecord')}</Button>}
      </div>

      <div className="glass-card glass-card--pad mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input placeholder={t('maint.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="col-span-2" />
        <Dropdown value={carId} onChange={v => { setPage(1); setCarId(v); }} placeholder={t('maint.allVehicles')} options={cars.map(c => [c.id, c.vehicle_number])} />
        <Dropdown value={driverId} onChange={v => { setPage(1); setDriverId(v); }} placeholder={t('maint.allDrivers')} options={drivers.map(d => [d.id, d.full_name])} />
        <Dropdown value={shopId} onChange={v => { setPage(1); setShopId(v); }} placeholder={t('maint.allShops')} options={shops.map(s => [s.id, s.name])} />
        <Dropdown value={category} onChange={v => { setPage(1); setCategory(v); }} placeholder={t('maint.allCategories')} options={categories.map(c => [c.name, c.name])} />
        <Dropdown value={paymentStatus} onChange={v => { setPage(1); setPaymentStatus(v); }} placeholder={t('maint.allPaymentStatus')} options={['Paid', 'Unpaid', 'Partial'].map(p => [p, trEnum(t, 'payment', p)])} />
        <div className="flex items-center gap-1">
          <Input type="date" value={dateFrom} onChange={e => { setPage(1); setDateFrom(e.target.value); }} />
          <span className="text-[#8C8A80] text-xs">{t('maint.to')}</span>
          <Input type="date" value={dateTo} onChange={e => { setPage(1); setDateTo(e.target.value); }} />
        </div>
        <div className="flex items-center gap-1">
          <Input type="number" placeholder={t('maint.minCost')} value={costMin} onChange={e => { setPage(1); setCostMin(e.target.value); }} />
          <span className="text-[#8C8A80] text-xs">–</span>
          <Input type="number" placeholder={t('maint.maxCost')} value={costMax} onChange={e => { setPage(1); setCostMax(e.target.value); }} />
        </div>
      </div>

      {error && <div className="text-[#BC6B4E] text-sm mb-3">{error}</div>}

      <div className="glass-card overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="sticky top-0 z-10 bg-[#F7F5F1]/95 dark:bg-[#1B1B14]/95 backdrop-blur-sm border-b border-[#E5E2DD]/70 dark:border-white/[0.06]">
            <tr>
              <Th><span onClick={() => toggleSort('maintenance_date')} className={sortHeaderCls}>{t('maint.colDate')}<SortIndicator column="maintenance_date" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('vehicle')} className={sortHeaderCls}>{t('maint.colVehicle')}<SortIndicator column="vehicle" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('driver')} className={sortHeaderCls}>{t('maint.colDriver')}<SortIndicator column="driver" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('category')} className={sortHeaderCls}>{t('maint.colCategory')}<SortIndicator column="category" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('shop')} className={sortHeaderCls}>{t('maint.colShop')}<SortIndicator column="shop" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('amount')} className={sortHeaderCls}>{t('maint.colAmount')}<SortIndicator column="amount" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('odometer_km')} className={sortHeaderCls}>{t('maint.colKm')}<SortIndicator column="odometer_km" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('invoice_number')} className={sortHeaderCls}>{t('maint.colInvoice')}<SortIndicator column="invoice_number" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('payment_status')} className={sortHeaderCls}>{t('maint.colStatus')}<SortIndicator column="payment_status" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('created_by')} className={sortHeaderCls}>{t('maint.colCreatedBy')}<SortIndicator column="created_by" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th className="text-end">{t('maint.colActions')}</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="py-8 text-center text-[#8C8A80]">{t('maint.loading')}</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={11}><EmptyState text={t('maint.noMatch')} /></td></tr>
            ) : sorted.map(r => (
              <tr key={r.id} className="cursor-pointer hover:bg-[#F7F5F1] dark:hover:bg-white/[0.03]"
                onClick={() => { window.location.href = '/maintenance/' + r.id; }}>
                <Td>{r.maintenance_date}</Td>
                <Td className="font-medium">{r.cars?.vehicle_number || '—'}</Td>
                <Td>{r.drivers?.full_name || '—'}</Td>
                <Td>{r.category}</Td>
                <Td>{r.maintenance_shops?.name || '—'}</Td>
                <Td>{r.currency} {fmt(r.amount)}</Td>
                <Td>{r.odometer_km ? fmt(r.odometer_km) : '—'}</Td>
                <Td>{r.invoice_number || '—'}</Td>
                <Td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PAYMENT_BADGE[r.payment_status] || '')}>{trEnum(t, 'payment', r.payment_status)}</span></Td>
                <Td>{r.platform_users?.full_name || r.platform_users?.email || '—'}</Td>
                <Td className="text-end">
                  <div className="flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { window.location.href = '/maintenance/' + r.id; }} title={t('maint.view')} className="text-[#8C8A80] hover:text-[#3d3d33] dark:hover:text-white transition-colors">{'\u{1F441}'}</button>
                    {isAdmin && <button onClick={() => setModal({ mode: 'edit', data: r })} title={t('maint.edit')} className="text-brand-600 dark:text-brand-400 hover:underline">✎</button>}
                    {isAdmin && <button onClick={() => deleteRecord(r.id)} title={t('maint.delete')} className="text-[#BC6B4E] hover:underline">🗑</button>}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-[#8C8A80] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('maint.showingEntries', { from: records.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + records.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('maint.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[#F1EEE7] dark:hover:bg-white/5">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[#F1EEE7] dark:hover:bg-white/5">›</button>
        </div>
      </div>

      {modal && (
        <RecordModal modal={modal} cars={cars} drivers={drivers} shops={shops} categories={categories}
          onShopAdded={s => setShops(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))}
          onClose={() => setModal(null)}
          onSaved={id => { setModal(null); load(); if (modal.mode === 'add' && id) window.location.href = '/maintenance/' + id; }} />
      )}
    </Shell>
  );
}

export function RecordModal({ modal, cars, drivers, shops, categories, onShopAdded, onClose, onSaved }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...modal.data }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [addShopOpen, setAddShopOpen] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const url = modal.mode === 'add' ? '/api/maintenance-records' : `/api/maintenance-records/${modal.data.id}`;
      const res = await fetch(url, {
        method: modal.mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.record?.id);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <>
      <Modal title={modal.mode === 'add' ? t('maint.addModalTitle') : t('maint.editModalTitle')} onClose={onClose} wide>
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="text-[#BC6B4E] text-sm">{err}</div>}

          <div className="text-xs font-semibold text-[#8C8A80] uppercase tracking-wide">{t('maint.sectionBasic')}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label={t('fields.vehicle')}>
              <Dropdown value={form.car_id} onChange={v => setForm(f => ({ ...f, car_id: v }))} placeholder={t('maint.selectVehicle')}
                options={cars.map(c => [c.id, c.vehicle_number])} />
            </Field>
            <Field label={t('fields.driver')}>
              <Dropdown value={form.driver_id || ''} onChange={v => setForm(f => ({ ...f, driver_id: v }))} placeholder={t('common.none')}
                options={[['', t('common.none')], ...drivers.map(d => [d.id, d.full_name])]} />
            </Field>
            <Field label={t('fields.maintenanceDate')} required>
              <Input type="date" value={form.maintenance_date} onChange={set('maintenance_date')} required />
            </Field>
            <Field label={t('fields.category')}>
              <Dropdown value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} placeholder={t('maint.selectCategory')}
                options={categories.map(c => [c.name, c.name])} />
            </Field>
            <Field label={t('fields.maintenanceType')}>
              <Input value={form.maintenance_type} onChange={set('maintenance_type')} />
            </Field>
            <Field label={t('fields.workshopShop')}>
              <div className="flex gap-1">
                <Dropdown className="flex-1" value={form.shop_id || ''} onChange={v => setForm(f => ({ ...f, shop_id: v }))} placeholder={t('common.none')}
                  options={[['', t('common.none')], ...shops.map(s => [s.id, s.name])]} />
                <button type="button" onClick={() => setAddShopOpen(true)} title={t('maint.addNewShop')}
                  className="px-2 rounded-lg border border-[#E5E2DD] dark:border-white/[0.08] hover:bg-[#F1EEE7] dark:hover:bg-white/5 text-sm shrink-0 transition-colors">+</button>
              </div>
            </Field>
            <Field label={t('fields.odometerKm')}>
              <Input type="number" value={form.odometer_km} onChange={set('odometer_km')} />
            </Field>
            <Field label={t('fields.amount')}>
              <Input type="number" value={form.amount} onChange={set('amount')} />
            </Field>
            <Field label={t('fields.currency')}>
              <Input value={form.currency} onChange={set('currency')} />
            </Field>
            <Field label={t('fields.invoiceNumber')}>
              <Input value={form.invoice_number} onChange={set('invoice_number')} />
            </Field>
            <Field label={t('fields.paymentStatus')}>
              <Dropdown value={form.payment_status} onChange={v => setForm(f => ({ ...f, payment_status: v }))} options={['Unpaid', 'Paid', 'Partial'].map(p => [p, trEnum(t, 'payment', p)])} />
            </Field>
            <Field label={t('fields.technician')}>
              <Input value={form.technician} onChange={set('technician')} />
            </Field>
            <Field label={t('fields.warranty')}>
              <Input value={form.warranty} onChange={set('warranty')} />
            </Field>
          </div>

          <div className="text-xs font-semibold text-[#8C8A80] uppercase tracking-wide pt-2">{t('maint.sectionDetails')}</div>
          <div className="grid gap-3">
            <Field label={t('fields.workPerformed')}><Textarea rows={2} value={form.work_performed || ''} onChange={set('work_performed')} /></Field>
            <Field label={t('fields.partsChanged')}><Textarea rows={2} value={form.parts_changed || ''} onChange={set('parts_changed')} /></Field>
            <Field label={t('fields.laborDetails')}><Textarea rows={2} value={form.labor_details || ''} onChange={set('labor_details')} /></Field>
            <Field label={t('fields.additionalNotes')}><Textarea rows={2} value={form.notes || ''} onChange={set('notes')} /></Field>
          </div>
          {modal.mode === 'add' && <p className="text-xs text-[#8C8A80]">{t('maint.attachmentsHint')}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t('maint.cancel')}</Button>
            <Button type="submit" disabled={busy}>{busy ? t('maint.saving') : t('maint.save')}</Button>
          </div>
        </form>
      </Modal>

      {addShopOpen && (
        <ShopModal modal={{ mode: 'add', data: EMPTY_SHOP_FORM }} onClose={() => setAddShopOpen(false)}
          onSaved={shop => { onShopAdded(shop); setForm(f => ({ ...f, shop_id: shop.id })); setAddShopOpen(false); }} />
      )}
    </>
  );
}

function fmt(n) { return Number(n || 0).toLocaleString(); }
