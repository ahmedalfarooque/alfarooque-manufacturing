/* ═══════════════════════════════════════════════════════════════════
   ALFAROUQI MANUFACTURING — LANGUAGE MANAGER v3.0
   EN ↔ AR | localStorage | Instant switch | RTL/LTR
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

(function LangManager() {
  var KEY = 'alfarouqi_lang';

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
    var base  = path.replace(file, '');
    var other = MAP[file];
    return other ? base + other + window.location.hash : null;
  }

  function switchTo(lang) {
    if (lang === currentLang()) return;
    localStorage.setItem(KEY, lang);
    var dest = counterpartURL();
    if (!dest) return;
    document.body.style.transition = 'opacity 0.22s ease';
    document.body.style.opacity    = '0';
    setTimeout(function() { window.location.href = dest; }, 220);
  }

  function autoRedirect() {
    var saved   = localStorage.getItem(KEY);
    var current = currentLang();
    if (!saved) {
      var bl = (navigator.language || '').toLowerCase();
      if (bl.startsWith('ar') && current === 'en') { switchTo('ar'); return; }
      return;
    }
    if (saved !== current) switchTo(saved);
  }

  function makeSwitcher() {
    var lang = currentLang();
    var wrap = document.createElement('div');
    wrap.className = 'lang-switcher';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', lang === 'ar' ? 'اختيار اللغة' : 'Language selector');
    wrap.innerHTML =
      '<button class="lang-btn' + (lang === 'en' ? ' active' : '') + '" data-lang="en" aria-label="Switch to English">EN</button>' +
      '<button class="lang-btn ar-btn' + (lang === 'ar' ? ' active' : '') + '" data-lang="ar" aria-label="التبديل إلى العربية">ع</button>';
    wrap.querySelectorAll('.lang-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { switchTo(btn.dataset.lang); });
    });
    return wrap;
  }

  function injectIntoNav() {
    var nav  = document.querySelector('.nav');
    if (!nav) return;
    var ctrl = nav.querySelector('.nav-controls');
    if (!ctrl) {
      ctrl = document.createElement('div');
      ctrl.className = 'nav-controls';
      var burger = nav.querySelector('.nav-burger');
      if (burger) nav.insertBefore(ctrl, burger);
      else nav.appendChild(ctrl);
    }
    /* prepend — lang first, then theme */
    ctrl.insertBefore(makeSwitcher(), ctrl.firstChild);
  }

  function injectFloat() {
    var cluster = document.querySelector('.float-controls');
    if (!cluster) {
      cluster = document.createElement('div');
      cluster.className = 'float-controls';
      document.body.appendChild(cluster);
    }
    /* lang switcher at top of float cluster */
    cluster.insertBefore(makeSwitcher(), cluster.firstChild);
  }

  function injectMobileMenu() {
    var mob = document.querySelector('.nav-mobile');
    if (!mob) return;
    var isAr = currentLang() === 'ar';
    var row  = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 0 0;border-top:1px solid var(--bd);margin-top:6px;gap:12px;';
    row.innerHTML = '<span style="font-size:11px;color:var(--tx-4);letter-spacing:0.14em;text-transform:uppercase;">' + (isAr ? 'اللغة' : 'Language') + '</span>';
    var sw = makeSwitcher();
    row.appendChild(sw);
    mob.appendChild(row);
  }

  document.addEventListener('DOMContentLoaded', function() {
    autoRedirect();
    injectIntoNav();
    injectFloat();
    injectMobileMenu();
    /* Fade in */
    document.body.style.opacity    = '0';
    document.body.style.transition = 'opacity 0.28s ease';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { document.body.style.opacity = '1'; });
    });
  });
})();
