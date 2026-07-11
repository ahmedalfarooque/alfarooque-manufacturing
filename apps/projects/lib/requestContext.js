'use strict';

/* Same pattern as apps/quotation/lib/requestContext.js — makes the
   current request's IP available without threading `req` through every
   call site. requireSession stamps it into an AsyncLocalStorage context
   via enterWith, valid for the rest of that request's continuation. */

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
