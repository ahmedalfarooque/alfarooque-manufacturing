'use client';

/* Cross-app UI preference cookies (theme + language) so an Admin hopping
   between QuotePro / Projects / Car Inventory keeps the same look without
   re-toggling. Mirrored file: apps/quotation/lib/prefs.js ·
   apps/projects/lib/prefs.js · apps/cars/lib/prefs.js — keep identical.

   The cookie wins over the per-app localStorage key on load because it
   always reflects the most recent choice made in ANY of the apps;
   localStorage is still written as the same-app fallback, so behaviour
   for anyone using a single app is completely unchanged. Non-HttpOnly by
   design — these are pure UI preferences, never secrets. */

export const THEME_PREF_COOKIE = 'af_theme';
export const LANG_PREF_COOKIE = 'af_lang';

export function readPref(name) {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export function writePref(name, value) {
  if (typeof document === 'undefined') return;
  try {
    const host = window.location.hostname;
    let domain = '';
    if (host !== 'localhost' && !/^[0-9.]+$/.test(host) && !host.endsWith('.vercel.app')) {
      const labels = host.split('.');
      if (labels.length >= 2) domain = '; Domain=.' + labels.slice(-2).join('.');
    }
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/' + domain + '; Max-Age=31536000; SameSite=Lax' + secure;
  } catch (_) {}
}
