'use strict';

const THEME_PREF_COOKIE = 'af_theme';
const LANG_PREF_COOKIE = 'af_lang';

function readPref(name) {
  if (typeof document === 'undefined') return null;
  try {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  } catch (_) { return null; }
}

function writePref(name, value) {
  if (typeof document === 'undefined') return;
  const maxAge = 365 * 24 * 3600;
  document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax';
}

module.exports = { THEME_PREF_COOKIE, LANG_PREF_COOKIE, readPref, writePref };
