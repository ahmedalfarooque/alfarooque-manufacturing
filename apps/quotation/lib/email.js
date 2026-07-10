'use strict';

/* Email delivery for OTP codes — identical pattern to apps/cars/lib/email.js
   (Resend-over-HTTP with retry-on-transient-failure, dev "mock OTP"
   console fallback when RESEND_API_KEY isn't set). */

function env(key) {
  const v = process.env[key];
  return v && String(v).trim() ? String(v).trim() : '';
}

function isConfigured() {
  return !!env('RESEND_API_KEY');
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
      body: JSON.stringify({ from: p.from, to: [p.to], subject: p.subject, html: p.html }),
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

/* General-purpose sender used by the Purchase Request / Daily Update
   notification emails — same Resend account/retry logic as the OTP
   flow below, just not shaped around a one-time code. Defaults `to`
   to EMAIL_TO (the admin inbox already configured in .env.local) so
   callers can omit it entirely for "notify the admin" emails. */
async function sendEmail({ to, subject, html, mockLabel }) {
  const recipient = to || env('EMAIL_TO');
  if (!recipient) {
    console.warn('[email:MOCK] ' + (mockLabel || 'Notification') + ' — no recipient (set EMAIL_TO in apps/projects/.env.local).');
    return { mocked: true };
  }
  if (!isConfigured()) {
    console.warn('[email:MOCK] ' + (mockLabel || 'Notification') + ' for ' + recipient +
      '  (set RESEND_API_KEY in apps/projects/.env.local to send real emails)');
    return { mocked: true };
  }
  const from = env('EMAIL_FROM') || 'noreply@alfarooque.com';
  await withRetries(() => sendViaResend({ to: recipient, from, subject, html }));
  return { mocked: false };
}

async function sendOtpEmail({ to, subject, html, mockLabel, code }) {
  if (!isConfigured()) {
    console.warn('[email:MOCK] ' + (mockLabel || 'OTP') + ' for ' + to + ' — code: ' + code +
      '  (set RESEND_API_KEY in apps/projects/.env.local to send real emails)');
    return { mocked: true };
  }
  return sendEmail({ to, subject, html, mockLabel });
}

module.exports = { isConfigured, sendOtpEmail, sendEmail };
