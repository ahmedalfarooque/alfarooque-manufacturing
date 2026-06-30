'use strict';

/* ═══════════════════════════════════════════════════════
   AL FAROOQUE Manufacturing — Quote Request Handler
   Vercel Serverless Function  (/api/quote)
   Sends quote form submissions to arshad@alfarooque.com
   via Resend API (https://resend.com)

   Required env var: RESEND_API_KEY
   Set it in: Vercel Dashboard → Project → Settings → Environment Variables
   ════════════════════════════════════════════════════════ */

const RECIPIENT  = 'arshad@alfarooque.com';
const FROM_NAME  = 'AL FAROOQUE Quotes';
// Override via RESEND_FROM env var during testing (e.g. onboarding@resend.dev).
// In production set RESEND_FROM=noreply@alfarooque.com after verifying the domain in Resend.
const FROM_EMAIL = process.env.RESEND_FROM || 'noreply@alfarooque.com';

module.exports = async function handler(req, res) {
  console.log('[Quote] Incoming request — method:', req.method, 'path:', req.url);

  // CORS pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    console.warn('[Quote] Rejected non-POST method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Check API key ── */
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Quote] FATAL: RESEND_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'Email service not configured — contact site administrator' });
  }

  /* ── Parse body ── */
  let body = req.body;
  if (!body || typeof body !== 'object') {
    // Fallback: read raw stream (Vercel Node runtime auto-parses JSON, but guard anyway)
    try {
      const raw = await new Promise((resolve, reject) => {
        let s = '';
        req.on('data', c => s += c);
        req.on('end',  () => resolve(s));
        req.on('error', reject);
      });
      body = JSON.parse(raw || '{}');
    } catch (_) {
      body = {};
    }
  }

  /* ── Validate ── */
  const email = (body.email || '').trim();
  if (!email) {
    console.warn('[Quote] Rejected: missing email field');
    return res.status(400).json({ error: 'Email address is required' });
  }

  const fullName = body.first_name
    ? `${body.first_name} ${body.last_name || ''}`.trim()
    : (body.name || '(not provided)');

  console.log('[Quote] Form data received:', {
    name:    fullName,
    company: body.company || '—',
    email,
    phone:   body.phone   || '—',
    service: body.service || '—',
  });

  /* ── Build email ── */
  const subject  = `New Quote Request — ${body.service || 'General Enquiry'} — ${fullName}`;
  const htmlBody = buildEmailHTML({ fullName, email, ...body });

  console.log('[Quote] Calling Resend API → recipient:', RECIPIENT, '| subject:', subject);

  /* ── Send via Resend REST API ── */
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
        reply_to: email,
        subject,
        html:     htmlBody,
      }),
    });

    apiData = await apiResponse.json();
  } catch (err) {
    console.error('[Quote] Network error reaching Resend API:', err.message);
    return res.status(500).json({ error: 'Failed to reach email service' });
  }

  console.log('[Quote] Resend API response — HTTP status:', apiResponse.status, '| body:', JSON.stringify(apiData));

  if (!apiResponse.ok) {
    console.error('[Quote] Email delivery FAILED — Resend error:', JSON.stringify(apiData));
    return res.status(500).json({ error: 'Email delivery failed', detail: apiData });
  }

  console.log('[Quote] SUCCESS — Email sent | id:', apiData.id, '| recipient:', RECIPIENT);
  return res.status(200).json({ success: true, id: apiData.id });
};

/* ── HTML escape ── */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/\n/g, '<br>');
}

/* ── Email template ── */
function buildEmailHTML({ fullName, company, email, phone, service, message }) {
  const ts = new Date().toLocaleString('en-SA', { timeZone: 'Asia/Riyadh', dateStyle: 'long', timeStyle: 'short' });
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#1a1a1a;}
  .wrap{max-width:600px;margin:40px auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0;}
  .hdr{background:linear-gradient(135deg,#0f2442 0%,#1a3a6b 100%);padding:32px;color:#ffffff;}
  .hdr-title{font-size:22px;font-weight:700;margin:0 0 6px;}
  .hdr-sub{font-size:13px;opacity:0.65;margin:0;}
  .body{padding:32px;}
  .row{display:flex;gap:16px;padding:12px 0;border-bottom:1px solid #f0f0f0;}
  .row:last-of-type{border-bottom:none;}
  .lbl{min-width:130px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#888;padding-top:2px;}
  .val{font-size:14px;color:#1a1a1a;line-height:1.5;}
  .msg-box{background:#f7fbfd;border-left:3px solid #22c4de;border-radius:0 6px 6px 0;padding:16px;font-size:14px;line-height:1.7;color:#333;margin-top:24px;}
  .msg-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:10px;}
  .ftr{background:#f9f9f9;padding:16px 32px;font-size:12px;color:#999;border-top:1px solid #eee;text-align:center;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-title">&#128220; New Quote Request</div>
    <div class="hdr-sub">AL FAROOQUE Manufacturing &mdash; ${ts} (AST)</div>
  </div>
  <div class="body">
    <div class="row"><div class="lbl">Full Name</div><div class="val">${esc(fullName)}</div></div>
    <div class="row"><div class="lbl">Company</div><div class="val">${esc(company || '—')}</div></div>
    <div class="row"><div class="lbl">Email</div><div class="val"><a href="mailto:${esc(email)}" style="color:#0ea5e9;">${esc(email)}</a></div></div>
    <div class="row"><div class="lbl">Phone / WhatsApp</div><div class="val">${esc(phone || '—')}</div></div>
    <div class="row"><div class="lbl">Service Required</div><div class="val">${esc(service || '—')}</div></div>
    <div class="msg-lbl">Project Description</div>
    <div class="msg-box">${esc(message || '(not provided)')}</div>
  </div>
  <div class="ftr">Submitted via alfarooque.com &mdash; Reply directly to respond to the customer.</div>
</div>
</body>
</html>`;
}
