'use strict';

/* Email delivery via Resend over HTTP — same pattern as the main site's
   api/_email.js, including the retry-on-transient-failure hardening.

   Two callers, two policies:
   - sendOtpEmail: login OTPs. Without RESEND_API_KEY the code is logged to
     the server console ("mock OTP") so the app is testable before email
     is wired up — unchanged, per the original brief.
   - sendEmail: fleet expiry alerts and test notifications. ALWAYS real.
     There is no mock path: if Resend is not configured it throws a
     NO_EMAIL_CONFIG error that callers surface as a configuration error,
     and nothing is ever reported as sent unless Resend accepted it. */

function env(key) {
  const v = process.env[key];
  return v && String(v).trim() ? String(v).trim() : '';
}

function isConfigured() {
  return !!env('RESEND_API_KEY');
}

/* What the alert feature needs; `missing` names variables, never values. */
function emailConfig() {
  const missing = [];
  if (!env('RESEND_API_KEY')) missing.push('RESEND_API_KEY');
  if (!env('EMAIL_FROM')) missing.push('EMAIL_FROM');
  return { provider: 'resend', configured: missing.length === 0, missing };
}

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 350;
function isRetryable(err) {
  if (err.code === 'NETWORK') return true;
  if (err.code === 'SEND_FAILED') {
    if (typeof err.status === 'number') return err.status === 429 || err.status >= 500;
    return true;
  }
  return false;
}
async function withRetries(fn) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      if (attempt === RETRY_ATTEMPTS || !isRetryable(err)) throw err;
      await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * attempt));
    }
  }
  throw lastErr;
}

async function sendViaResend(p) {
  let res, data;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: p.from, to: [p.to], subject: p.subject, html: p.html, ...(p.text ? { text: p.text } : {}) }),
      signal: controller.signal,
    });
    data = await res.json().catch(() => ({}));
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
    err.status = res.status;
    throw err;
  }
  return { id: data.id };
}

/* Returns { mocked: true } when running in console-log fallback mode,
   so callers (e.g. the login API) can tell the client an OTP is
   available without a real inbox. */
async function sendOtpEmail({ to, subject, html, mockLabel, code }) {
  if (!isConfigured()) {
    console.warn('[email:MOCK] ' + (mockLabel || 'OTP') + ' for ' + to + ' — code: ' + code +
      '  (set RESEND_API_KEY in apps/cars/.env.local to send real emails)');
    return { mocked: true };
  }
  const from = env('EMAIL_FROM') || 'noreply@alfarooque.com';
  await withRetries(() => sendViaResend({ to, from, subject, html }));
  return { mocked: false };
}

/* Real send for the alert feature. Resolves { id } only when Resend
   accepted the message; throws otherwise (NO_EMAIL_CONFIG / NETWORK /
   SEND_FAILED). Never logs credentials or message bodies. */
async function sendEmail({ to, subject, html, text }) {
  const cfg = emailConfig();
  if (!cfg.configured) {
    const err = new Error('Email is not configured (missing ' + cfg.missing.join(', ') + ').');
    err.code = 'NO_EMAIL_CONFIG';
    err.missing = cfg.missing;
    throw err;
  }
  const out = await withRetries(() => sendViaResend({ to, from: env('EMAIL_FROM'), subject, html, text }));
  return { id: out.id };
}

module.exports = { isConfigured, emailConfig, sendOtpEmail, sendEmail };
