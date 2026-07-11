'use strict';

/* Makes the current request's IP available to audit() (lib/crud.js)
   without threading `req` through all ~25 call sites. requireSession/
   requireWrite (called first thing in every route) stamp the IP into
   an AsyncLocalStorage context via enterWith — it then stays available
   for the rest of that request's async continuation automatically,
   with no wrapping callback needed and no cross-request leakage. */

const { AsyncLocalStorage } = require('async_hooks');
const als = new AsyncLocalStorage();

function extractIp(req) {
  try {
    const get = (name) => (req.headers && req.headers.get) ? req.headers.get(name) : (req.headers ? req.headers[name] : null);
    const fwd = get('x-forwarded-for');
    if (fwd) return String(fwd).split(',')[0].trim();
    const real = get('x-real-ip');
    if (real) return String(real).trim();
  } catch (_) {}
  return null;
}

function setRequestIp(req) {
  als.enterWith({ ip: extractIp(req) });
}

function currentIp() {
  const store = als.getStore();
  return store ? store.ip : null;
}

module.exports = { setRequestIp, currentIp };
