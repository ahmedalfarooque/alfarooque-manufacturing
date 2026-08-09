'use strict';

/* Shared ERP OTP delivery pattern: Resend over HTTP with bounded retries.
   The service-role/database credentials never leave the server. */
function env(key) {
  const value = process.env[key];
  return value && String(value).trim() ? String(value).trim() : '';
}

function isConfigured() { return !!env('RESEND_API_KEY'); }

const RETRY_ATTEMPTS = 3;
async function sendViaResend(message) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response, data;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify(message), signal: controller.signal,
    });
    data = await response.json().catch(() => ({}));
  } finally { clearTimeout(timeout); }
  if (!response.ok) {
    const error = new Error(data.message || `Resend error (HTTP ${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function sendOtpEmail({ to, subject, html, mockLabel, code }) {
  if (!isConfigured()) {
    console.warn(`[email:MOCK] ${mockLabel || 'OTP'} for ${to} — code: ${code}`);
    return { mocked: true };
  }
  let lastError;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      await sendViaResend({ from: env('EMAIL_FROM') || 'noreply@alfarooque.com', to: [to], subject, html });
      return { mocked: false };
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_ATTEMPTS || (error.status && error.status !== 429 && error.status < 500)) throw error;
      await new Promise(resolve => setTimeout(resolve, 350 * attempt));
    }
  }
  throw lastError;
}

module.exports = { isConfigured, sendOtpEmail };
