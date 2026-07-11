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
    /* [{filename, contentBase64, mime}] — optional, both providers
       accept base64 content directly so no Buffer conversion is needed
       until the provider-specific request is built. */
    attachments: Array.isArray(opts.attachments) ? opts.attachments : undefined,
  };

  const send = () => (status.provider === 'resend' ? sendViaResend(payload) : sendViaSmtp(payload));
  return withRetries(send, isRetryableEmailError);
}

/* ── Retry transient send failures (flaky network, provider rate limit,
   provider 5xx) with short backoff — a single hiccup must never be the
   difference between an OTP arriving or not. Never retry definitive
   failures (bad config, missing dependency, 4xx validation/auth errors)
   since those will just fail identically every time. ── */
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 350;
function isRetryableEmailError(err) {
  if (err.code === 'NETWORK') return true;
  if (err.code === 'SEND_FAILED') {
    if (typeof err.status === 'number') return err.status === 429 || err.status >= 500;
    return true; // SMTP transport error with no HTTP status — safe to retry
  }
  return false; // NO_CONFIG, NO_NODEMAILER — retrying changes nothing
}
async function withRetries(fn, isRetryable) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === RETRY_ATTEMPTS || !isRetryable(err)) throw err;
      await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * attempt));
    }
  }
  throw lastErr;
}

/* ── Resend (HTTP) ── */
async function sendViaResend(p) {
  let res, data;
  const hasAttachments = !!(p.attachments && p.attachments.length);
  /* A plain-text send finishes in well under a second; a few MB of
     base64 attachment payload can genuinely take longer than the
     original flat 8s timeout on a slow connection — that previously
     meant a large-attachment send could abort as "NETWORK" on every
     retry and never actually reach Resend at all. */
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), hasAttachments ? 25000 : 8000);
  try {
    const attachments = hasAttachments
      ? p.attachments.map(a => ({ filename: a.filename, content: a.contentBase64, content_type: a.mime || undefined }))
      : undefined;
    if (hasAttachments) {
      console.log('[email] Sending via Resend with ' + attachments.length + ' attachment(s): ' +
        attachments.map(a => a.filename + ' (' + a.content_type + ', ' + Math.round((a.content || '').length * 0.75 / 1024) + 'KB)').join(', '));
    }
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env('RESEND_API_KEY'),
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from: p.from, to: [p.to], reply_to: p.replyTo, subject: p.subject, html: p.html,
        attachments,
      }),
      signal: controller.signal,
    });
    data = await res.json().catch(() => ({}));
    if (hasAttachments) console.log('[email] Resend response: ' + JSON.stringify(data));
  } catch (e) {
    const err = new Error('Could not reach Resend: ' + e.message);
    err.code = 'NETWORK';
    throw err;
  } finally {
    clearTimeout(timeout);
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
      attachments: p.attachments && p.attachments.length
        ? p.attachments.map(a => ({ filename: a.filename, content: a.contentBase64, encoding: 'base64', contentType: a.mime || undefined }))
        : undefined,
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
