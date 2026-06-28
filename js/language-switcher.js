/* ═══════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — LANGUAGE SWITCHER v7.0
   ▸ English is ALWAYS the landing language
   ▸ Arabic pages use the -ar filename convention:
       /                    ⇄  /index-ar.html
       /pages/about.html    ⇄  /pages/about-ar.html
       /products.html       ⇄  /products-ar.html
   ▸ Keeps the user on the SAME page when switching
   ▸ Saves selected language to localStorage("language")
   ▸ Works with both file paths (/pages/x.html) and
     Vercel clean URLs (/pages/x) — extension is preserved
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

  /* Filename-based counterpart convention:
       /                 → /index-ar.html   (home special case)
       /index-ar.html    → /                (home special case)
       /pages/about.html → /pages/about-ar.html
       /pages/about-ar   → /pages/about     (Vercel clean URL, no extension)
     Query string and hash are preserved. */
  function counterpartURL() {
    var path = window.location.pathname;
    var qs   = window.location.search + window.location.hash;

    /* Normalise trailing slash */
    if (path !== '/' && path.charAt(path.length - 1) === '/') {
      path = path.slice(0, -1);
    }

    /* Home page: / or /index.html  ⇄  /index-ar.html */
    if (path === '/' || path === '/index.html') return '/index-ar.html' + qs;
    if (path === '/index-ar.html')              return '/' + qs;

    /* All other pages: x.html ↔ x-ar.html   (or x ↔ x-ar for clean URLs) */
    var hasExt = /\.html$/i.test(path);
    var base   = hasExt ? path.slice(0, -5) : path;

    var other = /-ar$/i.test(base)
      ? base.replace(/-ar$/i, '')
      : base + '-ar';

    return other + (hasExt ? '.html' : '') + qs;
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
