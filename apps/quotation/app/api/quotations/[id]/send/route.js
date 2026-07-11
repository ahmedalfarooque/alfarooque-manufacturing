'use strict';

/* Emails the quotation to the customer via Resend: branded HTML summary
   + button linking to the public read-only view (which is also the
   print/PDF page for them). Transitions approved → sent and logs a
   quotation event with the recipient. Body: { to, subject?, message? } */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { sendEmail, isConfigured } = require('@/lib/email');
const { logEvent } = require('@/lib/quotes');
const { audit } = require('@/lib/crud');

function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }); }

function emailHtml({ qn, entityName, link, message, isAr }) {
  const L = isAr
    ? { greet: 'تحية طيبة،', intro: 'نرفق لكم عرض السعر التالي:', number: 'رقم العرض', total: 'الإجمالي شامل الضريبة', valid: 'صالح حتى', btn: 'عرض / تحميل عرض السعر', thanks: 'شاكرين لكم حسن تعاونكم،' }
    : { greet: 'Dear Sir/Madam,', intro: 'Please find our quotation below:', number: 'Quotation No.', total: 'Grand Total (incl. VAT)', valid: 'Valid until', btn: 'View / Download Quotation', thanks: 'Thank you for your business,' };
  return `
  <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family:Segoe UI,Tahoma,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e2dd;border-radius:12px;overflow:hidden">
    <div style="background:#46512F;color:#fff;padding:18px 22px;font-size:17px;font-weight:700">${entityName}</div>
    <div style="padding:22px;color:#333;font-size:14px;line-height:1.7">
      <p>${L.greet}</p>
      <p>${L.intro}</p>
      ${message ? `<p style="white-space:pre-wrap;border-inline-start:3px solid #6B7A4F;padding-inline-start:10px;color:#555">${message}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <tr><td style="padding:6px 0;color:#777">${L.number}</td><td style="text-align:${isAr ? 'left' : 'right'};font-weight:600" dir="ltr">${qn.quote_number}</td></tr>
        <tr><td style="padding:6px 0;color:#777">${L.total}</td><td style="text-align:${isAr ? 'left' : 'right'};font-weight:700" dir="ltr">${money(qn.grand_total)} SAR</td></tr>
        <tr><td style="padding:6px 0;color:#777">${L.valid}</td><td style="text-align:${isAr ? 'left' : 'right'}" dir="ltr">${qn.valid_until || '—'}</td></tr>
      </table>
      <p style="text-align:center;margin:22px 0">
        <a href="${link}" style="background:#6B7A4F;color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:600;display:inline-block">${L.btn}</a>
      </p>
      <p>${L.thanks}<br/>${entityName}</p>
    </div>
  </div>`;
}

export async function POST(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));

  const { data: qn } = await sb.from('qt_quotations')
    .select('*, entity:qt_entities(name_en, name_ar), customer:customers(email, company_name)')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!qn) return json({ error: 'Not found' }, 404);
  if (!['approved', 'sent'].includes(qn.status)) {
    return json({ error: 'Quotation must be approved before sending.' }, 409);
  }

  const to = (body.to || (qn.customer && qn.customer.email) || '').trim();
  if (!to || !/.+@.+\..+/.test(to)) return json({ error: 'A valid recipient email is required.' }, 400);

  const isAr = (qn.output_lang || 'en') === 'ar';
  const entityName = isAr ? (qn.entity.name_ar || qn.entity.name_en) : qn.entity.name_en;
  const origin = new URL(req.url).origin;
  const link = `${origin}/q/${qn.public_token}`;
  const subject = (body.subject || '').trim() ||
    (isAr ? `عرض سعر ${qn.quote_number} — ${entityName}` : `Quotation ${qn.quote_number} — ${entityName}`);

  try {
    const result = await sendEmail({
      to, subject,
      html: emailHtml({ qn, entityName, link, message: (body.message || '').trim(), isAr }),
      mockLabel: 'Quotation ' + qn.quote_number,
    });
    if (result.mocked && !isConfigured()) {
      /* Dev without RESEND_API_KEY: still mark sent so flow is testable. */
      console.warn('[quotation/send] MOCK send of', qn.quote_number, 'to', to, '→', link);
    }
  } catch (e) {
    return json({ error: 'Email failed: ' + e.message }, 502);
  }

  if (qn.status !== 'sent') {
    await sb.from('qt_quotations').update({ status: 'sent', updated_by: session.sub, updated_at: new Date().toISOString() }).eq('id', params.id);
  }
  await logEvent(sb, params.id, 'sent_email', { to, subject }, session.sub);
  await audit(sb, 'qt_quotations', params.id, 'status', { status: qn.status }, { status: 'sent', to }, session.sub);
  return json({ ok: true, status: 'sent', link });
}
