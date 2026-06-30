'use strict';

/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE Manufacturing — Configurable Email Service

   Sends mail via ONE of two providers, chosen from environment vars:

     • resend  — Resend HTTP API   (no extra deps; uses global fetch)
     • smtp    — Nodemailer + SMTP  (your domain mailbox)

   Provider selection (in order):
     1. EMAIL_PROVIDER = "resend" | "smtp"   (explicit)
     2. Auto: SMTP_HOST + SMTP_USER + SMTP_PASS present → smtp
     3. Auto: RESEND_API_KEY present                    → resend
     4. Otherwise → NOT configured (handler returns a clear 500,
        the dev server prints a startup warning — it never crashes)

   NOTHING is hardcoded — all credentials come from env vars only.
   (Files in /api whose name starts with "_" are NOT routed by Vercel,
    so this module is import-only.)
   ═══════════════════════════════════════════════════════════════════ */

const DEFAULT_TO = 'arshad@alfarooque.com';

function env(key) {
  const v = process.env[key];
  return v && String(v).trim() ? String(v).trim() : '';
}

/* Which provider will be used, or null if none is configured. */
function resolveProvider() {
  const explicit = env('EMAIL_PROVIDER').toLowerCase();
  if (explicit === 'resend' || explicit === 'smtp') return explicit;
  if (env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS')) return 'smtp';
  if (env('RESEND_API_KEY')) return 'resend';
  return null;
}

/* Full configuration status — used by the API handler and startup check. */
function getStatus() {
  const provider = resolveProvider();
  const to = env('EMAIL_TO') || DEFAULT_TO;

  if (!provider) {
    return {
      configured: false,
      provider: null,
      to,
      from: null,
      missing: ['RESEND_API_KEY  —or—  SMTP_HOST + SMTP_USER + SMTP_PASS'],
      reason: 'No email provider configured.',
    };
  }

  const missing = [];
  let from;

  if (provider === 'resend') {
    if (!env('RESEND_API_KEY')) missing.push('RESEND_API_KEY');
    from = env('EMAIL_FROM') || env('RESEND_FROM') || 'onboarding@resend.dev';
  } else {
    if (!env('SMTP_HOST')) missing.push('SMTP_HOST');
    if (!env('SMTP_USER')) missing.push('SMTP_USER');
    if (!env('SMTP_PASS')) missing.push('SMTP_PASS');
    from = env('EMAIL_FROM') || env('SMTP_USER');
    if (!from) missing.push('EMAIL_FROM (or SMTP_USER)');
  }

  return {
    configured: missing.length === 0,
    provider,
    to,
    from,
    missing,
    reason: missing.length ? 'Missing: ' + missing.join(', ') : 'OK',
  };
}

/* Send an email through the configured provider.
   Throws an Error with a `.code` on any failure — never silently succeeds. */
async function sendEmail(opts) {
  const status = getStatus();
  if (!status.configured) {
    const err = new Error('Email service not configured. ' + status.reason);
    err.code = 'NO_CONFIG';
    err.missing = status.missing;
    throw err;
  }

  const payload = {
    to:      opts.to      || status.to,
    from:    opts.from    || status.from,
    replyTo: opts.replyTo || undefined,
    subject: opts.subject,
    html:    opts.html,
  };

  if (status.provider === 'resend') return sendViaResend(payload);
  return sendViaSmtp(payload);
}

/* ── Resend (HTTP) ── */
async function sendViaResend(p) {
  let res, data;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env('RESEND_API_KEY'),
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from: p.from, to: [p.to], reply_to: p.replyTo, subject: p.subject, html: p.html,
      }),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    const err = new Error('Could not reach Resend: ' + e.message);
    err.code = 'NETWORK';
    throw err;
  }
  if (!res.ok) {
    const err = new Error((data && data.message) || ('Resend error (HTTP ' + res.status + ')'));
    err.code = 'SEND_FAILED';
    err.detail = data;
    err.status = res.status;
    throw err;
  }
  return { id: data.id, provider: 'resend' };
}

/* ── SMTP (Nodemailer) ── */
async function sendViaSmtp(p) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (e) {
    const err = new Error('nodemailer is not installed. Run: npm install nodemailer');
    err.code = 'NO_NODEMAILER';
    throw err;
  }

  const port   = parseInt(env('SMTP_PORT') || '587', 10);
  const secure = env('SMTP_SECURE')
    ? /^(1|true|yes)$/i.test(env('SMTP_SECURE'))
    : port === 465; /* 465 = implicit TLS; 587/25 = STARTTLS */

  const transporter = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
  });

  let info;
  try {
    info = await transporter.sendMail({
      from: p.from, to: p.to, replyTo: p.replyTo, subject: p.subject, html: p.html,
    });
  } catch (e) {
    const err = new Error('SMTP send failed: ' + e.message);
    err.code = 'SEND_FAILED';
    err.detail = { command: e.command, response: e.response };
    throw err;
  }
  return { id: info.messageId, provider: 'smtp' };
}

module.exports = { getStatus, resolveProvider, sendEmail };
