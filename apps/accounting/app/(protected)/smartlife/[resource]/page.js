'use client';

import { useEffect, useMemo, useState, isValidElement } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassModal, GlassSelect, toast } from '@/components/glass';
import { getAppUrl } from '@/lib/appLinks';
import { exportReportPdf } from '@/lib/reportPdf';
import ZatcaQr from '@/components/ZatcaQr';
import DateFilter, { inDateFilter, dateFilterLabel } from '@/components/DateFilter';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import { useLanguage } from '@/lib/i18n';

/* `supported` reflects the SmartERP V3 OpenAPI specification (verified,
   authoritative — see apps/shared/integrationPlatform.js). Every resource in
   SMARTLIFE_RESOURCES has a real GET endpoint, so all of them render through
   this same generic table/detail/report view — `supported:false` is reserved
   for concepts (like a raw payments ledger) with no matching SmartERP read
   endpoint at all, where showing a table would mean fabricating columns. */
const MODULES = [
  { key:'sales-invoices', label:'Sales Invoices', group:'Sales', supported:true },
  { key:'customers', label:'Customers', group:'Sales', supported:true },
  { key:'purchases', label:'Purchases', group:'Purchases', supported:true },
  { key:'payments', label:'Payments', group:'Financial', supported:false },
  { key:'suppliers', label:'Suppliers', group:'Purchases', supported:true },
  { key:'products', label:'Products', group:'Source', supported:true },
  { key:'categories', label:'Categories', group:'Source', supported:true },
  { key:'units', label:'Units', group:'Source', supported:true },
  { key:'brands', label:'Brands', group:'Source', supported:true },
  { key:'warehouses', label:'Warehouses', group:'Source', supported:true },
  { key:'tax', label:'Tax Rates', group:'Financial', supported:true },
  { key:'accounts', label:'Chart of Accounts', group:'Financial', supported:true },
  { key:'account-balances', label:'Account Balances', group:'Financial', supported:true },
  { key:'trial-balance', label:'Trial Balance', group:'Financial', supported:true },
  { key:'cost-centers', label:'Cost Centers', group:'Financial', supported:true },
  { key:'gift-cards', label:'Gift Cards', group:'Other', supported:true },
  { key:'coupons', label:'Coupons', group:'Other', supported:true },
  { key:'users', label:'Users', group:'Other', supported:true },
  { key:'cashiers', label:'Cashiers', group:'Other', supported:true },
  { key:'financial-reports', label:'Financial Reports', group:'Financial', supported:true },
  { key:'product-balances', label:'Product Balances', group:'Inventory', supported:true },
];
const LABELS = Object.fromEntries(MODULES.map(item => [item.key,item.label]));
const SUPPORTED = new Set(MODULES.filter(item => item.supported).map(item => item.key));

function first(record, keys) { for (const key of keys) if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key]; return null; }
/* Never JSON.stringify a React element (or anything holding one) — its
   internal fields (_owner, context Providers, fibers) are circular and
   throw "Converting circular structure to JSON". This must only ever
   serialize plain data values coming from a SmartLife API response. */
function display(value) {
  if (value == null || value === '') return '—';
  if (isValidElement(value)) return value;
  if (Array.isArray(value)) return value.length ? value.map(v => (v == null ? '—' : String(v))).join(', ') : '—';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch (_) { return '—'; }
  }
  return String(value);
}
function money(value, currency = 'SAR') { return `${Number(value || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`; }
function professionalDate(value) {
  if (value == null || value === '') return '—';
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return String(value);
  const [, year, month, day, hour, minute] = match;
  const time = hour && minute && `${hour}:${minute}` !== '00:00' ? ` ${hour}:${minute}` : '';
  return `${day}/${month}/${year}${time}`;
}
function externalId(record) { return String(first(record,['id','invoice_id','expense_id','uuid','reference_no','number','invoice_number','reference']) || ''); }
/* Field-scoped search — only the fields that are actually meaningful to
   search for a given module, not "match anything anywhere in the raw
   record" (which used to match on internal IDs, warehouse codes, etc.
   unrelated to what a user is actually looking for). */
const SEARCH_FIELDS = {
  'sales-invoices': ['reference_no','invoice_number','number','reference','customer','customer_name','id'],
  purchases: ['reference_no','invoice_number','number','reference','supplier','supplier_name','id'],
  customers: ['name','company','company_name','phone','email','vat_no','vat_number'],
  suppliers: ['name','company','company_name','phone','email','vat_no','vat_number'],
  products: ['name','english_name','code','category','unit'],
  warehouses: ['name','id'],
  categories: ['name','english_name','code','id'],
  units: ['name','english_name','code','id'],
  brands: ['name','english_name','code','id'],
  tax: ['name','rate','value','id'],
  accounts: ['name','account_name','code','account_code','id'],
  'account-balances': ['name','account_name','code','account_code','id'],
  'trial-balance': ['account_number','account_name','id'],
  'cost-centers': ['name','code','id'],
  'gift-cards': ['number','code','name','id'],
  coupons: ['code','name','id'],
  users: ['name','email','phone','id'],
  cashiers: ['name','email','phone','id'],
};
function searchable(record, resource) {
  const fields = SEARCH_FIELDS[resource];
  if (!fields) return '';
  return fields.map(f => (record?.[f] != null ? String(record[f]) : '')).join(' ').toLowerCase();
}

const DOCUMENT_RESOURCES = new Set(['sales-invoices', 'purchases']);

/* Verified real SmartLife purchase-status source data — id is the internal
   filter/status value, title is the exact Arabic string SmartLife's own
   `status` field returns on a purchase record. Never invented: this is the
   complete 5-status universe as supplied, used as-is. Sales invoices use a
   different, unrelated status vocabulary (completed/returned/pending per
   SmartERP's own info/sales_statuses) so this map is purchases-only. */
const PURCHASE_STATUSES = [
  { id: 'received', title: 'تم الاستلام' },
  { id: 'partial', title: 'جزئي' },
  { id: 'pending', title: 'عملية معلقة' },
  { id: 'ordered', title: 'تم الطلب' },
  { id: 'returned', title: 'مرتجع' },
];
const PURCHASE_STATUS_TITLE_TO_ID = Object.fromEntries(PURCHASE_STATUSES.map(s => [s.title, s.id]));

function invoiceView(record, resource = 'sales-invoices') {
  const total = Number(first(record,['grand_total','total_amount','total','net_total','amount']) || 0);
  const paid = Number(first(record,['paid_amount','amount_paid','paid','payment_total']) || 0);
  const balanceValue = first(record,['balance_amount','remaining_balance','balance','due_amount']);
  const party = resource === 'purchases'
    ? first(record,['supplier','supplier_name','party_name'])
    : first(record,['customer','customer_name','party_name']);
  /* payment_status and status (purchase/sale status) are two SEPARATE
     fields on SmartERP's records — kept as distinct columns/filters since
     they answer different questions ("has this been paid" vs "is this
     order completed/returned/pending"). `status` is read as-authored by
     SmartLife (e.g. "تم الاستلام") — never substituted or translated. */
  const rawPaymentStatus = first(record,['payment_status']);
  const paymentStatus = rawPaymentStatus == null
    ? (paid >= total && total ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid')
    : String(rawPaymentStatus).trim();
  const rawSaleStatusTitle = first(record,['status','sale_status','purchase_status']);
  const saleStatusTitle = rawSaleStatusTitle == null ? null : String(rawSaleStatusTitle).trim();
  const saleStatusId = resource === 'purchases' && saleStatusTitle ? (PURCHASE_STATUS_TITLE_TO_ID[String(saleStatusTitle).trim()] || null) : null;
  return {
    external_id:externalId(record), invoice_number:first(record,['reference_no','invoice_number','number','reference','code']),
    customer:party, date:first(record,['invoice_date','date','created_at']),
    due_date:first(record,['due_date','payment_due_date']), subtotal:Number(first(record,['total','subtotal','sub_total','net_amount']) || 0),
    vat:Number(first(record,['total_tax','vat_amount','tax_amount','vat','tax']) || 0), total, paid,
    balance:balanceValue == null ? Math.max(total-paid,0) : Number(balanceValue || 0),
    paymentStatus, saleStatus:saleStatusTitle, saleStatusId,
    status:paymentStatus,
    currency:String(first(record,['currency','currency_code']) || 'SAR'),
  };
}

export default function SmartLifeResourcePage({ params }) {
  const { t, lang } = useLanguage();
  const resource = LABELS[params.resource] ? params.resource : 'sales-invoices';
  const supported = SUPPORTED.has(resource);
  /* Sales Invoices and Purchases both get the dedicated document-workspace
     toolbar/table (date range, party filter, payment/sale status, richer
     columns, summary bar) instead of the generic single-search+status view
     every other resource still uses. */
  const isInvoiceWorkspace = DOCUMENT_RESOURCES.has(resource);
  const partyLabel = resource === 'purchases' ? 'Supplier' : 'Customer';
  const [search,setSearch] = useState(''); const [status,setStatus] = useState(''); const [selected,setSelected] = useState(null);
  const [dateFilter,setDateFilter] = useState({ preset:'all', from:null, to:null });
  const [customerFilter,setCustomerFilter] = useState(''); const [paymentStatusFilter,setPaymentStatusFilter] = useState(''); const [saleStatusFilter,setSaleStatusFilter] = useState('');
  const [categoryFilter,setCategoryFilter] = useState(''); const [unitFilter,setUnitFilter] = useState(''); const [typeFilter,setTypeFilter] = useState('');
  /* Trial Balance column toggles — real, working switches over the one
     real `balance` field SmartERP exposes (id/account_number/account_name/
     balance only). SmartERP has no fiscal-year, branch, cost-center link,
     account-type classification, or beginning/period-balance breakdown on
     this resource, so those SmartLife-report controls are NOT built here —
     adding them would mean fabricated columns with no real data behind
     them, which is explicitly disallowed. Debit/Credit/Balance are genuine
     alternate views of the same real number, toggle instantly, and are
     picked up by Print/PDF/Excel automatically since runReport() already
     builds its export columns from this same `columns` array. */
  const [tbShowDebit,setTbShowDebit] = useState(true); const [tbShowCredit,setTbShowCredit] = useState(true); const [tbShowBalance,setTbShowBalance] = useState(false);
  const [page,setPage] = useState(0); const [pageSize,setPageSize] = useState(25);
  const [connectOpen,setConnectOpen] = useState(false); const [projectId,setProjectId] = useState(''); const [relationship,setRelationship] = useState(null); const [busy,setBusy] = useState(false);
  const [reportBusy,setReportBusy] = useState('');
  const [filterUniverse,setFilterUniverse] = useState([]);
  /* Trial Balance is not a distinct SmartERP endpoint — it is the exact
     same real accounting/account_balances data already used by the Account
     Balances page, presented in the standard Debit/Credit trial-balance
     format instead of a single signed balance column. Reusing the same
     canonical resource (no new connector, no invented figures) — see
     cell()/columns below for the debit/credit split. */
  const backendResource = resource === 'trial-balance' ? 'account-balances' : resource;
  const dataUrl=useMemo(() => {
    if (resource === 'financial-reports') return '/api/smartlife/reports';
    if (resource === 'product-balances') return '/api/smartlife/product-balances';
    const query = new URLSearchParams({ offset:String(page*pageSize), limit:String(pageSize) });
    if (search.trim()) query.set('search',search.trim());
    if (resource === 'sales-invoices' || resource === 'purchases') { query.set('sort_by', 'date'); query.set('sort_type', 'desc'); }
    return `/api/smartlife/${backendResource}?${query}`;
  },[resource,backendResource,page,pageSize,search]);
  const { data,error,loading,refresh } = useLiveData(dataUrl,supported?30000:0);
  const { data:syncData,refresh:refreshSync } = useLiveData('/api/smartlife/sync',15000);
  const records = Array.isArray(data?.records) ? data.records : [];
  const optionRecords = filterUniverse.length ? filterUniverse : records;
  const statusValues = useMemo(() => [...new Set(records.map(r => r?.status || r?.payment_status).filter(Boolean).map(String))],[records]);
  const paymentStatusValues = useMemo(() => [...new Set(optionRecords.map(r => invoiceView(r,resource).paymentStatus).filter(Boolean).map(String))],[optionRecords,resource]);
  /* Purchases use the fixed, verified 5-status universe (filterable even
     if only some statuses appear on the currently loaded page); other
     resources keep deriving filter options from whatever is loaded. */
  const saleStatusValues = useMemo(() => resource === 'purchases'
    ? PURCHASE_STATUSES
    : [...new Set(optionRecords.map(r => invoiceView(r,resource).saleStatus).filter(Boolean).map(String))].map(v => ({ id: v, title: v })),
  [optionRecords,resource]);
  const localFiltersActive = isInvoiceWorkspace
    ? !!(customerFilter || paymentStatusFilter || saleStatusFilter || (dateFilter?.preset && dateFilter.preset !== 'all'))
    : resource === 'products' && !!(categoryFilter || unitFilter || typeFilter);
  /* SmartLife-backed lists must preserve SmartERP's own record order, never
     an opinionated client-side re-sort — sort_by=date&sort_type=desc is sent
     upstream (honored by some endpoints, silently ignored by others) and
     whatever order comes back is shown as-is. Complete-dataset fetching
     (filterUniverse) exists only so client-side filters (date range, party,
     status) can see the full set SmartERP doesn't expose as query params —
     it is used ONLY while a filter is actually active, filtered with a plain
     .filter() that preserves source order, never re-sorted. Without an
     active filter, the page renders the single already-fetched `records`
     page directly, so there is no flicker from a slower complete-dataset
     fetch reordering rows after the fact, and no redundant full-dataset
     fetch/sort on every unfiltered page load. */
  const usingCompleteFilterSet = localFiltersActive && filterUniverse.length > 0;
  const candidateRecords = usingCompleteFilterSet ? filterUniverse : records;
  const filteredRecords = useMemo(() => candidateRecords.filter(record => {
    if (isInvoiceWorkspace) {
      const view = invoiceView(record, resource);
      if (search && !searchable(record, resource).includes(search.toLowerCase())) return false;
      if (customerFilter && !String(view.customer || '').toLowerCase().includes(customerFilter.toLowerCase())) return false;
      if (paymentStatusFilter && String(view.paymentStatus || '').trim() !== paymentStatusFilter.trim()) return false;
      if (saleStatusFilter) {
        const compareValue = resource === 'purchases' ? view.saleStatusId : view.saleStatus;
        if (String(compareValue || '').trim() !== saleStatusFilter.trim()) return false;
      }
      if (!inDateFilter(dateFilter, view.date)) return false;
      return true;
    }
    if (resource === 'products') {
      if (search && !searchable(record, resource).includes(search.toLowerCase())) return false;
      if (categoryFilter && String(record?.category || '').trim() !== categoryFilter) return false;
      if (unitFilter && String(record?.unit || '') !== unitFilter) return false;
      if (typeFilter && String(record?.type || '') !== typeFilter) return false;
      return true;
    }
    return (!search || searchable(record, resource).includes(search.toLowerCase())) && (!status || String(record?.status || record?.payment_status || '') === status);
  }),[candidateRecords,search,status,resource,isInvoiceWorkspace,customerFilter,paymentStatusFilter,saleStatusFilter,dateFilter,categoryFilter,unitFilter,typeFilter]);
  const totalRecords = usingCompleteFilterSet ? filteredRecords.length : (Number(data?.total) || records.length);
  const totalPages = Math.max(1,Math.ceil(totalRecords/pageSize));
  const filtered = usingCompleteFilterSet ? filteredRecords.slice(page * pageSize, (page + 1) * pageSize) : filteredRecords;

  function matchesActiveFilters(record) {
    if (isInvoiceWorkspace) {
      const view = invoiceView(record, resource);
      if (search && !searchable(record, resource).includes(search.toLowerCase())) return false;
      if (customerFilter && !String(view.customer || '').toLowerCase().includes(customerFilter.toLowerCase())) return false;
      if (paymentStatusFilter && String(view.paymentStatus || '').trim() !== paymentStatusFilter.trim()) return false;
      if (saleStatusFilter) {
        const compareValue = resource === 'purchases' ? view.saleStatusId : view.saleStatus;
        if (String(compareValue || '').trim() !== saleStatusFilter.trim()) return false;
      }
      return inDateFilter(dateFilter, view.date);
    }
    if (resource === 'products') {
      return (!search || searchable(record, resource).includes(search.toLowerCase()))
        && (!categoryFilter || String(record?.category || '').trim() === categoryFilter)
        && (!unitFilter || String(record?.unit || '') === unitFilter)
        && (!typeFilter || String(record?.type || '') === typeFilter);
    }
    return (!search || searchable(record, resource).includes(search.toLowerCase()))
      && (!status || String(record?.status || record?.payment_status || '') === status);
  }

  async function fetchCompleteResource(includeSearch = true) {
    if (resource === 'financial-reports') return records;
    const all = []; const seen = new Set(); const limit = 500;
    for (let offset = 0, guard = 0; guard < 100; guard += 1) {
      const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
      if (includeSearch && search.trim()) query.set('search', search.trim());
      if (resource === 'sales-invoices' || resource === 'purchases') { query.set('sort_by', 'date'); query.set('sort_type', 'desc'); }
      const response = await fetch(`/api/smartlife/${backendResource}?${query}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => ({}));
      const batch = Array.isArray(payload.records) ? payload.records : [];
      if (!response.ok && !batch.length) throw new Error(payload.error || 'Could not load the complete report dataset.');
      for (const record of batch) {
        const key = externalId(record) || JSON.stringify(record);
        if (!seen.has(key)) { seen.add(key); all.push(record); }
      }
      if (!batch.length || batch.length < limit || all.length >= Number(payload.total || 0)) break;
      offset += batch.length;
    }
    return all;
  }
  /* Secondary filters are client-side because SmartERP does not expose every
     required filter as a documented query parameter (notably date ranges and
     product category/unit). Load one complete read-only option universe for
     the two filter-rich workspaces, then paginate the MATCHED rows locally.
     This prevents a filter from inspecting only the current 25-row page. */
  useEffect(() => {
    let cancelled = false;
    if (!isInvoiceWorkspace && resource !== 'products' && resource !== 'trial-balance') { setFilterUniverse([]); return undefined; }
    fetchCompleteResource(false).then(all => { if (!cancelled) setFilterUniverse(all); }).catch(() => { if (!cancelled) setFilterUniverse([]); });
    return () => { cancelled = true; };
  }, [resource,isInvoiceWorkspace]);
  /* Products: real distinct Category/Unit/Type values, verified against
     all 2,912 real records — no Brand/Warehouse/Status filter, since
     brand_id is 0 and warehouse is null on every real product. */
  const categoryValues = useMemo(() => resource === 'products' ? [...new Set(optionRecords.map(r => String(r?.category || '').trim()).filter(Boolean))].sort() : [], [optionRecords,resource]);
  const unitValues = useMemo(() => resource === 'products' ? [...new Set(optionRecords.map(r => r?.unit).filter(Boolean))].sort() : [], [optionRecords,resource]);
  const typeValues = useMemo(() => resource === 'products' ? [...new Set(optionRecords.map(r => r?.type).filter(Boolean))].sort() : [], [optionRecords,resource]);
  const columns = useMemo(() => {
    /* Compact, fixed column set — Reference/Date/Party/Total/Paid/Balance/
       Status only, per explicit repeated instruction not to add extra
       financial columns. Detail modal still shows subtotal/VAT/sale
       status/items for anyone who needs the full breakdown. */
    if (isInvoiceWorkspace) return resource === 'purchases'
      ? ['invoice_number','date','customer','total','paid','balance','paymentStatus','saleStatus']
      : ['invoice_number','date','customer','total','paid','balance','paymentStatus'];
    /* Customers/Suppliers: real fields only, verified against actual
       SmartLife records — name/company, phone, email, vat_no,
       current_balance all genuinely exist; there is no status field on
       either resource, so none is shown rather than inventing one. */
    if (resource === 'customers' || resource === 'suppliers') {
      const present = new Set(records.flatMap(r => r && typeof r === 'object' ? Object.keys(r) : []));
      return ['contact_name','phone','email','vat_no','current_balance'].filter(k => k === 'contact_name' || present.has(k));
    }
    /* Products: real fields only, verified against all 2,912 real records.
       No barcode/SKU/brand/warehouse/status field exists on the actual
       SmartLife product record — none of those are shown. */
    if (resource === 'products') return ['name','code','category','type','unit','cost','price','quantity','tax_rate'];
    /* Warehouses: real fields only — id/name/latitude/longitude is the
       complete real schema (verified). No address/phone/manager/capacity/
       status field exists, so none is shown. */
    if (resource === 'warehouses') return ['name','latitude','longitude'];
    /* Chart of Accounts / Account Balances: real fields are account_number/
       account_name(/balance) — NOT 'number'/'name', so the generic
       `preferred` list below never matched them and silently fell back to
       showing only ['id','balance'] (or just ['id']), i.e. raw unlabeled
       IDs with no account name. Verified against actual SmartERP records. */
    if (resource === 'accounts') return ['account_number', 'account_name'];
    if (resource === 'account-balances') return ['account_number', 'account_name', 'balance'];
    /* Trial Balance: same account_number/account_name/balance real fields
       as Account Balances, split into standard Debit/Credit columns by
       cell() below — a display convention (positive balance = debit side,
       negative = credit side), not an invented figure. Column set responds
       live to the toggle switches in the toolbar. */
    if (resource === 'trial-balance') return ['account_number', 'account_name',
      ...(tbShowDebit ? ['debit'] : []), ...(tbShowCredit ? ['credit'] : []), ...(tbShowBalance ? ['balance'] : [])];
    /* Tax Rates: real fields are id/code/name/rate/type — the generic
       `preferred` list below has no 'rate'/'type' entries, so it silently
       dropped the rate value entirely (the entire point of this report).
       Verified against actual SmartERP tax records. */
    if (resource === 'tax') return ['code', 'name', 'rate'];
    const preferred = ['id','number','reference','code','name','english_name','company','customer_name','supplier_name','phone','email','city','date','status','quantity','price','total','amount','balance','currency'];
    const present = new Set(records.flatMap(r => r && typeof r === 'object' ? Object.keys(r) : []));
    return preferred.filter(k => present.has(k)).slice(0,8).length ? preferred.filter(k => present.has(k)).slice(0,8) : [...present].slice(0,8);
  },[records,resource,isInvoiceWorkspace,tbShowDebit,tbShowCredit,tbShowBalance]);
  const COLUMN_LABELS = { invoice_number:'Reference', date:'Date', customer:'Customer', subtotal:'Subtotal', vat:'VAT', total:'Total', balance:'Balance', paid:'Paid', paymentStatus:'Payment Status', saleStatus: resource === 'purchases' ? 'Purchase Status' : 'Sale Status', contact_name: resource === 'suppliers' ? 'Supplier' : 'Customer', vat_no:'VAT Number', current_balance:'Balance', name: resource === 'warehouses' ? 'Warehouse' : 'Product', code:'Code', category:'Category', type:'Type', unit:'Unit', cost:'Cost', price:'Sale Price', quantity:'Stock', tax_rate:'Tax', latitude:'Latitude', longitude:'Longitude', account_number:'Account Number', account_name:'Account Name', rate:'Rate', debit:'Debit', credit:'Credit' };
  function resetInvoiceFilters() { setSearch(''); setCustomerFilter(''); setPaymentStatusFilter(''); setSaleStatusFilter(''); setDateFilter({ preset:'all', from:null, to:null }); }

  const relationshipRecordType = resource === 'purchases' ? 'purchase_invoice' : resource === 'sales-invoices' ? 'sales_invoice' : null;
  useEffect(() => {
    if (!selected || !relationshipRecordType) { setRelationship(null); return; }
    fetch(`/api/smartlife/relationships?record_type=${relationshipRecordType}&external_id=${encodeURIComponent(externalId(selected))}`,{credentials:'same-origin'}).then(r=>r.json()).then(setRelationship).catch(()=>setRelationship(null));
  },[selected,resource,relationshipRecordType]);
  useEffect(() => { setPage(0); },[resource,search,status,customerFilter,paymentStatusFilter,saleStatusFilter,dateFilter,categoryFilter,unitFilter,typeFilter,pageSize]);
  useEffect(() => { if(page>=totalPages)setPage(Math.max(0,totalPages-1)); },[page,totalPages]);
  const printBase = resource === 'purchases' ? '/smartlife/purchases' : '/smartlife/sales-invoices';

  async function sync() {
    setBusy(true);
    try { const r=await fetch('/api/smartlife/sync',{method:'POST',credentials:'same-origin'}); const p=await r.json(); if(!r.ok) throw new Error(p.error||'Sync failed.'); toast(`SmartERP synchronized: ${p.records} records`,'emerald'); refresh?.(); refreshSync?.(); }
    catch(e){ toast(e.message,'red'); } finally { setBusy(false); }
  }

  async function connectProject() {
    if(!selected || !projectId) return;
    setBusy(true);
    try { const r=await fetch('/api/smartlife/relationships',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action:'connect-project',resource,source_record:selected,project_id:projectId})}); const p=await r.json(); if(!r.ok) throw new Error(p.error); toast(`Connected to ${p.project.project_name}`,'emerald'); setConnectOpen(false); setRelationship(x=>({...x,connection:p.connection})); }
    catch(e){ toast(e.message||'Could not connect project.','red'); } finally { setBusy(false); }
  }

  /* Reuses the SAME A4 report engine already shared by QuotePro, Projects
     and Cars (each app's lib/reportPdf.js) — no second report design. `action`
     picks Download vs. Print against the exact same generated document
     (see reportPdf.js's own comment on why that guarantees they can never
     look different from each other). */
  async function runReport(action) {
    setReportBusy(action);
    try {
      const completeRecords = await fetchCompleteResource();
      const exportRows = completeRecords.filter(matchesActiveFilters);
      const reportColumns = DOCUMENT_RESOURCES.has(resource)
        ? [
            { key: 'invoice_number', header: 'Invoice #' }, { key: 'customer', header: resource === 'purchases' ? 'Supplier' : 'Customer' },
            { key: 'date', header: 'Date' }, { key: 'total', header: 'Total' },
            { key: 'paid', header: 'Paid' }, { key: 'balance', header: 'Balance' }, { key: 'status', header: 'Status' },
          ]
        : (resource === 'financial-reports'
          ? [{ key: 'report', header: 'Report' }, { key: 'amount', header: 'Amount' }, { key: 'currency', header: 'Currency' }, { key: 'status', header: 'Source' }]
          : columns.map(c => ({ key: c, header: COLUMN_LABELS[c] || c.replaceAll('_', ' ') })));
      const reportRows = DOCUMENT_RESOURCES.has(resource)
        ? exportRows.map(r => { const v = invoiceView(r, resource); return { invoice_number: v.invoice_number, customer: v.customer, date: professionalDate(v.date), total: money(v.total, v.currency), paid: money(v.paid, v.currency), balance: money(v.balance, v.currency), status: resource === 'purchases' ? `${v.paymentStatus} · ${v.saleStatus || '—'}` : v.status }; })
        : ['customers','suppliers','products','warehouses','trial-balance'].includes(resource)
        ? exportRows.map(r => Object.fromEntries(columns.map(c => [c, cell(r, c)])))
        : exportRows;
      /* Active filters are folded into the title itself (the shared report
         engine only takes a single title string) so Print/PDF always shows
         exactly what produced the rows below it — e.g. "Purchase Invoices —
         Period: This Year · Supplier: ... · Status: تم الاستلام". */
      const filterParts = [];
      if (isInvoiceWorkspace) {
        filterParts.push(`Period: ${dateFilterLabel(dateFilter, t, lang)}`);
        if (customerFilter) filterParts.push(`${partyLabel}: ${customerFilter}`);
        if (paymentStatusFilter) filterParts.push(`Payment Status: ${paymentStatusFilter}`);
        if (saleStatusFilter) { const s = saleStatusValues.find(v => v.id === saleStatusFilter); filterParts.push(`${resource==='purchases'?'Purchase':'Sale'} Status: ${s ? s.title : saleStatusFilter}`); }
        if (search.trim()) filterParts.push(`Search: "${search.trim()}"`);
      }
      const title = `AL FAROOQUE ERP — ${LABELS[resource]}` + (filterParts.length ? ` — ${filterParts.join(' · ')}` : '');
      if (action === 'excel') {
        /* Same exportRows/reportColumns/reportRows already computed above for
           PDF — sent to the generic xlsx converter so Excel always matches
           Print/PDF exactly (same filters, same complete dataset, no second
           filter implementation). */
        const res = await fetch('/api/export/xlsx', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ sheetName: LABELS[resource], columns: reportColumns, rows: reportRows, filename: `${resource}-report.xlsx`, rtl: lang === 'ar' }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not generate Excel export.'); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${resource}-report.xlsx`; a.click();
        URL.revokeObjectURL(url);
        return;
      }
      await exportReportPdf({
        title,
        columns: reportColumns, rows: reportRows,
        lang,
        period: isInvoiceWorkspace ? dateFilterLabel(dateFilter, t, lang) : 'Current filtered view',
        source: data?.connected ? 'SmartLife live read-only data' : data?.snapshot_available ? 'SmartLife synchronized snapshot' : 'SmartLife read-only source',
        totals: [['Exported records', String(reportRows.length)]],
        fileName: `${resource}-report.pdf`, action,
      });
    } catch (e) { toast(e.message || 'Could not generate report.', 'red'); }
    finally { setReportBusy(''); }
  }

  /* Single-record Print/PDF for non-document resources (Products,
     Customers, Suppliers, Warehouses, etc.) — reuses the SAME report
     engine and the SAME clean column set as the list view, never
     window.print() on the live app page (that used to print the sidebar,
     modal chrome, and every raw SmartLife field behind it). */
  async function runSingleRecordReport(record) {
    setReportBusy('print');
    try {
      const name = display(first(record, ['name', 'company']));
      await exportReportPdf({
        title: `AL FAROOQUE ERP — ${LABELS[resource]} — ${name}`,
        columns: columns.map(c => ({ key: c, header: COLUMN_LABELS[c] || c.replaceAll('_', ' ') })),
        rows: [Object.fromEntries(columns.map(c => [c, cell(record, c)]))],
        fileName: `${resource}-${externalId(record)}.pdf`, action: 'print',
      });
    } catch (e) { toast(e.message || 'Could not generate the document.', 'red'); }
    finally { setReportBusy(''); }
  }

  function cell(record,column) {
    if (resource === 'customers' || resource === 'suppliers') {
      if (column === 'contact_name') return display(first(record,['name','company']));
      if (column === 'current_balance') return record?.current_balance != null ? money(record.current_balance) : display(null);
      return display(record?.[column]);
    }
    if (resource === 'products') {
      if (column === 'cost' || column === 'price') return record?.[column] != null && Number(record[column]) !== 0 ? money(record[column]) : display(null);
      return display(record?.[column]);
    }
    if (resource === 'account-balances' && column === 'balance') return record?.balance != null ? money(record.balance) : display(null);
    if (resource === 'trial-balance') {
      const balance = Number(record?.balance) || 0;
      if (column === 'debit') return balance >= 0 && balance !== 0 ? money(balance) : display(null);
      if (column === 'credit') return balance < 0 ? money(Math.abs(balance)) : display(null);
      if (column === 'balance') return money(balance);
      return display(record?.[column]);
    }
    if(!DOCUMENT_RESOURCES.has(resource)) return display(record?.[column]);
    const view=invoiceView(record, resource); const key = column === 'supplier' ? 'customer' : column; const value=view[key];
    if (column === 'date' || column === 'due_date') return professionalDate(value);
    return ['total','paid','balance','subtotal','vat'].includes(column) ? money(value,view.currency) : display(value);
  }

  const selectedInvoice = selected && DOCUMENT_RESOURCES.has(resource) ? invoiceView(selected, resource) : null;
  const sourceLastSync = data?.last_synced_at || syncData?.integration?.last_sync_at;
  const lastSync = sourceLastSync ? new Date(sourceLastSync).toLocaleString() : 'Never';

  if (resource === 'financial-reports') {
    return <FinancialReportsView data={data} error={error} loading={loading} lastSync={lastSync} sync={sync} busy={busy} lang={lang} />;
  }
  if (resource === 'product-balances') {
    return <ProductBalancesView data={data} error={error} loading={loading} lastSync={lastSync} sync={sync} busy={busy} lang={lang} />;
  }

  return <div className="space-y-4 print:text-black">
    <PageHeader title={`Accounting / ${isInvoiceWorkspace?LABELS[resource]:'SmartERP'}`} description={isInvoiceWorkspace?'SmartLife source · read only · AL FAROOQUE ERP workspace':'SmartLife source data · AL FAROOQUE ERP workflow relationships'} badge={<GlassBadge tone={data?.connected ? 'emerald':'amber'}>{data?.connected?'Live source':data?.snapshot_available?'Synchronized snapshot':'Read source'}</GlassBadge>} meta={`Last synced ${lastSync}`} actions={<GlassButton onClick={sync} disabled={busy}>{busy?'Synchronizing…':'Refresh / Sync'}</GlassButton>} />
    {/* Cross-module navigation lives in the Accounting sidebar (Shell.js) —
        the old 19-button resource-tab strip duplicated it and ate the whole
        first screen, so it's gone for every resource, not just this one. */}
    {!supported && <GlassCard className="p-6"><h2 className="font-bold text-amber-300">{LABELS[resource]} data is not currently exposed by the SmartERP API</h2><p className="mt-2 text-sm text-[color:var(--tx-3)]">The SmartERP V3 specification provides no read endpoint for this module, and no data is fabricated here. It will activate through the same central connector — with no other change — as soon as SmartERP publishes an official read endpoint.</p></GlassCard>}
    {supported && <GlassCard className="p-4">
      {isInvoiceWorkspace ? (
        <ListToolbar className="mb-4">
          <GlassInput className="min-w-48 flex-1" placeholder={`Search ${resource==='purchases'?'purchase':'invoice'} no., ${partyLabel.toLowerCase()}, reference…`} value={search} onChange={e=>setSearch(e.target.value)}/>
          <DateFilter value={dateFilter} onChange={setDateFilter} t={t} lang={lang}/>
          <GlassInput className="min-w-40" placeholder={`${partyLabel}…`} value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)}/>
          <GlassSelect value={paymentStatusFilter} onChange={e=>setPaymentStatusFilter(e.target.value)}><option value="">All payment statuses</option>{paymentStatusValues.map(s=><option key={s}>{s}</option>)}</GlassSelect>
          <GlassSelect value={saleStatusFilter} onChange={e=>setSaleStatusFilter(e.target.value)}><option value="">{resource==='purchases'?'All purchase statuses':'All statuses'}</option>{saleStatusValues.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</GlassSelect>
          <GlassButton variant="secondary" size="sm" onClick={resetInvoiceFilters}>Reset</GlassButton>
          <GlassButton variant="secondary" onClick={()=>runReport('print')} disabled={!filtered.length||!!reportBusy}>{reportBusy==='print'?'Preparing…':'Print'}</GlassButton>
          <GlassButton variant="secondary" onClick={()=>runReport('save')} disabled={!filtered.length||!!reportBusy}>{reportBusy==='save'?'Generating…':'⤓ Download PDF'}</GlassButton>
          <GlassButton variant="secondary" onClick={()=>runReport('excel')} disabled={!filtered.length||!!reportBusy}>{reportBusy==='excel'?'Generating…':'⤓ Download Excel'}</GlassButton>
        </ListToolbar>
      ) : (
        <ListToolbar className="mb-4">
          <GlassInput className="min-w-56 flex-1" placeholder={`Search ${LABELS[resource]}…`} value={search} onChange={e=>setSearch(e.target.value)}/>
          {resource==='products' ? (<>
            <GlassSelect value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">All categories</option>{categoryValues.map(c=><option key={c}>{c}</option>)}</GlassSelect>
            <GlassSelect value={unitFilter} onChange={e=>setUnitFilter(e.target.value)}><option value="">All units</option>{unitValues.map(u=><option key={u}>{u}</option>)}</GlassSelect>
            <GlassSelect value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">All types</option>{typeValues.map(t=><option key={t}>{t}</option>)}</GlassSelect>
            <GlassButton variant="secondary" size="sm" onClick={()=>{setSearch('');setCategoryFilter('');setUnitFilter('');setTypeFilter('');}}>Reset</GlassButton>
          </>) : resource==='trial-balance' ? (<>
            <label className="flex items-center gap-1.5 text-xs text-[color:var(--tx-3)]"><input type="checkbox" checked={tbShowDebit} onChange={e=>setTbShowDebit(e.target.checked)}/> Debit</label>
            <label className="flex items-center gap-1.5 text-xs text-[color:var(--tx-3)]"><input type="checkbox" checked={tbShowCredit} onChange={e=>setTbShowCredit(e.target.checked)}/> Credit</label>
            <label className="flex items-center gap-1.5 text-xs text-[color:var(--tx-3)]"><input type="checkbox" checked={tbShowBalance} onChange={e=>setTbShowBalance(e.target.checked)}/> Balance</label>
          </>) : (!['customers','suppliers','warehouses'].includes(resource) && <GlassSelect value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{statusValues.map(s=><option key={s}>{s}</option>)}</GlassSelect>)}
          <GlassButton variant="secondary" onClick={()=>runReport('print')} disabled={!filtered.length||!!reportBusy}>{reportBusy==='print'?'Preparing…':'Print'}</GlassButton>
          <GlassButton variant="secondary" onClick={()=>runReport('save')} disabled={!filtered.length||!!reportBusy}>{reportBusy==='save'?'Generating…':'⤓ Download PDF'}</GlassButton>
          <GlassButton variant="secondary" onClick={()=>runReport('excel')} disabled={!filtered.length||!!reportBusy}>{reportBusy==='excel'?'Generating…':'⤓ Download Excel'}</GlassButton>
        </ListToolbar>
      )}
      {(error||data?.connected===false)&&(()=>{
        const tone = data?.permission_required ? 'amber' : (data?.endpoint_unavailable ? 'amber' : 'red');
        const title = data?.permission_required ? 'Permission required'
          : data?.endpoint_unavailable ? 'Endpoint not available'
          : data?.connection_error ? 'Connection error'
          : 'SmartERP error';
        const body = data?.permission_required
          ? `SmartERP has authenticated this account but has not granted it access to ${LABELS[resource]}. Grant this module's permission to the API user in SmartERP — no change is needed here once that's done.`
          : data?.endpoint_unavailable
          ? `SmartERP returned an unexpected (non-JSON) response for ${LABELS[resource]} — this usually means the endpoint path doesn't exist at the connected API version.`
          : data?.connection_error
          ? 'Could not reach SmartERP over the network. It may be temporarily down or unreachable from this server.'
          : (data?.error||error);
        return <div className={`rounded-xl border p-4 ${tone==='amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}><div className="font-semibold">{title}</div><div className="mt-1 text-sm">{body}</div>{data?.snapshot_available&&<div className="mt-2 text-sm font-semibold">Showing the latest synchronized local snapshot from {lastSync}; it is not being presented as live data.</div>}</div>;
      })()}
      {loading&&<div className="py-8 text-center text-[color:var(--tx-3)]">Loading latest SmartERP data…</div>}
      {!loading&&data?.connected&&!filtered.length&&<div className="py-8 text-center text-[color:var(--tx-3)]">No SmartERP records matched this view.</div>}
      {!loading&&data?.connected&&!!filtered.length&&<div className="mb-2 text-xs text-[color:var(--tx-3)]">Showing {page * pageSize + 1}–{Math.min(page * pageSize + filtered.length,totalRecords)} of {totalRecords}{usingCompleteFilterSet?' matched records':Number(data.total)>records.length?' SmartERP records':' records'}</div>}
      {/* Summary must reflect the COMPLETE (optionally search-filtered)
         790-account dataset, never just the current 25/50/100/500 visible
         page — reuses filterUniverse (background-fetched for trial-balance
         same as isInvoiceWorkspace resources) filtered with the exact same
         search predicate the table itself uses, so page size never changes
         these totals. */}
      {resource==='trial-balance'&&!loading&&!!filtered.length&&(()=>{
        if(!filterUniverse.length) return <div className="mb-3 rounded-xl border border-[color:var(--bd)] p-3 text-sm text-[color:var(--tx-3)] print:hidden">Loading complete totals…</div>;
        const needle=search.trim().toLowerCase();
        const summarySource=needle?filterUniverse.filter(r=>searchable(r,resource).includes(needle)):filterUniverse;
        const debit=summarySource.reduce((acc,r)=>acc+Math.max(0,Number(r?.balance)||0),0);
        const credit=summarySource.reduce((acc,r)=>acc+Math.max(0,-(Number(r?.balance)||0)),0);
        return <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-[color:var(--bd)] p-3 text-sm sm:grid-cols-2 print:hidden">
          <Metric label="Total Debit" value={money(debit)}/>
          <Metric label="Total Credit" value={money(credit)}/>
        </div>;
      })()}
      {/* Summary must reflect the COMPLETE filtered dataset, never just the
         current 25/50/100/500 visible page — reuses filterUniverse (already
         background-fetched for isInvoiceWorkspace regardless of filters, so
         no extra request here) filtered with the exact same
         matchesActiveFilters() predicate the complete-dataset export uses,
         guaranteeing the summary, the export, and "Showing X of N" all agree
         on one definition of "the current dataset". Gated on
         filterUniverse.length so it never briefly shows a page-only total
         while the complete set is still loading. */}
      {isInvoiceWorkspace&&!loading&&!!filtered.length&&(()=>{
        if(!filterUniverse.length) return <div className="mb-3 rounded-xl border border-[color:var(--bd)] p-3 text-sm text-[color:var(--tx-3)] print:hidden">Loading complete totals…</div>;
        const summarySource=filterUniverse.filter(matchesActiveFilters);
        const rows=summarySource.map(r=>invoiceView(r,resource)); const currency=rows[0]?.currency||filtered[0]?.currency||'SAR';
        const sum=key=>rows.reduce((acc,v)=>acc+(Number(v[key])||0),0);
        return <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-[color:var(--bd)] p-3 text-sm sm:grid-cols-4 print:hidden">
          <Metric label="Subtotal" value={money(sum('subtotal'),currency)}/>
          <Metric label="VAT" value={money(sum('vat'),currency)}/>
          <Metric label="Total" value={money(sum('total'),currency)}/>
          <Metric label="Paid / Balance" value={`${money(sum('paid'),currency)} / ${money(sum('balance'),currency)}`}/>
        </div>;
      })()}
      {!!filtered.length&&<div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[color:var(--bd)]">{columns.map(c=><th key={c} className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">{c==='customer'?partyLabel:(COLUMN_LABELS[c] || c.replaceAll('_',' '))}</th>)}<th className="print:hidden">Actions</th></tr></thead><tbody>{filtered.map((record,index)=><tr key={externalId(record)||index} className="border-b border-[color:var(--bd)]">{columns.map(c=><td key={c} className="max-w-64 truncate p-3">{cell(record,c)}</td>)}<td className="p-3 print:hidden"><div className="flex gap-1"><GlassButton variant="secondary" size="sm" onClick={()=>setSelected(record)}>View</GlassButton>{DOCUMENT_RESOURCES.has(resource)&&<a href={`${printBase}/${externalId(record)}/print`} target="_blank" rel="noreferrer"><GlassButton variant="secondary" size="sm">PDF</GlassButton></a>}{DOCUMENT_RESOURCES.has(resource)&&<GlassButton size="sm" onClick={()=>{setSelected(record);setProjectId('');setConnectOpen(true);}}>Connect Project</GlassButton>}</div></td></tr>)}</tbody></table></div>}
      {resource!=='financial-reports'&&resource!=='product-balances'&&totalRecords>0&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="text-xs text-[color:var(--tx-3)] flex items-center gap-3 flex-wrap">
          <span>Showing {Math.min(page*pageSize+1,totalRecords)}–{Math.min((page+1)*pageSize,totalRecords)} of {totalRecords} {usingCompleteFilterSet?'matched':'source'} records</span>
          <span className="flex items-center gap-1.5">Rows per page:
            <GlassSelect value={String(pageSize)} onChange={e=>{setPageSize(Number(e.target.value));setPage(0);}} className="w-20">
              <option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="500">500</option>
            </GlassSelect>
          </span>
        </div>
        <div className="flex gap-2">
          <GlassButton variant="secondary" size="sm" disabled={page===0} onClick={()=>setPage(0)}>First</GlassButton>
          <GlassButton variant="secondary" size="sm" disabled={page===0} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous</GlassButton>
          <span className="px-2 text-xs self-center text-[color:var(--tx-3)]">Page {page+1} of {totalPages}</span>
          <GlassButton variant="secondary" size="sm" disabled={page+1>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages-1,value+1))}>Next</GlassButton>
          <GlassButton variant="secondary" size="sm" disabled={page+1>=totalPages} onClick={()=>setPage(totalPages-1)}>Last</GlassButton>
        </div>
      </div>}
    </GlassCard>}
    {selected&&<GlassModal title={selected&&(resource==='products'||resource==='customers'||resource==='suppliers'||resource==='warehouses')?display(first(selected,['name','company']))+` — ${LABELS[resource]}`:`${LABELS[resource]} record`} onClose={()=>setSelected(null)} wide footer={<div className="flex justify-end gap-2">{DOCUMENT_RESOURCES.has(resource)?<a href={`${printBase}/${externalId(selected)}/print`} target="_blank" rel="noreferrer"><GlassButton variant="secondary">Open {resource==='purchases'?'Purchase':'Invoice'} Document · Print / PDF</GlassButton></a>:<GlassButton variant="secondary" onClick={()=>runSingleRecordReport(selected)} disabled={!!reportBusy}>{reportBusy?'Preparing…':'Print / Download PDF'}</GlassButton>}<GlassButton variant="secondary" onClick={()=>setSelected(null)}>Close</GlassButton></div>}>
      {selectedInvoice&&<><div className="mb-5 flex items-start justify-between border-b border-cyan-600 pb-4"><div><div className="text-lg font-black text-cyan-700">AL FAROOQUE WOOD WORKS FACTORY</div><div className="text-xs text-[color:var(--tx-3)]">AL FAROOQUE ERP · Accounting</div></div><div className="text-end"><div className="text-xl font-black">{resource==='purchases'?'PURCHASE INVOICE':'SALES INVOICE'}</div><div className="text-xs">SmartLife source · read only</div></div></div><div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-[color:var(--bd)] p-4 sm:grid-cols-4"><Metric label="Invoice" value={selectedInvoice.invoice_number}/><Metric label={resource==='purchases'?'Supplier':'Customer'} value={selectedInvoice.customer}/><Metric label="Grand total" value={money(selectedInvoice.total,selectedInvoice.currency)}/><Metric label="Paid / Balance" value={`${money(selectedInvoice.paid,selectedInvoice.currency)} / ${money(selectedInvoice.balance,selectedInvoice.currency)}`}/><Metric label="Payment Status" value={selectedInvoice.status}/>{resource==='purchases'&&<Metric label="Purchase Status" value={selectedInvoice.saleStatus}/>}<Metric label="SmartLife ID" value={selectedInvoice.external_id}/><Metric label="Project" value={relationship?.connection?.project_id?'Connected':'Not connected'}/><Metric label="Local payments" value={relationship?.payments?.length||0}/></div>{resource==='sales-invoices'&&<div className="mb-4 flex justify-end rounded-xl border border-[color:var(--bd)] bg-white p-3"><ZatcaQr invoiceId={selectedInvoice.external_id} size={132}/></div>}{relationship?.connection?.project_id&&<div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm"><span>Connected project: </span><a className="font-semibold text-cyan-500 hover:underline" href={`${getAppUrl('projects')}/projects/${relationship.connection.project_id}`}>{relationship.projects?.find(p=>p.id===relationship.connection.project_id)?.project_name||relationship.connection.project_id}</a></div>}{Array.isArray(selected.items)&&selected.items.length>0&&<div className="mb-4"><h3 className="mb-2 font-semibold">Invoice items · SmartERP source ({selected.items.length})</h3><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[color:var(--bd)]"><th className="p-2 text-start text-xs uppercase text-[color:var(--tx-3)]">Code</th><th className="p-2 text-start text-xs uppercase text-[color:var(--tx-3)]">Product</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Qty</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Unit price</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Discount</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Tax %</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Total</th></tr></thead><tbody>{selected.items.map((item,index)=><tr key={`${item.product_id||index}-${index}`} className="border-b border-[color:var(--bd)]"><td className="p-2">{display(item.product_code)}</td><td className="p-2">{display(item.product_name)}</td><td className="p-2 text-end">{display(item.unit_quantity??item.quantity)}</td><td className="p-2 text-end">{money(item.unit_price,selectedInvoice.currency)}</td><td className="p-2 text-end">{money(item.discount,selectedInvoice.currency)}</td><td className="p-2 text-end">{display(item.tax)}</td><td className="p-2 text-end">{money(item.total,selectedInvoice.currency)}</td></tr>)}</tbody></table></div><div className="mt-2 grid gap-2 text-sm sm:grid-cols-4"><Metric label="Net total" value={money(first(selected,['total'])||0,selectedInvoice.currency)}/><Metric label="Total discount" value={money(first(selected,['total_discount'])||0,selectedInvoice.currency)}/><Metric label="Total tax (VAT)" value={money(first(selected,['total_tax'])||0,selectedInvoice.currency)}/><Metric label="Shipping" value={money(first(selected,['total_shipping'])||0,selectedInvoice.currency)}/></div></div>}
      {!!relationship?.payments?.length&&<div className="mb-4"><h3 className="mb-2 font-semibold">ERP payment history</h3><div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-start">Date</th><th className="p-2 text-start">Amount</th><th className="p-2 text-start">Method</th><th className="p-2 text-start">Reference</th></tr></thead><tbody>{relationship.payments.map(payment=><tr key={payment.id} className="border-t border-[color:var(--bd)]"><td className="p-2">{payment.payment_date}</td><td className="p-2">{money(payment.amount,selectedInvoice.currency)}</td><td className="p-2">{payment.payment_method||'—'}</td><td className="p-2">{payment.reference||'—'}</td></tr>)}</tbody></table></div></div>}</>}
      {['products','customers','suppliers','warehouses'].includes(resource) ? (
        <dl className="grid gap-3 md:grid-cols-2">{columns.map(c=><div key={c} className="border-b border-[color:var(--bd)] pb-2"><dt className="text-xs uppercase text-[color:var(--tx-3)]">{COLUMN_LABELS[c]||c.replaceAll('_',' ')}</dt><dd className="mt-1 break-words">{cell(selected,c)}</dd></div>)}</dl>
      ) : !selectedInvoice && (
        /* True fallback for simple master-data resources (categories, units,
           brands, tax, etc.) with only a handful of real fields — a raw
           key/value list is acceptable here since these are not
           SmartLife's rich transactional records. */
        <dl className="grid gap-3 md:grid-cols-2">{Object.entries(selected).filter(([k])=>typeof selected[k]!=='object').map(([key,value])=><div key={key} className="border-b border-[color:var(--bd)] pb-2"><dt className="text-xs uppercase text-[color:var(--tx-3)]">{key.replaceAll('_',' ')}</dt><dd className="mt-1 break-words">{display(value)}</dd></div>)}</dl>
      )}
    </GlassModal>}
    {connectOpen&&selected&&<GlassModal title={`Connect ${resource==='purchases'?'Purchase':'Sales'} Invoice to Project`} onClose={()=>setConnectOpen(false)} footer={<div className="flex justify-end gap-2"><GlassButton variant="secondary" onClick={()=>setConnectOpen(false)}>Cancel</GlassButton><GlassButton onClick={connectProject} disabled={!projectId||busy}>{busy?'Connecting…':'Connect'}</GlassButton></div>}><div className="space-y-4"><div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm">This stores only an AL FAROOQUE ERP relationship. The original SmartLife record remains unchanged.</div><GlassSelect value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Select project…</option>{(relationship?.projects||[]).map(p=><option key={p.id} value={p.id}>{p.project_name} · {p.customer_name||'No customer'}</option>)}</GlassSelect></div></GlassModal>}
  </div>;
}

function Metric({label,value}) { return <div><div className="text-xs text-[color:var(--tx-4)]">{label}</div><div className="mt-1 font-semibold">{isValidElement(value) ? value : display(value)}</div></div>; }

/* Product Balances — SmartERP's `products/products_balance` endpoint (verified
   V3 spec) returns ONE aggregate record (total_products, total_quantity,
   purchasing_price_value, sale_price_value), not a per-product list. Shown
   as a summary card, never fabricated into a fake per-product table. */
function ProductBalancesView({ data, error, loading, lastSync, sync, busy, lang }) {
  const [reportBusy, setReportBusy] = useState('');
  const { data: movementData } = useLiveData('/api/smartlife/inventory-movements', 0);
  const movements = Array.isArray(movementData?.records) ? movementData.records : [];
  const record = Array.isArray(data?.records) ? data.records[0] : null;
  const totalProducts = record ? first(record, ['total_products']) : null;
  const totalQuantity = record ? first(record, ['total_quantity']) : null;
  const purchasingValue = record ? first(record, ['purchasing_price_value', 'purchasing_price_value ']) : null;
  const saleValue = record ? first(record, ['sale_price_value', 'sale_price_value ']) : null;
  const potentialProfit = (purchasingValue != null && saleValue != null) ? Number(saleValue) - Number(purchasingValue) : null;

  async function runReport(action) {
    setReportBusy(action);
    try {
      const rows = [
        ['Total Products', totalProducts], ['Total Quantity', totalQuantity],
        ['Purchasing Value', purchasingValue], ['Sale Value', saleValue], ['Potential Profit', potentialProfit],
      ].map(([metric, value]) => ({ metric, amount: value == null ? 'Data not available' : (metric.includes('Value') || metric.includes('Profit') ? money(value) : display(value)) }));
      await exportReportPdf({
        title: 'AL FAROOQUE ERP — Product Balances', period: 'Current synchronized snapshot',
        source: data?.connected ? 'SmartLife live read-only data' : 'SmartLife read-only source',
        columns: [{ key: 'metric', header: 'Metric' }, { key: 'amount', header: 'Amount' }], rows,
        lang, fileName: 'product-balances-report.pdf', action,
      });
    } catch (e) { toast(e.message || 'Could not generate report.', 'red'); }
    finally { setReportBusy(''); }
  }

  return <div className="space-y-4 print:text-black">
    <PageHeader title="Accounting / Product Balances" description="SmartLife source · read only · aggregate stock valuation" badge={<GlassBadge tone={data?.connected ? 'emerald' : 'amber'}>{data?.connected ? 'Live source' : 'Read source'}</GlassBadge>} meta={`Last synced ${lastSync}`} actions={<><GlassButton variant="secondary" disabled={!record || !!reportBusy} onClick={() => runReport('print')}>{reportBusy === 'print' ? 'Preparing…' : 'Print'}</GlassButton><GlassButton variant="secondary" disabled={!record || !!reportBusy} onClick={() => runReport('save')}>{reportBusy === 'save' ? 'Generating…' : '⤓ Download PDF'}</GlassButton><GlassButton onClick={sync} disabled={busy}>{busy ? 'Synchronizing…' : 'Refresh / Sync'}</GlassButton></>} />
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Could not load product balances.</div>}
    {loading && !data && <div className="py-8 text-center text-[color:var(--tx-3)]">Loading…</div>}
    {data && !record && <GlassCard className="p-6"><p className="text-[color:var(--tx-3)]">No data available from SmartLife for this report.</p></GlassCard>}
    {record && <GlassCard className="p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total Products" value={totalProducts != null ? Number(totalProducts).toLocaleString() : <span className="text-[color:var(--tx-4)]">Data not available</span>} />
        <Metric label="Total Quantity" value={totalQuantity != null ? Number(totalQuantity).toLocaleString() : <span className="text-[color:var(--tx-4)]">Data not available</span>} />
        <Metric label="Purchasing Value" value={purchasingValue != null ? money(purchasingValue) : <span className="text-[color:var(--tx-4)]">Data not available</span>} />
        <Metric label="Sale Value" value={saleValue != null ? money(saleValue) : <span className="text-[color:var(--tx-4)]">Data not available</span>} />
        {potentialProfit != null && <Metric label="Potential Profit" value={money(potentialProfit)} />}
      </div>
      <p className="mt-3 text-[11px] text-[color:var(--tx-4)]">Aggregate stock valuation across all products, as reported by SmartLife — not a per-product breakdown.</p>
    </GlassCard>}
    {!!movements.length && <GlassCard className="p-4">
      <h3 className="mb-1 text-sm font-semibold text-[color:var(--tx-2)]">Inventory Movement — Monthly Cost</h3>
      <p className="mb-3 text-xs text-[color:var(--tx-4)]">SmartLife reports this as a monthly total, not a daily transaction ledger.</p>
      <table className="w-full text-sm"><thead><tr className="border-b border-[color:var(--bd)]"><th className="p-2 text-start text-xs uppercase text-[color:var(--tx-3)]">Period</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Total Cost</th></tr></thead>
      <tbody>{movements.map((m,i) => <tr key={i} className="border-b border-[color:var(--bd)]"><td className="p-2">{m.date || `${m.from} – ${m.to}`}</td><td className="p-2 text-end" dir="ltr">{money(m.total_cost)}</td></tr>)}</tbody></table>
    </GlassCard>}
  </div>;
}

/* Professional Financial Reports hub — real business report CATEGORIES,
   not raw source-record rows. Replaces the old generic table (which
   showed "SmartLife synchronized source" as if it were a report name and
   leaked unrounded floats like 3174553.7899999972). Money is centrally
   formatted here; unavailable data shows an explicit label, never a
   fabricated number or a silent zero. */
function KpiValue({ value }) {
  if (value == null) return <span className="text-[color:var(--tx-4)]">Data not available</span>;
  return <span>{money(value)}</span>;
}

function FinancialReportsView({ data, error, loading, lastSync, sync, busy, lang }) {
  const [search, setSearch] = useState('');
  const [reportBusy, setReportBusy] = useState('');
  const kpis = data?.kpis || {};
  const categories = data?.categories || [];
  const filteredCategories = categories.map(cat => ({
    ...cat,
    reports: cat.reports.filter(r => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase())),
  })).filter(cat => cat.reports.length);

  async function runSummary(action) {
    setReportBusy(action);
    try {
      const rows = [
        ['Total Sales', kpis.totalSales], ['Total Purchases', kpis.totalPurchases], ['Gross Profit', kpis.grossProfit],
        ['Receivables', kpis.receivables], ['Payables', kpis.payables], ['Sales VAT', kpis.salesVat],
        ['Purchase VAT', kpis.purchaseVat], ['Net VAT', kpis.netVat],
      ].map(([metric, value]) => ({ metric, amount: value == null ? 'Data not available' : money(value) }));
      await exportReportPdf({
        title: 'Financial Reports Summary', period: 'All available synchronized dates', source: data?.source,
        summary: rows.filter(row => row.amount !== 'Data not available').slice(0, 5).map(row => [row.metric, row.amount]),
        columns: [{ key: 'metric', header: 'Metric' }, { key: 'amount', header: 'Amount' }], rows,
        totals: [['Available report categories', String(categories.length)]], lang,
        fileName: 'financial-reports-summary.pdf', action,
      });
    } catch (e) { toast(e.message || 'Could not generate financial report.', 'red'); }
    finally { setReportBusy(''); }
  }

  return <div className="space-y-4">
    <PageHeader title="Accounting / Financial Reports" description="Financial reporting and business performance" badge={<GlassBadge tone={data?.connected ? 'emerald' : 'amber'}>{data?.connected ? 'Live source' : 'Synchronized snapshot'}</GlassBadge>} meta={`Last synced ${lastSync}`} actions={<><GlassButton variant="secondary" disabled={!data || !!reportBusy} onClick={() => runSummary('print')}>{reportBusy === 'print' ? 'Preparing…' : 'Print Summary'}</GlassButton><GlassButton variant="secondary" disabled={!data || !!reportBusy} onClick={() => runSummary('save')}>{reportBusy === 'save' ? 'Generating…' : 'Download PDF'}</GlassButton><GlassButton onClick={sync} disabled={busy}>{busy ? 'Synchronizing…' : 'Refresh / Sync'}</GlassButton></>} />

    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Could not load financial reports.</div>}
    {loading && !data && <div className="py-8 text-center text-[color:var(--tx-3)]">Loading…</div>}

    {data && <>
      <GlassCard className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total Sales" value={<KpiValue value={kpis.totalSales} />} />
          <Metric label="Total Purchases" value={<KpiValue value={kpis.totalPurchases} />} />
          <Metric label="Gross Profit" value={<KpiValue value={kpis.grossProfit} />} />
          <Metric label="Receivables" value={<KpiValue value={kpis.receivables} />} />
          <Metric label="Payables" value={<KpiValue value={kpis.payables} />} />
          <Metric label="Sales VAT" value={<KpiValue value={kpis.salesVat} />} />
          <Metric label="Purchase VAT" value={<KpiValue value={kpis.purchaseVat} />} />
          <Metric label="Net VAT" value={<KpiValue value={kpis.netVat} />} />
        </div>
        <p className="mt-3 text-[11px] text-[color:var(--tx-4)]">Data source: SmartLife synchronized data + AL FAROOQUE ERP local records. "Data not available" means no synchronized records currently exist for that figure — it is not treated as zero.</p>
      </GlassCard>

      <GlassInput className="max-w-xs" placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)} />

      {filteredCategories.map(cat => (
        <div key={cat.key}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--tx-3)]">{cat.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cat.reports.map(r => (
              <GlassCard key={r.key} className="p-4">
                <div className="font-semibold text-[color:var(--tx)]">{r.name}</div>
                <div className="mt-1 text-xs text-[color:var(--tx-3)]">{r.description}</div>
                <div className="mt-3 flex gap-2">
                  {r.available && r.href
                    ? <a href={r.href}><GlassButton size="sm">View</GlassButton></a>
                    : r.available && r.crossApp
                    ? <a href={`${getAppUrl(r.crossApp)}${r.crossAppPath || ''}`} target="_blank" rel="noreferrer"><GlassButton size="sm">Open in {r.crossApp === 'projects' ? 'ProTrack' : r.crossApp}</GlassButton></a>
                    : <GlassButton size="sm" disabled>{r.available ? 'Shown above' : 'Not available from SmartLife'}</GlassButton>}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      ))}
    </>}
  </div>;
}
