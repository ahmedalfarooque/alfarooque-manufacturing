'use strict';

/* Quotation -> Projects handoff (Part 4 of the integration). Creates a
   pending project_requests row (NOT a project yet — that only happens
   once a Projects admin accepts/holds it and clicks "Project Start"),
   notifies every Projects admin via the shared public.notifications
   table, and emails the project-manager inbox. Idempotent: only one
   active (non-rejected) request may exist per quotation — enforced by
   a partial unique index, guarded here first for a clean error message. */

const { getDb } = require('@/lib/db');
const { json, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { sendEmail } = require('@/lib/email');

function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }); }

function emailHtml({ qn, customerName, link, isAr }) {
  const L = isAr
    ? { title: 'طلب مشروع جديد', intro: 'تم استلام عرض سعر جاهز للتحويل إلى المشاريع.', number: 'رقم العرض', customer: 'العميل', amount: 'القيمة', btn: 'عرض الطلب' }
    : { title: 'New Project Request', intro: 'A quotation has been received, ready to be transferred to Projects.', number: 'Quotation', customer: 'Customer', amount: 'Value', btn: 'View Request' };
  return `
  <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family:Segoe UI,Tahoma,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e2dd;border-radius:12px;overflow:hidden">
    <div style="background:#46512F;color:#fff;padding:18px 22px;font-size:17px;font-weight:700">${L.title}</div>
    <div style="padding:22px;color:#333;font-size:14px;line-height:1.7">
      <p>${L.intro}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <tr><td style="padding:6px 0;color:#777">${L.number}</td><td style="text-align:${isAr ? 'left' : 'right'};font-weight:600" dir="ltr">${qn.quote_number}</td></tr>
        <tr><td style="padding:6px 0;color:#777">${L.customer}</td><td style="text-align:${isAr ? 'left' : 'right'};font-weight:600">${customerName || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#777">${L.amount}</td><td style="text-align:${isAr ? 'left' : 'right'};font-weight:700" dir="ltr">${money(qn.grand_total)} SAR</td></tr>
      </table>
      <p style="text-align:center;margin:22px 0">
        <a href="${link}" style="background:#6B7A4F;color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:600;display:inline-block">${L.btn}</a>
      </p>
    </div>
  </div>`;
}

export async function POST(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();

  const { data: qn } = await sb.from('qt_quotations')
    .select('*, customer:customers(company_name, company_name_en, company_name_ar)')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!qn) return json({ error: 'Not found' }, 404);
  if (qn.status !== 'started') return json({ error: 'Quotation must be Started before it can be sent to Projects.' }, 409);

  const { data: existing } = await sb.from('project_requests')
    .select('id, status').eq('quotation_id', params.id).neq('status', 'rejected').maybeSingle();
  if (existing) return json({ error: 'This quotation has already been sent to Projects.' }, 409);

  const { data: reqRow, error } = await sb.from('project_requests').insert({
    quotation_id: params.id,
    quote_number: qn.quote_number,
    customer_id: qn.customer_id,
    amount: qn.grand_total,
    requested_by: session.sub,
  }).select().single();
  if (error) return json({ error: error.message }, 400);

  await audit(sb, 'project_requests', reqRow.id, 'insert', null, reqRow, session.sub);

  const { data: admins } = await sb.from('platform_users').select('id').eq('role', 'admin').eq('is_active', true);
  if (admins && admins.length) {
    await sb.from('notifications').insert(admins.map(a => ({
      user_id: a.id,
      type: 'quotation_request',
      title: 'New quotation received.',
      body: `Quotation: ${qn.quote_number}\nCustomer: ${qn.customer ? (qn.customer.company_name_en || qn.customer.company_name_ar || qn.customer.company_name) : '—'}\nRequested by: Quotation Department`,
      link: '/quotation-requests/' + reqRow.id,
    }))).catch(() => {});
  }

  const isAr = (qn.output_lang || 'en') === 'ar';
  const customerName = qn.customer ? (isAr ? (qn.customer.company_name_ar || qn.customer.company_name_en) : qn.customer.company_name_en) : '';
  const projectsBase = process.env.PROJECTS_APP_URL || 'https://projects.alfarooque.com';
  const link = `${projectsBase}/quotation-requests/${reqRow.id}`;
  sendEmail({
    subject: `New Project Request — ${qn.quote_number}`,
    html: emailHtml({ qn, customerName, link, isAr }),
    mockLabel: 'Quotation request ' + qn.quote_number,
  }).catch(() => {});

  return json({ row: reqRow }, 201);
}
