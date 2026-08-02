'use client';

export const APPS = [
  { id: 'quotation',  sub: 'quotation',  port: 3030 },
  { id: 'projects',   sub: 'projects',   port: 3020 },
  { id: 'cars',       sub: 'cars',       port: 3010 },
  { id: 'inventory',  sub: 'store',      port: 3040 },
  { id: 'accounting', sub: 'accounting', port: 3050 },
  { id: 'crm',        sub: 'crm',        port: 3060 },
];

const ENV_URLS = {
  quotation:  process.env.NEXT_PUBLIC_QUOTATION_APP_URL,
  projects:   process.env.NEXT_PUBLIC_PROJECTS_APP_URL,
  cars:       process.env.NEXT_PUBLIC_CARS_APP_URL,
  inventory:  process.env.NEXT_PUBLIC_INVENTORY_APP_URL,
  accounting: process.env.NEXT_PUBLIC_ACCOUNTING_APP_URL,
  crm:        process.env.NEXT_PUBLIC_CRM_APP_URL,
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
