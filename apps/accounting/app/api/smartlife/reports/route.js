'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req); if(response) return response;
  const sb=getDb();
  const [source,payments,connections,integration]=await Promise.all([
    sb.from('erp_financial_source_records').select('record_type,total_amount,paid_amount,balance_amount,vat_amount'),
    sb.from('erp_project_payments').select('direction,amount,origin'),
    sb.from('erp_financial_connections').select('id',{count:'exact',head:true}),
    sb.from('crm_integrations').select('status,last_sync_at,last_error').eq('tenant_id','alfarooque').eq('integration_key','smartlife').maybeSingle(),
  ]);
  if(source.error||payments.error) return json({error:'Could not build SmartERP financial reports.'},500);
  const rows=source.data||[]; const sales=rows.filter(row=>row.record_type==='sales_invoice'); const purchases=rows.filter(row=>row.record_type==='purchase_invoice'); const expenses=rows.filter(row=>row.record_type==='expense');
  const sum=(items,key)=>items.reduce((total,row)=>total+Number(row[key]||0),0); const localPayments=payments.data||[];
  const records=[
    {report:'Sales report',amount:sum(sales,'total_amount'),currency:'SAR',status:'SmartLife synchronized source'},
    {report:'Receivables',amount:sum(sales,'balance_amount'),currency:'SAR',status:'SmartLife synchronized source'},
    {report:'Purchase report',amount:sum(purchases,'total_amount'),currency:'SAR',status:purchases.length?'SmartLife synchronized source':'Awaiting verified purchase API'},
    {report:'Payables',amount:sum(purchases,'balance_amount'),currency:'SAR',status:purchases.length?'SmartLife synchronized source':'Awaiting verified purchase API'},
    {report:'Expense report',amount:sum(expenses,'total_amount'),currency:'SAR',status:'SmartLife synchronized source'},
    {report:'VAT information',amount:sum(rows,'vat_amount'),currency:'SAR',status:'Available source records'},
    {report:'ERP project payments received',amount:sum(localPayments.filter(row=>row.direction==='received'),'amount'),currency:'SAR',status:'AL FAROOQUE ERP workflow data'},
    {report:'ERP project payments made',amount:sum(localPayments.filter(row=>row.direction==='made'),'amount'),currency:'SAR',status:'AL FAROOQUE ERP workflow data'},
    {report:'Connected financial records',amount:connections.count||0,currency:'records',status:'AL FAROOQUE ERP relationships'},
  ];
  return json({source:'SmartERP + AL FAROOQUE ERP relationships',connected:integration.data?.status==='connected',last_sync_at:integration.data?.last_sync_at||null,records});
}
