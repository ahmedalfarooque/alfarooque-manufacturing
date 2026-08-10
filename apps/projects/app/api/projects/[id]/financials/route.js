'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');

async function canAccess(session, projectId) {
  return session.role !== 'external' || isAssignedOrAdmin(session, projectId);
}

function summarize(records, connections, payments) {
  const connectionBySource = new Map((connections || []).map(row => [row.source_record_id,row]));
  const paymentsBySource = new Map();
  for (const payment of payments || []) {
    const list = paymentsBySource.get(payment.source_record_id) || [];
    list.push(payment); paymentsBySource.set(payment.source_record_id,list);
  }
  const invoices = (records || []).map(record => {
    const localPayments = paymentsBySource.get(record.id) || [];
    const localPaid = localPayments.reduce((sum,row)=>sum+Number(row.amount||0),0);
    const sourcePaid = Number(record.paid_amount||0);
    const reflectedPaid = Math.max(sourcePaid,localPaid);
    const total = Number(record.total_amount||0);
    const balance = Math.max(total-reflectedPaid,0);
    return { ...record, connection:connectionBySource.get(record.id)||null, localPayments, local_paid:localPaid, source_paid:sourcePaid, reflected_paid:reflectedPaid, reflected_balance:balance, payment_status:balance<=0&&total>0?'Paid':reflectedPaid>0?'Partially Paid':'Unpaid' };
  });
  const sales = invoices.filter(row=>row.record_type==='sales_invoice');
  const purchases = invoices.filter(row=>row.record_type==='purchase_invoice');
  const sum = (rows,key)=>rows.reduce((total,row)=>total+Number(row[key]||0),0);
  return { invoices, summary:{ revenue:sum(sales,'total_amount'), payments_received:sum(sales,'reflected_paid'), receivables:sum(sales,'reflected_balance'), purchases:sum(purchases,'total_amount'), payments_made:sum(purchases,'reflected_paid'), payables:sum(purchases,'reflected_balance'), profit:sum(sales,'total_amount')-sum(purchases,'total_amount') } };
}

export async function GET(req,{params}) {
  const { response,session } = requireSession(req); if(response) return response;
  if(!(await canAccess(session,params.id))) return json({error:'Project not found.'},404);
  const sb=getDb();
  const {data:connections,error}=await sb.from('erp_financial_connections').select('*').eq('project_id',params.id);
  if(error) return json({error:'Could not load project financial connections.'},500);
  const ids=(connections||[]).map(row=>row.source_record_id);
  if(!ids.length) return json({invoices:[],payments:[],summary:{revenue:0,payments_received:0,receivables:0,purchases:0,payments_made:0,payables:0,profit:0}});
  const [records,payments]=await Promise.all([
    sb.from('erp_financial_source_records').select('*').in('id',ids).order('record_date',{ascending:false}),
    sb.from('erp_project_payments').select('*').eq('project_id',params.id).order('payment_date',{ascending:false}),
  ]);
  if(records.error||payments.error) return json({error:'Could not load project financials.'},500);
  return json({...summarize(records.data||[],connections||[],payments.data||[]),payments:payments.data||[]});
}

export async function POST(req,{params}) {
  const {response,session}=requireSession(req); if(response) return response;
  if(!(await isAssignedOrAdmin(session,params.id))) return json({error:'Project payment permission required.'},403);
  const body=await req.json().catch(()=>({}));
  if(body.action!=='add-payment') return json({error:'Unsupported project financial action.'},400);
  const amount=Number(body.amount); if(!body.source_record_id||!Number.isFinite(amount)||amount<=0||!body.payment_date) return json({error:'Invoice, positive amount, and payment date are required.'},400);
  const sb=getDb();
  const {data:connection}=await sb.from('erp_financial_connections').select('source_record_id').eq('project_id',params.id).eq('source_record_id',body.source_record_id).maybeSingle();
  if(!connection) return json({error:'Invoice is not connected to this project.'},400);
  const [{data:source},{data:existing}]=await Promise.all([
    sb.from('erp_financial_source_records').select('*').eq('id',body.source_record_id).maybeSingle(),
    sb.from('erp_project_payments').select('amount').eq('project_id',params.id).eq('source_record_id',body.source_record_id).eq('origin','local_erp'),
  ]);
  if(!source) return json({error:'Financial source record not found.'},404);
  const localPaid=(existing||[]).reduce((sum,row)=>sum+Number(row.amount||0),0);
  const reflectedPaid=Math.max(Number(source.paid_amount||0),localPaid);
  const remaining=Math.max(Number(source.total_amount||0)-reflectedPaid,0);
  if(amount>remaining+0.005) return json({error:`Payment exceeds the remaining balance of ${remaining.toFixed(2)} ${source.currency||'SAR'}.`},400);
  const direction=source.record_type==='purchase_invoice'?'made':'received';
  const {data:payment,error}=await sb.from('erp_project_payments').insert({tenant_id:'alfarooque',project_id:params.id,source_record_id:source.id,origin:'local_erp',direction,amount,payment_date:body.payment_date,payment_method:body.payment_method||null,reference:body.reference||null,notes:body.notes||null,created_by:session.sub}).select().single();
  if(error) return json({error:'Could not add the ERP-side project payment.'},500);
  await sb.from('pm_project_logs').insert({project_id:params.id,activity:`ERP payment ${amount.toFixed(2)} ${source.currency||'SAR'} recorded against ${source.source_reference||source.external_id}; SmartLife unchanged`});
  return json({payment,source_unchanged:true},201);
}
