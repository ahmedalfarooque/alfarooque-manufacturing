'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassModal, GlassSelect, toast } from '@/components/glass';
import { getAppUrl } from '@/lib/appLinks';

/* `supported` reflects the SmartERP v1.0 API documentation, verified against the
   live API. Purchases, purchase orders/requests, goods receiving, and a
   standalone payment-transaction list have no documented read endpoint — every
   candidate path returns a non-JSON 404 body — so they stay unsupported rather
   than being fabricated. */
const MODULES = [
  { key:'sales-invoices', label:'Sales Invoices', group:'Sales', supported:true },
  { key:'customers', label:'Customers', group:'Sales', supported:true },
  { key:'purchase-invoices', label:'Purchase Invoices', group:'Purchases', supported:false },
  { key:'payments', label:'Payments', group:'Financial', supported:false },
  { key:'expenses', label:'Expenses', group:'Financial', supported:true },
  { key:'suppliers', label:'Suppliers', group:'Purchases', supported:true },
  { key:'products', label:'Products', group:'Source', supported:true },
  { key:'categories', label:'Categories', group:'Source', supported:true },
  { key:'units', label:'Units', group:'Source', supported:true },
  { key:'brands', label:'Brands', group:'Source', supported:true },
  { key:'warehouses', label:'Warehouses', group:'Source', supported:true },
  { key:'tax', label:'Tax Rates', group:'Financial', supported:true },
  { key:'financial-reports', label:'Financial Reports', group:'Financial', supported:true },
];
const LABELS = Object.fromEntries(MODULES.map(item => [item.key,item.label]));
const SUPPORTED = new Set(MODULES.filter(item => item.supported).map(item => item.key));

function first(record, keys) { for (const key of keys) if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key]; return null; }
function display(value) { if (value == null || value === '') return '—'; if (typeof value === 'object') return JSON.stringify(value); return String(value); }
function money(value, currency = 'SAR') { return `${Number(value || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`; }
function externalId(record) { return String(first(record,['id','invoice_id','expense_id','uuid','reference_no','number','invoice_number','reference']) || ''); }
function searchable(record) { try { return JSON.stringify(record).toLowerCase(); } catch (_) { return ''; } }

function invoiceView(record) {
  const total = Number(first(record,['grand_total','total_amount','total','net_total','amount']) || 0);
  const paid = Number(first(record,['paid_amount','amount_paid','paid','payment_total']) || 0);
  const balanceValue = first(record,['balance_amount','remaining_balance','balance','due_amount']);
  return {
    external_id:externalId(record), invoice_number:first(record,['reference_no','invoice_number','number','reference','code']),
    customer:first(record,['customer','customer_name','party_name']), date:first(record,['invoice_date','date','created_at']),
    due_date:first(record,['due_date','payment_due_date']), subtotal:Number(first(record,['total','subtotal','sub_total','net_amount']) || 0),
    vat:Number(first(record,['total_tax','vat_amount','tax_amount','vat','tax']) || 0), total, paid,
    balance:balanceValue == null ? Math.max(total-paid,0) : Number(balanceValue || 0),
    status:first(record,['payment_status','status','invoice_status']) || (paid >= total && total ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid'),
    currency:String(first(record,['currency','currency_code']) || 'SAR'),
  };
}

export default function SmartLifeResourcePage({ params }) {
  const resource = LABELS[params.resource] ? params.resource : 'sales-invoices';
  const supported = SUPPORTED.has(resource);
  const [search,setSearch] = useState(''); const [status,setStatus] = useState(''); const [selected,setSelected] = useState(null);
  const [connectOpen,setConnectOpen] = useState(false); const [projectId,setProjectId] = useState(''); const [relationship,setRelationship] = useState(null); const [busy,setBusy] = useState(false);
  const dataUrl=resource==='financial-reports'?'/api/smartlife/reports':`/api/smartlife/${resource}`;
  const { data,error,loading,refresh } = useLiveData(dataUrl,supported?30000:0);
  const { data:syncData,refresh:refreshSync } = useLiveData('/api/smartlife/sync',15000);
  const records = Array.isArray(data?.records) ? data.records : [];
  const statusValues = useMemo(() => [...new Set(records.map(r => r?.status || r?.payment_status).filter(Boolean).map(String))],[records]);
  const filtered = useMemo(() => records.filter(record => (!search || searchable(record).includes(search.toLowerCase())) && (!status || String(record?.status || record?.payment_status || '') === status)),[records,search,status]);
  const columns = useMemo(() => {
    if (resource === 'sales-invoices') return ['invoice_number','customer','date','due_date','total','paid','balance','status'];
    const preferred = ['id','number','reference','code','name','english_name','company','customer_name','supplier_name','phone','email','city','date','status','quantity','price','total','amount','balance','currency'];
    const present = new Set(records.flatMap(r => r && typeof r === 'object' ? Object.keys(r) : []));
    return preferred.filter(k => present.has(k)).slice(0,8).length ? preferred.filter(k => present.has(k)).slice(0,8) : [...present].slice(0,8);
  },[records,resource]);

  useEffect(() => {
    if (!selected || resource !== 'sales-invoices') { setRelationship(null); return; }
    fetch(`/api/smartlife/relationships?record_type=sales_invoice&external_id=${encodeURIComponent(externalId(selected))}`,{credentials:'same-origin'}).then(r=>r.json()).then(setRelationship).catch(()=>setRelationship(null));
  },[selected,resource]);

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

  function cell(record,column) {
    if(resource!=='sales-invoices') return display(record?.[column]);
    const view=invoiceView(record); const value=view[column];
    return ['total','paid','balance'].includes(column) ? money(value,view.currency) : display(value);
  }

  const selectedInvoice = selected && resource === 'sales-invoices' ? invoiceView(selected) : null;
  const lastSync = syncData?.integration?.last_sync_at ? new Date(syncData.integration.last_sync_at).toLocaleString() : 'Never';
  return <div className="space-y-4 print:text-black">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><div><h1 className="text-2xl font-bold text-[color:var(--tx)]">Accounting / SmartERP</h1><p className="text-sm text-[color:var(--tx-3)]">SmartLife source data · AL FAROOQUE ERP workflow relationships</p></div><div className="flex items-center gap-2"><GlassBadge tone={data?.connected ? 'emerald':'amber'}>{data?.connected?'Connected':'Read source'}</GlassBadge><GlassButton onClick={sync} disabled={busy}>{busy?'Synchronizing…':'Refresh / Sync'}</GlassButton></div></div>
    <GlassCard className="p-4 print:hidden"><div className="grid gap-2 text-xs sm:grid-cols-3"><div><span className="text-[color:var(--tx-4)]">Last synchronized</span><div>{lastSync}</div></div><div><span className="text-[color:var(--tx-4)]">Direction</span><div>SmartLife → AL FAROOQUE ERP (read only)</div></div><div><span className="text-[color:var(--tx-4)]">Source write-back</span><div className="font-semibold text-red-400">Disabled</div></div></div></GlassCard>
    <div className="flex flex-wrap gap-2 print:hidden">{MODULES.map(item=><Link key={item.key} href={`/smartlife/${item.key}`}><GlassButton variant={item.key===resource?'primary':'secondary'} size="sm">{item.label}{!item.supported?' · Awaiting API':''}</GlassButton></Link>)}</div>
    {!supported && <GlassCard className="p-6"><h2 className="font-bold text-amber-300">{LABELS[resource]} data is not currently exposed by the SmartERP API</h2><p className="mt-2 text-sm text-[color:var(--tx-3)]">The SmartERP v1.0 documentation provides no read endpoint for this module, and no data is fabricated here. It will activate through the same central connector — with no other change — as soon as SmartERP publishes an official read endpoint.</p></GlassCard>}
    {supported && <GlassCard className="p-4"><div className="mb-4 flex flex-wrap gap-3 print:hidden"><GlassInput className="min-w-56 flex-1" placeholder={`Search ${LABELS[resource]}…`} value={search} onChange={e=>setSearch(e.target.value)}/><GlassSelect value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{statusValues.map(s=><option key={s}>{s}</option>)}</GlassSelect><GlassButton variant="secondary" onClick={()=>window.print()} disabled={!filtered.length}>Print / PDF</GlassButton></div>
      {(error||data?.connected===false)&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300"><div className="font-semibold">SmartERP connection unavailable.</div><div className="mt-1 text-sm">{data?.error||error}</div></div>}
      {loading&&<div className="py-8 text-center text-[color:var(--tx-3)]">Loading latest SmartERP data…</div>}
      {!loading&&data?.connected&&!filtered.length&&<div className="py-8 text-center text-[color:var(--tx-3)]">No SmartERP records matched this view.</div>}
      {!loading&&data?.connected&&!!filtered.length&&<div className="mb-2 text-xs text-[color:var(--tx-3)]">Showing {filtered.length}{records.length!==filtered.length?` of ${records.length} loaded`:''}{Number(data.total)>records.length?` · ${data.total} available in SmartERP`:''}</div>}
      {!!filtered.length&&<div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[color:var(--bd)]">{columns.map(c=><th key={c} className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">{c.replaceAll('_',' ')}</th>)}<th className="print:hidden">Actions</th></tr></thead><tbody>{filtered.map((record,index)=><tr key={externalId(record)||index} className="border-b border-[color:var(--bd)]">{columns.map(c=><td key={c} className="max-w-64 truncate p-3">{cell(record,c)}</td>)}<td className="p-3 print:hidden"><div className="flex gap-1"><GlassButton variant="secondary" size="sm" onClick={()=>setSelected(record)}>View</GlassButton>{resource==='sales-invoices'&&<GlassButton size="sm" onClick={()=>{setSelected(record);setProjectId('');setConnectOpen(true);}}>Connect Project</GlassButton>}</div></td></tr>)}</tbody></table></div>}
    </GlassCard>}
    {selected&&<GlassModal title={`${LABELS[resource]} — SmartERP source record`} onClose={()=>setSelected(null)} wide footer={<div className="flex justify-end gap-2"><GlassButton variant="secondary" onClick={()=>window.print()}>Print / Download PDF</GlassButton><GlassButton variant="secondary" onClick={()=>setSelected(null)}>Close</GlassButton></div>}>
      {selectedInvoice&&<><div className="mb-5 flex items-start justify-between border-b border-cyan-600 pb-4"><div><div className="text-lg font-black text-cyan-700">AL FAROOQUE WOOD WORKS FACTORY</div><div className="text-xs text-[color:var(--tx-3)]">AL FAROOQUE ERP · Accounting</div></div><div className="text-end"><div className="text-xl font-black">SALES INVOICE</div><div className="text-xs">SmartLife source · read only</div></div></div><div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-[color:var(--bd)] p-4 sm:grid-cols-4"><Metric label="Invoice" value={selectedInvoice.invoice_number}/><Metric label="Customer" value={selectedInvoice.customer}/><Metric label="Grand total" value={money(selectedInvoice.total,selectedInvoice.currency)}/><Metric label="Paid / Balance" value={`${money(selectedInvoice.paid,selectedInvoice.currency)} / ${money(selectedInvoice.balance,selectedInvoice.currency)}`}/><Metric label="Status" value={selectedInvoice.status}/><Metric label="SmartLife ID" value={selectedInvoice.external_id}/><Metric label="Project" value={relationship?.connection?.project_id?'Connected':'Not connected'}/><Metric label="Local payments" value={relationship?.payments?.length||0}/></div>{relationship?.connection?.project_id&&<div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm"><span>Connected project: </span><a className="font-semibold text-cyan-500 hover:underline" href={`${getAppUrl('projects')}/projects/${relationship.connection.project_id}`}>{relationship.projects?.find(p=>p.id===relationship.connection.project_id)?.project_name||relationship.connection.project_id}</a></div>}{Array.isArray(selected.items)&&selected.items.length>0&&<div className="mb-4"><h3 className="mb-2 font-semibold">Invoice items · SmartERP source ({selected.items.length})</h3><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[color:var(--bd)]"><th className="p-2 text-start text-xs uppercase text-[color:var(--tx-3)]">Code</th><th className="p-2 text-start text-xs uppercase text-[color:var(--tx-3)]">Product</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Qty</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Unit price</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Discount</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Tax %</th><th className="p-2 text-end text-xs uppercase text-[color:var(--tx-3)]">Total</th></tr></thead><tbody>{selected.items.map((item,index)=><tr key={`${item.product_id||index}-${index}`} className="border-b border-[color:var(--bd)]"><td className="p-2">{display(item.product_code)}</td><td className="p-2">{display(item.product_name)}</td><td className="p-2 text-end">{display(item.unit_quantity??item.quantity)}</td><td className="p-2 text-end">{money(item.unit_price,selectedInvoice.currency)}</td><td className="p-2 text-end">{money(item.discount,selectedInvoice.currency)}</td><td className="p-2 text-end">{display(item.tax)}</td><td className="p-2 text-end">{money(item.total,selectedInvoice.currency)}</td></tr>)}</tbody></table></div><div className="mt-2 grid gap-2 text-sm sm:grid-cols-4"><Metric label="Net total" value={money(first(selected,['total'])||0,selectedInvoice.currency)}/><Metric label="Total discount" value={money(first(selected,['total_discount'])||0,selectedInvoice.currency)}/><Metric label="Total tax (VAT)" value={money(first(selected,['total_tax'])||0,selectedInvoice.currency)}/><Metric label="Shipping" value={money(first(selected,['total_shipping'])||0,selectedInvoice.currency)}/></div></div>}
      {!!relationship?.payments?.length&&<div className="mb-4"><h3 className="mb-2 font-semibold">ERP payment history</h3><div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-start">Date</th><th className="p-2 text-start">Amount</th><th className="p-2 text-start">Method</th><th className="p-2 text-start">Reference</th></tr></thead><tbody>{relationship.payments.map(payment=><tr key={payment.id} className="border-t border-[color:var(--bd)]"><td className="p-2">{payment.payment_date}</td><td className="p-2">{money(payment.amount,selectedInvoice.currency)}</td><td className="p-2">{payment.payment_method||'—'}</td><td className="p-2">{payment.reference||'—'}</td></tr>)}</tbody></table></div></div>}</>}
      <dl className="grid gap-3 md:grid-cols-2">{Object.entries(selected).map(([key,value])=><div key={key} className="border-b border-[color:var(--bd)] pb-2"><dt className="text-xs uppercase text-[color:var(--tx-3)]">{key.replaceAll('_',' ')}</dt><dd className="mt-1 break-words">{display(value)}</dd></div>)}</dl>
    </GlassModal>}
    {connectOpen&&selected&&<GlassModal title="Connect Sales Invoice to Project" onClose={()=>setConnectOpen(false)} footer={<div className="flex justify-end gap-2"><GlassButton variant="secondary" onClick={()=>setConnectOpen(false)}>Cancel</GlassButton><GlassButton onClick={connectProject} disabled={!projectId||busy}>{busy?'Connecting…':'Connect'}</GlassButton></div>}><div className="space-y-4"><div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm">This stores only an AL FAROOQUE ERP relationship. The original SmartLife invoice remains unchanged.</div><GlassSelect value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Select project…</option>{(relationship?.projects||[]).map(p=><option key={p.id} value={p.id}>{p.project_name} · {p.customer_name||'No customer'}</option>)}</GlassSelect></div></GlassModal>}
  </div>;
}

function Metric({label,value}) { return <div><div className="text-xs text-[color:var(--tx-4)]">{label}</div><div className="mt-1 font-semibold">{display(value)}</div></div>; }
