/* ═══════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — LANGUAGE SWITCHER v4.0
   ▸ English is ALWAYS default for first-time visitors
   ▸ Reads localStorage key: "language" ("en"|"ar")
   ▸ Smooth redirect to counterpart page
   ▸ Persists across all pages and refreshes
   ═══════════════════════════════════════════════════════ */
'use strict';

(function() {
  var STORE = 'language';

  /* ── Always default to English ── */
  if (!localStorage.getItem(STORE)) {
    localStorage.setItem(STORE, 'en');
  }

  /* Page-to-page map */
  var MAP = {
    'index.html':       'index-ar.html',
    'index-ar.html':    'index.html',
    'about.html':       'about-ar.html',
    'about-ar.html':    'about.html',
    'services.html':    'services-ar.html',
    'services-ar.html': 'services.html',
    'gallery.html':     'gallery-ar.html',
    'gallery-ar.html':  'gallery.html',
    'contact.html':     'contact-ar.html',
    'contact-ar.html':  'contact.html',
  };

  function currentLang() {
    return document.documentElement.lang === 'ar' ? 'ar' : 'en';
  }

  function counterpartURL() {
    var path  = window.location.pathname;
    var file  = path.split('/').pop() || 'index.html';
    /* Handle root / → index.html */
    if (!file || file === '' || file === '/') file = 'index.html';
    var base  = path.substring(0, path.lastIndexOf('/') + 1);
    var other = MAP[file];
    return other ? base + other + window.location.hash : null;
  }

  function redirect(lang) {
    var dest = counterpartURL();
    if (!dest) return;
    localStorage.setItem(STORE, lang);
    document.body.style.cssText += ';opacity:0;transition:opacity 0.2s ease;';
    setTimeout(function() { window.location.href = dest; }, 200);
  }

  /* Auto-redirect returning visitors whose preference differs from current page lang */
  function autoCheck() {
    var saved   = localStorage.getItem(STORE) || 'en';
    var current = currentLang();
    if (saved !== current) {
      redirect(saved);
    }
  }

  /* ── Switcher pill UI ── */
  function createSwitcher() {
    var lang = currentLang();
    var wrap = document.createElement('div');
    wrap.className = 'lang-switcher';
    wrap.setAttribute('role', 'group');
    wrap.innerHTML =
      '<button class="lang-btn' + (lang === 'en' ? ' active' : '') + '" data-lang="en">EN</button>' +
      '<button class="lang-btn ar-btn' + (lang === 'ar' ? ' active' : '') + '" data-lang="ar" style="font-family:\'Cairo\',\'Tajawal\',sans-serif;">ع</button>';
    wrap.querySelectorAll('.lang-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var target = btn.dataset.lang;
        if (target === currentLang()) return;
        redirect(target);
      });
    });
    return wrap;
  }

  function injectNav() {
    var nav  = document.querySelector('.nav');
    if (!nav) return;
    var ctrl = nav.querySelector('.nav-controls');
    if (!ctrl) {
      ctrl = document.createElement('div');
      ctrl.className = 'nav-controls';
      var burger = nav.querySelector('.nav-burger');
      burger ? nav.insertBefore(ctrl, burger) : nav.appendChild(ctrl);
    }
    /* Language before theme — insert at front */
    ctrl.insertBefore(createSwitcher(), ctrl.firstChild);
  }

  function injectFloat() {
    var cluster = document.querySelector('.float-controls');
    if (!cluster) {
      cluster = document.createElement('div');
      cluster.className = 'float-controls';
      document.body.appendChild(cluster);
    }
    /* Language at top of float cluster */
    cluster.insertBefore(createSwitcher(), cluster.firstChild);
  }

  function injectMobile() {
    var mob = document.querySelector('.nav-mobile');
    if (!mob || mob.querySelector('.lang-switcher')) return;
    var isAr = currentLang() === 'ar';
    var row  = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:14px 0 0;border-top:1px solid var(--bd);margin-top:6px;gap:12px;';
    row.innerHTML =
      '<span style="font-size:11px;color:var(--tx-4);letter-spacing:0.14em;text-transform:uppercase;">' +
      (isAr ? 'اللغة' : 'Language') + '</span>';
    row.appendChild(createSwitcher());
    mob.appendChild(row);
  }

  document.addEventListener('DOMContentLoaded', function() {
    autoCheck();
    injectNav();
    injectFloat();
    injectMobile();
    /* Fade page in */
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { document.body.style.opacity = '1'; });
    });
  });
})();
