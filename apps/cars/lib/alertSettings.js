'use strict';

/* Recipient-address rules shared by the settings API (server-side — the
   authoritative check) and the Alerts page (instant feedback). */

const MAX_RECIPIENTS = 50;

function normalizeEmail(raw) {
  return String(raw == null ? '' : raw).trim().toLowerCase();
}

/* Pragmatic RFC-5322 subset: one @, non-empty local part without spaces,
   dotted domain with a 2+ letter TLD. Real deliverability is the mail
   provider's job; this just stops typos and header-injection characters. */
function isValidEmail(email) {
  if (!email || email.length > 254) return false;
  if (/[\s,;<>()[\]\\"]/.test(email)) return false;
  return /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email) && !email.includes('..');
}

module.exports = { MAX_RECIPIENTS, normalizeEmail, isValidEmail };
