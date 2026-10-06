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

/* Test-send recipient selection from the client: must be a list of non-empty
   id strings (uuids in production, `email:type` in the in-memory store).
   Duplicates are collapsed; absent → null (= every enabled recipient).
   Returns { ids } or { error: 'INVALID' | 'EMPTY' }. The engine still
   restricts the ids to enabled recipients of the requested alert type, so a
   foreign/stale id can never add an address. */
const MAX_SELECTED = 100;
function parseRecipientIds(raw) {
  if (raw === undefined || raw === null) return { ids: null };
  if (!Array.isArray(raw) || raw.length > MAX_SELECTED || !raw.every(x => typeof x === 'string' && x.trim().length > 0 && x.length <= 128)) return { error: 'INVALID' };
  const ids = [...new Set(raw.map(x => x.trim()))];
  if (ids.length === 0) return { error: 'EMPTY' };
  return { ids };
}

module.exports = { MAX_RECIPIENTS, normalizeEmail, isValidEmail, parseRecipientIds };
