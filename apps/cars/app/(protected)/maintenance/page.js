'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { ShopModal, EMPTY_FORM as EMPTY_SHOP_FORM } from '@/app/(protected)/maintenance-shops/page';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage, trEnum } from '@/lib/i18n';
import {
  GlassPage, GlassButton, GlassDropdown, GlassSearch, GlassStatusChip,
  GlassThead, GlassTr, GlassTd, GlassField, GlassInput, GlassTextarea, GlassModal, GlassEmptyState, GlassLoader,
} from '@/components/glass';

const PAYMENT_TONE = { Paid: 'emerald', Unpaid: 'red', Partial: 'amber' };
const TH = 'text-start px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--tx-4)] font-semibold whitespace-nowrap';
const THsort = TH + ' cursor-pointer select-none hover:text-[var(--pr-2)] transition-colors';

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
  const dateCls = 'w-full rounded-xl border border-[var(--bd-2)] bg-white/70 dark:bg-white/[0.05] px-2.5 py-2 text-xs text-[var(--tx)] backdrop-blur-xl outline-none focus:border-[rgba(37,212,255,0.5)]';
  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} className={THsort}>{label}<SortIndicator column={col} sortKey={sortKey} sortDir={sortDir} /></th>
  );

  return (
    <Shell active="/maintenance">
      <GlassPage
        title={t('maint.title')}
        subtitle={t('maint.breadcrumb')}
        toolbar={isAdmin && <GlassButton onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>+ {t('maint.addRecord')}</GlassButton>}
      >
        <div className="glass-card !rounded-[22px] p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassSearch className="col-span-2" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('maint.searchPlaceholder')} />
          <GlassDropdown value={carId} onChange={v => { setPage(1); setCarId(v); }} placeholder={t('maint.allVehicles')} options={cars.map(c => [c.id, c.vehicle_number])} />
          <GlassDropdown value={driverId} onChange={v => { setPage(1); setDriverId(v); }} placeholder={t('maint.allDrivers')} options={drivers.map(d => [d.id, d.full_name])} />
          <GlassDropdown value={shopId} onChange={v => { setPage(1); setShopId(v); }} placeholder={t('maint.allShops')} options={shops.map(s => [s.id, s.name])} />
          <GlassDropdown value={category} onChange={v => { setPage(1); setCategory(v); }} placeholder={t('maint.allCategories')} options={categories.map(c => [c.name, c.name])} />
          <GlassDropdown value={paymentStatus} onChange={v => { setPage(1); setPaymentStatus(v); }} placeholder={t('maint.allPaymentStatus')} options={['Paid', 'Unpaid', 'Partial'].map(p => [p, trEnum(t, 'payment', p)])} />
          <div className="flex items-center gap-1">
            <input type="date" value={dateFrom} onChange={e => { setPage(1); setDateFrom(e.target.value); }} className={dateCls} />
            <span className="text-[var(--tx-4)] text-xs">{t('maint.to')}</span>
            <input type="date" value={dateTo} onChange={e => { setPage(1); setDateTo(e.target.value); }} className={dateCls} />
          </div>
          <div className="flex items-center gap-1">
            <input type="number" placeholder={t('maint.minCost')} value={costMin} onChange={e => { setPage(1); setCostMin(e.target.value); }} className={dateCls} />
            <span className="text-[var(--tx-4)] text-xs">–</span>
            <input type="number" placeholder={t('maint.maxCost')} value={costMax} onChange={e => { setPage(1); setCostMax(e.target.value); }} className={dateCls} />
          </div>
        </div>

        {error && <div className="text-[#F87171] text-sm">{error}</div>}

        <div className="glass-card !rounded-[22px] overflow-auto max-h-[70vh]">
          <table className="w-full min-w-[1000px]">
            <GlassThead>
              <tr>
                <SortTh col="maintenance_date" label={t('maint.colDate')} />
                <SortTh col="vehicle" label={t('maint.colVehicle')} />
                <SortTh col="driver" label={t('maint.colDriver')} />
                <SortTh col="category" label={t('maint.colCategory')} />
                <SortTh col="shop" label={t('maint.colShop')} />
                <SortTh col="amount" label={t('maint.colAmount')} />
                <SortTh col="odometer_km" label={t('maint.colKm')} />
                <SortTh col="invoice_number" label={t('maint.colInvoice')} />
                <SortTh col="payment_status" label={t('maint.colStatus')} />
                <SortTh col="created_by" label={t('maint.colCreatedBy')} />
                <th className={TH + ' text-end'}>{t('maint.colActions')}</th>
              </tr>
            </GlassThead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11}><GlassLoader label={t('maint.loading')} /></td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={11}><GlassEmptyState text={t('maint.noMatch')} /></td></tr>
              ) : sorted.map(r => (
                <GlassTr key={r.id} onClick={() => { window.location.href = '/maintenance/' + r.id; }}>
                  <GlassTd>{r.maintenance_date}</GlassTd>
                  <GlassTd className="font-semibold !text-[var(--tx)]">{r.cars?.vehicle_number || '—'}</GlassTd>
                  <GlassTd>{r.drivers?.full_name || '—'}</GlassTd>
                  <GlassTd>{r.category}</GlassTd>
                  <GlassTd>{r.maintenance_shops?.name || '—'}</GlassTd>
                  <GlassTd>{r.currency} {fmt(r.amount)}</GlassTd>
                  <GlassTd>{r.odometer_km ? fmt(r.odometer_km) : '—'}</GlassTd>
                  <GlassTd>{r.invoice_number || '—'}</GlassTd>
                  <GlassTd><GlassStatusChip label={trEnum(t, 'payment', r.payment_status)} tone={PAYMENT_TONE[r.payment_status] || 'slate'} /></GlassTd>
                  <GlassTd>{r.platform_users?.full_name || r.platform_users?.email || '—'}</GlassTd>
                  <GlassTd className="text-end whitespace-nowrap">
                    <span onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1.5">
                      <IconBtn title={t('maint.view')} onClick={() => { window.location.href = '/maintenance/' + r.id; }}>{'\u{1F441}'}</IconBtn>
                      {isAdmin && <IconBtn title={t('maint.edit')} tone="brand" onClick={() => setModal({ mode: 'edit', data: r })}>✎</IconBtn>}
                      {isAdmin && <IconBtn title={t('maint.delete')} tone="red" onClick={() => deleteRecord(r.id)}>🗑</IconBtn>}
                    </span>
                  </GlassTd>
                </GlassTr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-[var(--tx-4)] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span>{t('maint.showingEntries', { from: records.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + records.length, total })}</span>
            <div className="flex items-center gap-1.5">
              <span>{t('maint.rows')}</span>
              <GlassDropdown className="w-24" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PageBtn disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</PageBtn>
            <span className="text-[var(--tx-2)]">{page} / {totalPages}</span>
            <PageBtn disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</PageBtn>
          </div>
        </div>
      </GlassPage>

      {modal && (
        <RecordModal modal={modal} cars={cars} drivers={drivers} shops={shops} categories={categories}
          onShopAdded={s => setShops(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))}
          onClose={() => setModal(null)}
          onSaved={id => { setModal(null); load(); if (modal.mode === 'add' && id) window.location.href = '/maintenance/' + id; }} />
      )}
    </Shell>
  );
}

function IconBtn({ children, title, onClick, tone }) {
  const color = tone === 'brand' ? 'text-[var(--pr-2)]' : tone === 'red' ? 'text-[#F87171]' : 'text-[var(--tx-4)]';
  return (
    <button onClick={onClick} title={title}
      className={'h-8 w-8 rounded-lg border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl hover:border-[rgba(37,212,255,0.4)] transition-colors flex items-center justify-center ' + color}>
      {children}
    </button>
  );
}
function PageBtn({ children, disabled, onClick }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className="h-8 min-w-8 px-2 rounded-lg border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl text-[var(--tx-2)] disabled:opacity-40 hover:border-[rgba(37,212,255,0.4)] hover:text-[var(--pr-2)] transition-colors">
      {children}
    </button>
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

  const SecTitle = ({ children }) => <div className="text-[11px] font-semibold text-[var(--tx-4)] uppercase tracking-[0.1em] pt-1">{children}</div>;

  return (
    <>
      <GlassModal wide title={modal.mode === 'add' ? t('maint.addModalTitle') : t('maint.editModalTitle')} onClose={onClose}>
        <form onSubmit={submit} className="space-y-4 max-h-[75vh] overflow-y-auto pe-1">
          {err && <div className="text-[#F87171] text-sm">{err}</div>}

          <SecTitle>{t('maint.sectionBasic')}</SecTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <GlassField label={t('fields.vehicle')}>
              <GlassDropdown value={form.car_id} onChange={v => setForm(f => ({ ...f, car_id: v }))} placeholder={t('maint.selectVehicle')} options={cars.map(c => [c.id, c.vehicle_number])} />
            </GlassField>
            <GlassField label={t('fields.driver')}>
              <GlassDropdown value={form.driver_id || ''} onChange={v => setForm(f => ({ ...f, driver_id: v }))} placeholder={t('common.none')} options={[['', t('common.none')], ...drivers.map(d => [d.id, d.full_name])]} />
            </GlassField>
            <GlassField label={t('fields.maintenanceDate')} required><GlassInput type="date" value={form.maintenance_date} onChange={set('maintenance_date')} required /></GlassField>
            <GlassField label={t('fields.category')}>
              <GlassDropdown value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} placeholder={t('maint.selectCategory')} options={categories.map(c => [c.name, c.name])} />
            </GlassField>
            <GlassField label={t('fields.maintenanceType')}><GlassInput value={form.maintenance_type} onChange={set('maintenance_type')} /></GlassField>
            <GlassField label={t('fields.workshopShop')}>
              <div className="flex gap-1">
                <GlassDropdown className="flex-1" value={form.shop_id || ''} onChange={v => setForm(f => ({ ...f, shop_id: v }))} placeholder={t('common.none')} options={[['', t('common.none')], ...shops.map(s => [s.id, s.name])]} />
                <button type="button" onClick={() => setAddShopOpen(true)} title={t('maint.addNewShop')} className="px-3 rounded-xl border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl text-[var(--pr-2)] text-sm shrink-0 hover:border-[rgba(37,212,255,0.4)]">+</button>
              </div>
            </GlassField>
            <GlassField label={t('fields.odometerKm')}><GlassInput type="number" value={form.odometer_km} onChange={set('odometer_km')} /></GlassField>
            <GlassField label={t('fields.amount')}><GlassInput type="number" value={form.amount} onChange={set('amount')} /></GlassField>
            <GlassField label={t('fields.currency')}><GlassInput value={form.currency} onChange={set('currency')} /></GlassField>
            <GlassField label={t('fields.invoiceNumber')}><GlassInput value={form.invoice_number} onChange={set('invoice_number')} /></GlassField>
            <GlassField label={t('fields.paymentStatus')}>
              <GlassDropdown value={form.payment_status} onChange={v => setForm(f => ({ ...f, payment_status: v }))} options={['Unpaid', 'Paid', 'Partial'].map(p => [p, trEnum(t, 'payment', p)])} />
            </GlassField>
            <GlassField label={t('fields.technician')}><GlassInput value={form.technician} onChange={set('technician')} /></GlassField>
            <GlassField label={t('fields.warranty')}><GlassInput value={form.warranty} onChange={set('warranty')} /></GlassField>
          </div>

          <SecTitle>{t('maint.sectionDetails')}</SecTitle>
          <div className="grid gap-3">
            <GlassField label={t('fields.workPerformed')}><GlassTextarea value={form.work_performed || ''} onChange={set('work_performed')} rows={2} /></GlassField>
            <GlassField label={t('fields.partsChanged')}><GlassTextarea value={form.parts_changed || ''} onChange={set('parts_changed')} rows={2} /></GlassField>
            <GlassField label={t('fields.laborDetails')}><GlassTextarea value={form.labor_details || ''} onChange={set('labor_details')} rows={2} /></GlassField>
            <GlassField label={t('fields.additionalNotes')}><GlassTextarea value={form.notes || ''} onChange={set('notes')} rows={2} /></GlassField>
          </div>
          {modal.mode === 'add' && <p className="text-xs text-[var(--tx-4)]">{t('maint.attachmentsHint')}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <GlassButton type="button" variant="ghost" onClick={onClose}>{t('maint.cancel')}</GlassButton>
            <GlassButton type="submit" disabled={busy}>{busy ? t('maint.saving') : t('maint.save')}</GlassButton>
          </div>
        </form>
      </GlassModal>

      {addShopOpen && (
        <ShopModal modal={{ mode: 'add', data: EMPTY_SHOP_FORM }} onClose={() => setAddShopOpen(false)}
          onSaved={shop => { onShopAdded(shop); setForm(f => ({ ...f, shop_id: shop.id })); setAddShopOpen(false); }} />
      )}
    </>
  );
}

function fmt(n) { return Number(n || 0).toLocaleString(); }
