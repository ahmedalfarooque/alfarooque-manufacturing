'use strict';

/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE Manufacturing — Unified Submission Handler
   Vercel Serverless Function  (POST /api/quote)

   Handles ALL website form submissions and emails them to the sales
   inbox via the Resend API (https://resend.com):

     • type: "contact"  →  Request-a-Quote / Contact form
     • type: "order"    →  Direct "Order Now" (single product)
     • type: "cart"     →  Cart "Proceed to Order" (multiple products)

   Required env vars:
     RESEND_API_KEY   — your Resend API key (required to send)
     RESEND_FROM      — verified sender address
                        (use onboarding@resend.dev for local testing)

   Set them in:
     • Local:      .env.local  (loaded automatically by server.js)
     • Production: Vercel Dashboard → Project → Settings → Environment Variables
   ═══════════════════════════════════════════════════════════════════ */

const RECIPIENT  = 'arshad@alfarooque.com';
const FROM_NAME  = 'AL FAROOQUE Website';
const FROM_EMAIL = process.env.RESEND_FROM || 'onboarding@resend.dev';

module.exports = async function handler(req, res) {
  console.log('[Submit] Incoming —', req.method, req.url);

  /* ── CORS ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    console.warn('[Submit] Rejected non-POST method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── API key check ── */
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Submit] FATAL: RESEND_API_KEY is not set. Add it to .env.local (local) or Vercel env vars (production).');
    return res.status(500).json({
      error: 'Email service is not configured. Set RESEND_API_KEY in the environment.',
      code:  'NO_API_KEY',
    });
  }

  /* ── Parse body (Vercel auto-parses JSON; guard for raw stream too) ── */
  let body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      const raw = await new Promise((resolve, reject) => {
        let s = '';
        req.on('data', c => (s += c));
        req.on('end', () => resolve(s));
        req.on('error', reject);
      });
      body = JSON.parse(raw || '{}');
    } catch (err) {
      console.error('[Submit] Body parse error:', err.message);
      return res.status(400).json({ error: 'Invalid request body (expected JSON)' });
    }
  }

  /* ── Normalise common fields ── */
  const type     = (body.type || 'contact').toLowerCase();
  const language = body.language === 'ar' ? 'ar' : 'en';

  const fullName = (
    body.name ||
    (body.first_name ? `${body.first_name} ${body.last_name || ''}` : '')
  ).trim();

  const email   = (body.email   || '').trim();
  const phone   = (body.phone   || '').trim();
  const company = (body.company || '').trim();
  const message = (body.message || '').trim();

  /* Request metadata */
  const userAgent = req.headers['user-agent'] || '(unknown)';
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) ||
    '(unknown)';

  /* ── Validation (real, per type) ── */
  const errors = [];
  if (type === 'contact') {
    if (!fullName) errors.push('Name is required');
    if (!email)    errors.push('Email is required');
  } else {
    /* order / cart */
    if (!fullName) errors.push('Name is required');
    if (!phone)    errors.push('Phone is required');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email address is invalid');
  }
  if (errors.length) {
    console.warn('[Submit] Validation failed:', errors, '| type:', type);
    return res.status(400).json({ error: errors.join('. '), fields: errors });
  }

  /* ── Build subject + email ── */
  const labels = {
    contact: 'New Quote Request',
    order:   'New Product Order',
    cart:    'New Cart Order',
  };
  const label   = labels[type] || labels.contact;
  const subjBit = type === 'contact'
    ? (body.service || 'General Enquiry')
    : (body.product || (Array.isArray(body.items) ? `${body.items.length} item(s)` : 'Order'));
  const subject = `${label} — ${subjBit} — ${fullName || email || phone}`;

  const htmlBody = buildEmailHTML({
    type, label, language, fullName, company, email, phone, message,
    service:    body.service,
    product:    body.product,
    quantity:   body.quantity,
    items:      Array.isArray(body.items) ? body.items : null,
    subtotal:   body.subtotal,
    vat:        body.vat,
    grandTotal: body.grandTotal,
    userAgent, ip,
  });

  console.log('[Submit] →', RECIPIENT, '| type:', type, '| subject:', subject, '| ip:', ip);

  /* ── Send via Resend ── */
  let apiResponse, apiData;
  try {
    apiResponse = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     `${FROM_NAME} <${FROM_EMAIL}>`,
        to:       [RECIPIENT],
        reply_to: email || undefined,
        subject,
        html:     htmlBody,
      }),
    });
    apiData = await apiResponse.json().catch(() => ({}));
  } catch (err) {
    console.error('[Submit] Network error reaching Resend:', err.stack || err.message);
    return res.status(502).json({ error: 'Could not reach the email service', detail: err.message });
  }

  console.log('[Submit] Resend HTTP', apiResponse.status, '| body:', JSON.stringify(apiData));

  if (!apiResponse.ok) {
    console.error('[Submit] Email delivery FAILED:', JSON.stringify(apiData));
    return res.status(502).json({
      error:  (apiData && apiData.message) || 'Email delivery failed',
      detail: apiData,
    });
  }

  console.log('[Submit] SUCCESS — id:', apiData.id, '→', RECIPIENT);
  return res.status(200).json({ success: true, id: apiData.id });
};

/* ── HTML escape ── */
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

/* ── Currency ── */
function money(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return esc(n);
  return 'SAR ' + num.toLocaleString('en-US');
}

/* ── Email template (covers contact + order + cart) ── */
function buildEmailHTML(d) {
  const ts = new Date().toLocaleString('en-SA', {
    timeZone: 'Asia/Riyadh', dateStyle: 'long', timeStyle: 'short',
  });
  const langName = d.language === 'ar' ? 'Arabic (العربية)' : 'English';

  function row(lbl, val) {
    return `<tr><td class="lbl">${esc(lbl)}</td><td class="val">${val}</td></tr>`;
  }

  /* Contact details rows */
  const detailRows = [
    row('Name', esc(d.fullName || '—')),
    d.company ? row('Company', esc(d.company)) : '',
    row('Email', d.email ? `<a href="mailto:${esc(d.email)}" style="color:#0ea5e9;">${esc(d.email)}</a>` : '—'),
    row('Phone / WhatsApp', esc(d.phone || '—')),
    d.service ? row('Service Required', esc(d.service)) : '',
  ].join('');

  /* Order rows */
  let orderBlock = '';
  if (d.type === 'order' || d.type === 'cart') {
    let itemsHtml = '';
    if (d.items && d.items.length) {
      itemsHtml = d.items.map(it =>
        `<tr>
           <td class="it-name">${esc(it.name)}</td>
           <td class="it-qty">×&nbsp;${esc(it.qty)}</td>
           <td class="it-tot">${money(it.lineTotal != null ? it.lineTotal : (Number(it.price) * Number(it.qty)))}</td>
         </tr>`
      ).join('');
    } else if (d.product) {
      itemsHtml =
        `<tr>
           <td class="it-name">${esc(d.product)}</td>
           <td class="it-qty">×&nbsp;${esc(d.quantity || 1)}</td>
           <td class="it-tot">${money(d.subtotal)}</td>
         </tr>`;
    }

    orderBlock = `
      <div class="sec-lbl">Order Details</div>
      <table class="items">${itemsHtml}</table>
      <table class="totals">
        ${row('Subtotal', money(d.subtotal))}
        ${row('VAT (15%)', money(d.vat))}
        <tr class="grand"><td class="lbl">Grand Total</td><td class="val">${money(d.grandTotal)}</td></tr>
      </table>`;
  }

  const msgBlock = d.message
    ? `<div class="sec-lbl">${d.type === 'contact' ? 'Project Description' : 'Customer Message'}</div>
       <div class="msg-box">${esc(d.message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;}
  .wrap{max-width:620px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0;}
  .hdr{background:linear-gradient(135deg,#0f2442 0%,#1a3a6b 100%);padding:28px 32px;color:#fff;}
  .hdr-title{font-size:21px;font-weight:700;margin:0 0 6px;}
  .hdr-sub{font-size:12px;opacity:0.7;margin:0;}
  .body{padding:24px 32px;}
  .sec-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#7a8aa0;margin:22px 0 10px;}
  table{width:100%;border-collapse:collapse;}
  .lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#888;padding:9px 0;width:150px;vertical-align:top;}
  .val{font-size:14px;color:#1a1a1a;line-height:1.5;padding:9px 0;border-bottom:1px solid #f1f1f1;}
  .items td{font-size:14px;padding:8px 0;border-bottom:1px solid #f1f1f1;}
  .it-name{color:#1a1a1a;}
  .it-qty{color:#666;text-align:center;width:70px;white-space:nowrap;}
  .it-tot{color:#1a1a1a;font-weight:600;text-align:right;width:120px;white-space:nowrap;}
  .totals{margin-top:6px;}
  .totals .lbl{padding:6px 0;border:none;}
  .totals .val{text-align:right;border:none;padding:6px 0;}
  .totals .grand .lbl,.totals .grand .val{font-size:16px;font-weight:700;color:#0f2442;border-top:2px solid #0f2442;padding-top:10px;}
  .msg-box{background:#f7fbfd;border-left:3px solid #22c4de;border-radius:0 6px 6px 0;padding:14px 16px;font-size:14px;line-height:1.7;color:#333;}
  .meta{margin-top:24px;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#aaa;line-height:1.7;}
  .ftr{background:#f9f9f9;padding:14px 32px;font-size:11px;color:#999;border-top:1px solid #eee;text-align:center;}
</style></head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-title">${esc(d.label)}</div>
    <div class="hdr-sub">AL FAROOQUE Manufacturing &mdash; ${esc(ts)} (AST)</div>
  </div>
  <div class="body">
    <div class="sec-lbl">Customer</div>
    <table>${detailRows}</table>
    ${orderBlock}
    ${msgBlock}
    <div class="meta">
      Company: AL FAROOQUE Manufacturing &bull; Language: ${esc(langName)}<br>
      Browser: ${esc(d.userAgent)}<br>
      IP: ${esc(d.ip)}
    </div>
  </div>
  <div class="ftr">Submitted via alfarooque.com &mdash; reply directly to respond to the customer.</div>
</div>
</body></html>`;
}
