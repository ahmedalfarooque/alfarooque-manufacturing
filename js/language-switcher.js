/* ═══════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — LANGUAGE SWITCHER v5.0
   ▸ English is ALWAYS the landing language (every page opens in English)
   ▸ Arabic is opt-in only — loads when the user clicks ع / uses AR links
   ▸ No auto-redirect: a saved choice is never forced on load
   ▸ Convention-based pairing  x.html ⇄ x-ar.html
     → switcher works on EVERY page automatically (incl. future pages)
   ▸ Keeps the user on the SAME page when switching
   ═══════════════════════════════════════════════════════ */
'use strict';

(function () {
  var STORE = 'language';

  /* ── Default to English unless a valid preference was explicitly saved ── */
  var saved = localStorage.getItem(STORE);
  if (saved !== 'en' && saved !== 'ar') {
    saved = 'en';
    localStorage.setItem(STORE, 'en');
  }

  function currentLang() {
    return document.documentElement.lang === 'ar' ? 'ar' : 'en';
  }

  /* Convention-based counterpart, EXTENSION-AGNOSTIC so it works with clean URLs
     (/pages/services-ar) and explicit ones (/pages/services-ar.html) alike:
        /                    ⇄ /index-ar (or /)
        /pages/services      ⇄ /pages/services-ar
        /pages/services.html ⇄ /pages/services-ar.html
     Query string and hash are preserved. */
  function counterpartURL() {
    var path = window.location.pathname;
    var slash = path.lastIndexOf('/');
    var dir = path.substring(0, slash + 1);          /* "/" or "/pages/" */
    var file = path.substring(slash + 1);            /* "services-ar" | "services-ar.html" | "" */
    var hasExt = /\.html$/i.test(file);
    var name = hasExt ? file.replace(/\.html$/i, '') : file;
    if (!name) name = 'index';                       /* root */
    var other = /-ar$/i.test(name) ? name.replace(/-ar$/i, '') : name + '-ar';
    var rebuilt = (other === 'index')
      ? dir                                          /* clean English root "/" */
      : dir + other + (hasExt ? '.html' : '');
    return rebuilt + window.location.search + window.location.hash;
  }

  function go(lang) {
    if (lang === currentLang()) return;        /* already on that language */
    localStorage.setItem(STORE, lang);
    var dest = counterpartURL();
    if (!dest) return;                         /* no counterpart for this page */
    document.body.style.cssText += ';opacity:0;transition:opacity 0.2s ease;';
    setTimeout(function () { window.location.href = dest; }, 180);
  }

  /* ── Switcher pill UI ── */
  function createSwitcher() {
    var lang = currentLang();
    var wrap = document.createElement('div');
    wrap.className = 'lang-switcher';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Language');
    wrap.innerHTML =
      '<button type="button" class="lang-btn' + (lang === 'en' ? ' active' : '') + '" data-lang="en" aria-pressed="' + (lang === 'en') + '">EN</button>' +
      '<button type="button" class="lang-btn ar-btn' + (lang === 'ar' ? ' active' : '') + '" data-lang="ar" aria-pressed="' + (lang === 'ar') + '" style="font-family:\'Cairo\',\'Tajawal\',sans-serif;">ع</button>';
    wrap.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        go(btn.getAttribute('data-lang'));
      });
    });
    return wrap;
  }

  function injectNav() {
    var nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('.lang-switcher')) return;
    var ctrl = nav.querySelector('.nav-controls');
    if (!ctrl) {
      ctrl = document.createElement('div');
      ctrl.className = 'nav-controls';
      var burger = nav.querySelector('.nav-burger');
      burger ? nav.insertBefore(ctrl, burger) : nav.appendChild(ctrl);
    }
    ctrl.insertBefore(createSwitcher(), ctrl.firstChild);
  }

  function injectMobile() {
    var mob = document.querySelector('.nav-mobile');
    if (!mob || mob.querySelector('.lang-switcher')) return;
    var isAr = currentLang() === 'ar';
    var row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:14px 0 0;border-top:1px solid var(--border-1,rgba(255,255,255,0.06));margin-top:6px;gap:12px;';
    row.innerHTML =
      '<span style="font-size:11px;color:var(--grey-500,#94A3B8);letter-spacing:0.14em;text-transform:uppercase;">' +
      (isAr ? 'اللغة' : 'Language') + '</span>';
    row.appendChild(createSwitcher());
    mob.appendChild(row);
  }

  document.addEventListener('DOMContentLoaded', function () {
    /* No auto-redirect: every page opens in its own language.
       English is the default landing language; Arabic is opt-in only
       (via the ع button or Arabic nav links). */
    injectNav();
    injectMobile();
    /* Smooth fade-in */
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { document.body.style.opacity = '1'; });
    });
  });
})();
