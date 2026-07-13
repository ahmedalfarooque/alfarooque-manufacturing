'use client';

/* Resolves the URLs of the three sibling apps for the Admin application
   switcher. Mirrored file: apps/quotation/lib/appLinks.js ·
   apps/projects/lib/appLinks.js · apps/cars/lib/appLinks.js — keep
   identical. No hardcoded hostnames; precedence:

   1. NEXT_PUBLIC_*_APP_URL env vars (explicit configuration — works for
      any custom setup, staging domains, unusual ports, …)
   2. localhost / raw IP → the apps' standard dev ports (3030/3020/3010)
   3. production → https://<subdomain>.<current parent domain>, derived
      from wherever the current app is actually being served. */

export const APPS = [
  { id: 'quotation', sub: 'quotation', port: 3030 },
  { id: 'projects', sub: 'projects', port: 3020 },
  { id: 'cars', sub: 'cars', port: 3010 },
];

const ENV_URLS = {
  quotation: process.env.NEXT_PUBLIC_QUOTATION_APP_URL,
  projects: process.env.NEXT_PUBLIC_PROJECTS_APP_URL,
  cars: process.env.NEXT_PUBLIC_CARS_APP_URL,
};

export function getAppUrl(id) {
  const fromEnv = ENV_URLS[id];
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (typeof window === 'undefined') return '';
  const app = APPS.find(a => a.id === id);
  if (!app) return '';
  const { hostname, protocol } = window.location;
  if (hostname === 'localhost' || /^[0-9.]+$/.test(hostname)) {
    return protocol + '//' + hostname + ':' + app.port;
  }
  const labels = hostname.split('.');
  const base = labels.length >= 3 ? labels.slice(1).join('.') : hostname;
  return 'https://' + app.sub + '.' + base;
}
