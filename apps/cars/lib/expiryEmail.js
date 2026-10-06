'use strict';

/* Email content for the daily expiry digest. Pure function: items in,
   { subject, html, text } out — no I/O, so it is unit-testable and the
   same template serves the mock (console) and live (Resend) paths.
   Languages: 'en', 'ar' (RTL), or 'both' (bilingual — English block, then
   Arabic block). Table-based layout with inline styles so it renders in
   Outlook/Gmail on desktop and mobile. */

const L = {
  en: {
    dir: 'ltr', lang: 'en',
    type: { insurance: 'Vehicle Insurance', inspection: 'Periodic Vehicle Inspection' },
    subjectOne: { insurance: 'Vehicle Insurance Expiry Alert', inspection: 'Periodic Vehicle Inspection Expiry Alert' },
    subjectMany: n => `Fleet Expiry Alerts — ${n} item${n === 1 ? '' : 's'} need attention`,
    heading: 'Fleet expiry alert',
    intro: (n, withinDays) => `${n} vehicle document${n === 1 ? '' : 's'} expire${n === 1 ? 's' : ''} within ${withinDays} days or ${n === 1 ? 'has' : 'have'} already expired. This reminder is sent every day until the vehicle record is updated with the new expiry date.`,
    cols: { vehicle: 'Vehicle', name: 'Name', type: 'Alert type', expiry: 'Expiry date', days: 'Days remaining', status: 'Status' },
    status: { expiring_soon: 'Expiring soon', expired: 'Expired' },
    severity: { critical: 'Critical', urgent: 'Urgent', warning: 'Warning', expired: 'Expired' },
    days: d => d < 0 ? `Expired ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago` : (d === 0 ? 'Expires today' : `${d} day${d === 1 ? '' : 's'}`),
    action: 'Open vehicle', openFleet: 'Open TrackFleet',
    testTag: 'TEST', testBanner: 'This is a TEST notification sent manually from TrackFleet alert settings. It is not a real expiry alert and requires no action.',
    sampleNote: 'No vehicle currently has an active alert of this type, so the row below is a sample for layout only.',
    footer: 'You receive this because your address is on the TrackFleet alert recipient list. Update the vehicle’s insurance or inspection expiry date to stop the reminders.',
  },
  ar: {
    dir: 'rtl', lang: 'ar',
    type: { insurance: 'تأمين المركبة', inspection: 'الفحص الفني الدوري للمركبة' },
    subjectOne: { insurance: 'تنبيه انتهاء تأمين المركبة', inspection: 'تنبيه انتهاء الفحص الفني الدوري للمركبة' },
    subjectMany: n => `تنبيهات انتهاء وثائق الأسطول — ${n} بنود تحتاج إلى إجراء`,
    heading: 'تنبيه انتهاء وثائق المركبات',
    intro: (n, withinDays) => `يوجد ${n} من وثائق المركبات تنتهي خلال ${withinDays} يومًا أو انتهت بالفعل. يُرسل هذا التذكير يوميًا إلى أن يتم تحديث سجل المركبة بتاريخ الانتهاء الجديد.`,
    cols: { vehicle: 'المركبة', name: 'الاسم', type: 'نوع التنبيه', expiry: 'تاريخ الانتهاء', days: 'الأيام المتبقية', status: 'الحالة' },
    status: { expiring_soon: 'تنتهي قريبًا', expired: 'منتهية' },
    severity: { critical: 'حرج', urgent: 'عاجل', warning: 'تحذير', expired: 'منتهية' },
    days: d => d < 0 ? `انتهت منذ ${Math.abs(d)} يوم` : (d === 0 ? 'تنتهي اليوم' : `${d} يوم`),
    action: 'فتح المركبة', openFleet: 'فتح TrackFleet',
    testTag: 'اختبار', testBanner: 'هذه رسالة اختبار أُرسلت يدويًا من إعدادات تنبيهات TrackFleet. ليست تنبيه انتهاء حقيقيًا ولا تتطلب أي إجراء.',
    sampleNote: 'لا توجد حاليًا أي مركبة لديها تنبيه نشط من هذا النوع، لذا الصف أدناه عيّنة لعرض التنسيق فقط.',
    footer: 'تصلك هذه الرسالة لأن بريدك ضمن قائمة مستلمي تنبيهات TrackFleet. حدّث تاريخ انتهاء التأمين أو الفحص في سجل المركبة لإيقاف التذكيرات.',
  },
};

const SEV_COLOR = { critical: '#b91c1c', urgent: '#c2410c', warning: '#a16207', expired: '#7f1d1d', normal: '#475569' };

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(date, lang) {
  /* date is YYYY-MM-DD; format in UTC so the calendar day never shifts. */
  const d = new Date(date + 'T00:00:00Z');
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit' }).format(d);
}

function block(items, lang, o) {
  const s = L[lang];
  const rows = items.map(it => {
    const color = SEV_COLOR[it.severity] || SEV_COLOR.normal;
    const link = o.baseUrl && it.carId ? `${o.baseUrl.replace(/\/$/, '')}/vehicles/${encodeURIComponent(it.carId)}` : '';
    return `<tr>
      <td style="padding:10px 12px;border-top:1px solid #e2e8f0;font-weight:600;color:#0f172a">${link ? `<a href="${esc(link)}" style="color:#1d4ed8;text-decoration:none">${esc(it.vehicleNumber)}</a>` : esc(it.vehicleNumber)}</td>
      <td style="padding:10px 12px;border-top:1px solid #e2e8f0;color:#334155">${esc(it.vehicleName || '—')}</td>
      <td style="padding:10px 12px;border-top:1px solid #e2e8f0;color:#334155">${esc(s.type[it.alertType])}</td>
      <td style="padding:10px 12px;border-top:1px solid #e2e8f0;color:#334155;white-space:nowrap">${esc(fmtDate(it.expiryDate, lang))}</td>
      <td style="padding:10px 12px;border-top:1px solid #e2e8f0;color:${color};font-weight:600;white-space:nowrap">${esc(s.days(it.daysRemaining))}</td>
      <td style="padding:10px 12px;border-top:1px solid #e2e8f0"><span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;color:${color};border:1px solid ${color}">${esc(s.severity[it.severity] || s.status[it.status])}</span></td>
    </tr>`;
  }).join('');
  const testBox = o.isTest ? `<div style="margin:0 0 16px;padding:10px 14px;border:1px solid #f59e0b;background:#fffbeb;border-radius:8px;color:#92400e;font-size:13px;line-height:1.5"><strong>${esc(s.testTag)}</strong> — ${esc(s.testBanner)}${items.some(i => i.isSample) ? '<br>' + esc(s.sampleNote) : ''}</div>` : '';
  return `<div dir="${s.dir}" lang="${s.lang}" style="text-align:${s.dir === 'rtl' ? 'right' : 'left'}">
    ${testBox}
    <h2 style="margin:0 0 8px;font-size:20px;color:#0b1b29">${esc(s.heading)}</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155">${esc(s.intro(items.length, o.withinDays))}</p>
    <div style="overflow-x:auto"><table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;font-size:13px;min-width:560px">
      <thead><tr style="background:#f1f5f9;color:#475569;text-align:${s.dir === 'rtl' ? 'right' : 'left'}">
        ${['vehicle', 'name', 'type', 'expiry', 'days', 'status'].map(k => `<th style="padding:10px 12px;font-weight:600;font-size:12px">${esc(s.cols[k])}</th>`).join('')}
      </tr></thead><tbody>${rows}</tbody></table></div>
    ${o.baseUrl ? `<p style="margin:18px 0 0"><a href="${esc(o.baseUrl.replace(/\/$/, ''))}/alerts" style="display:inline-block;background:#0b1b29;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">${esc(s.openFleet)}</a></p>` : ''}
    <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#64748b">${esc(s.footer)}</p>
  </div>`;
}

function textBlock(items, lang, o) {
  const s = L[lang];
  const lines = items.map(it => `- ${it.vehicleNumber}${it.vehicleName ? ' (' + it.vehicleName + ')' : ''} | ${s.type[it.alertType]} | ${it.expiryDate} | ${s.days(it.daysRemaining)}`);
  const head = o.isTest ? ['[' + s.testTag + '] ' + s.testBanner, ''] : [];
  return [...head, s.heading, s.intro(items.length, o.withinDays), '', ...lines, '', s.footer].join('\n');
}

/* items: [{ carId, vehicleNumber, vehicleName, alertType, expiryDate,
   daysRemaining, status, severity }] — already sorted most-urgent first. */
function buildExpiryDigest(items, { language = 'en', company = 'AL FAROOQUE', baseUrl = '', withinDays = 30, isTest = false } = {}) {
  const langs = language === 'both' ? ['en', 'ar'] : [language === 'ar' ? 'ar' : 'en'];
  const primary = langs[0];
  const s = L[primary];
  const single = items.length === 1 ? items[0] : null;
  const subjects = langs.map(lg => single
    ? `${L[lg].subjectOne[single.alertType]} — ${single.vehicleNumber}`
    : L[lg].subjectMany(items.length));
  const subject = (isTest ? '[' + langs.map(lg => L[lg].testTag).join('/') + '] ' : '') + subjects.join(' / ');
  const o = { baseUrl, withinDays, isTest };
  const body = langs.map(lg => block(items, lg, o)).join('<hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0">');
  const html = `<!doctype html><html lang="${s.lang}" dir="${s.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Tahoma,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#0b1b29;color:#ffffff;padding:16px 24px;font-size:15px;font-weight:600;letter-spacing:.3px">${esc(company)} <span style="opacity:.7;font-weight:400">· TrackFleet</span></td></tr>
<tr><td style="padding:24px">${body}</td></tr>
</table></td></tr></table></body></html>`;
  const text = langs.map(lg => textBlock(items, lg, o)).join('\n\n----\n\n');
  return { subject, html, text };
}

module.exports = { buildExpiryDigest };
