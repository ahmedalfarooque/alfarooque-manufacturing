'use strict';

const fs=require('fs'); const path=require('path'); const jwt=require('jsonwebtoken');
for(const file of [path.join(__dirname,'..','.env.local')]){try{for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const text=line.trim();if(!text||text.startsWith('#'))continue;const i=text.indexOf('=');if(i<1)continue;const key=text.slice(0,i).trim();let value=text.slice(i+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);if(!(key in process.env))process.env[key]=value}}catch(_){}}

async function request(url,{method='GET',cookie,body}={}){const response=await fetch(url,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const payload=await response.json().catch(()=>({}));return{response,payload}}

async function main(){
  const [projectId,userId]=process.argv.slice(2); if(!projectId||!userId)throw new Error('Project and user IDs are required.');
  if(!process.env.JWT_SECRET)throw new Error('JWT_SECRET is not configured.');
  const token=app=>jwt.sign({sub:userId,email:'financial-verifier@localhost.invalid',role:'admin',app},process.env.JWT_SECRET,{expiresIn:300});
  const accountingCookie=`af_accounting_session=${token('accounting')}`; const projectCookie=`af_projects_session=${token('projects')}`;
  const source={id:'_codex_financial_workflow_verification_',invoice_number:'VERIFY-SI-100',customer_name:'Local Verification',invoice_date:'2026-08-10',due_date:'2026-08-31',subtotal:100,vat_amount:15,grand_total:115,paid_amount:0,status:'Unpaid',currency:'SAR'};
  const connected=await request('http://localhost:3050/api/smartlife/relationships',{method:'POST',cookie:accountingCookie,body:{action:'connect-project',resource:'sales-invoices',source_record:source,project_id:projectId}});
  if(!connected.response.ok)throw new Error(`Connect failed: ${connected.payload.error||connected.response.status}`);
  const sourceId=connected.payload.sourceRecord.id;
  for(const [amount,reference] of [[30,'VERIFY-PAY-1'],[20,'VERIFY-PAY-2']]){const paid=await request(`http://localhost:3020/api/projects/${projectId}/financials`,{method:'POST',cookie:projectCookie,body:{action:'add-payment',source_record_id:sourceId,amount,payment_date:'2026-08-10',payment_method:'bank_transfer',reference,notes:'Temporary localhost verification'}});if(!paid.response.ok)throw new Error(`Payment failed: ${paid.payload.error||paid.response.status}`)}
  const financials=await request(`http://localhost:3020/api/projects/${projectId}/financials`,{cookie:projectCookie}); if(!financials.response.ok)throw new Error(`Financial summary failed: ${financials.payload.error||financials.response.status}`);
  const invoice=financials.payload.invoices?.find(row=>row.id===sourceId); if(!invoice||invoice.local_paid!==50||invoice.reflected_balance!==65)throw new Error(`Unexpected payment summary: ${JSON.stringify(invoice||null)}`);
  const unsupported=await request('http://localhost:3050/api/smartlife/purchase-invoices',{cookie:accountingCookie}); if(unsupported.response.status!==503||!/Unsupported SmartERP read-only resource/.test(unsupported.payload.error||''))throw new Error('Unsupported purchase endpoint was not reported explicitly.');
  const reports=await request('http://localhost:3050/api/smartlife/reports',{cookie:accountingCookie}); if(!reports.response.ok||reports.payload.records?.length!==9)throw new Error('ERP-side SmartERP financial reports failed.');
  const syncRun=await request('http://localhost:3050/api/smartlife/sync',{method:'POST',cookie:accountingCookie}); if(!syncRun.response.ok||syncRun.payload.status!=='success')throw new Error(`SmartERP sync control failed: ${syncRun.payload.error||syncRun.response.status}`);
  const syncStatus=await request('http://localhost:3050/api/smartlife/sync',{cookie:accountingCookie}); if(!syncStatus.response.ok)throw new Error('SmartERP sync status route failed.');
  console.log(JSON.stringify({connectedProject:connected.payload.project.project_name,payments:invoice.localPayments.length,total:invoice.total_amount,localPaid:invoice.local_paid,balance:invoice.reflected_balance,status:invoice.payment_status,reportRows:reports.payload.records.length,unsupportedPurchaseEndpoint:unsupported.response.status,syncRecords:syncRun.payload.records,smartErpStatus:syncStatus.payload.integration?.status},null,2));
}
main().catch(error=>{console.error(error.message);process.exit(1)});
