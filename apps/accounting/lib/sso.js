'use strict';

const jwt = require('jsonwebtoken');

const SSO_COOKIE_NAME = 'af_sso_session';
const APP_COOKIE_NAMES = ['af_quotation_session', 'af_projects_session', 'af_cars_session', 'af_inventory_session', 'af_accounting_session', 'af_crm_session'];
const SSO_TTL_SECONDS = 12 * 60 * 60;

function ssoSecret() {
  const s = process.env.SSO_JWT_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('SSO_JWT_SECRET / JWT_SECRET is not configured.');
  return s;
}

function signSsoSession(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, sso: true },
    ssoSecret(),
    { expiresIn: SSO_TTL_SECONDS }
  );
}

function verifySsoSession(token) {
  try {
    const p = jwt.verify(token, ssoSecret());
    if (!p || p.sso !== true) return null;
    return p;
  } catch (_) { return null; }
}

function cookieDomainForHost(hostHeader) {
  if (process.env.AF_COOKIE_DOMAIN) return process.env.AF_COOKIE_DOMAIN;
  const host = String(hostHeader || '').split(':')[0].toLowerCase();
  if (!host || host === 'localhost' || /^[0-9.]+$/.test(host) || host.endsWith('.vercel.app')) return null;
  const labels = host.split('.');
  if (labels.length < 2) return null;
  return '.' + labels.slice(-2).join('.');
}

function cookieDomainFromReq(req) {
  const h = req.headers.get ? req.headers.get('host') : (req.headers && req.headers.host);
  return cookieDomainForHost(h);
}

function buildCookie(name, value, maxAgeSeconds, domain) {
  const secure = process.env.NODE_ENV !== 'development' ? 'Secure; ' : '';
  const dom = domain ? 'Domain=' + domain + '; ' : '';
  return name + '=' + value + '; Path=/; ' + dom + 'HttpOnly; ' + secure + 'SameSite=Strict; Max-Age=' + maxAgeSeconds;
}

function ssoCookieHeader(token, domain) {
  return buildCookie(SSO_COOKIE_NAME, token, SSO_TTL_SECONDS, domain);
}

function clearSsoCookieHeaders(domain) {
  const out = [buildCookie(SSO_COOKIE_NAME, '', 0, null)];
  if (domain) out.push(buildCookie(SSO_COOKIE_NAME, '', 0, domain));
  return out;
}

function clearAllAppCookieHeaders(domain) {
  const out = [];
  for (const name of APP_COOKIE_NAMES) {
    out.push(buildCookie(name, '', 0, null));
    if (domain) out.push(buildCookie(name, '', 0, domain));
  }
  return out;
}

module.exports = {
  SSO_COOKIE_NAME, APP_COOKIE_NAMES, SSO_TTL_SECONDS,
  ssoSecret, signSsoSession, verifySsoSession,
  cookieDomainForHost, cookieDomainFromReq,
  ssoCookieHeader, clearSsoCookieHeaders, clearAllAppCookieHeaders,
};
