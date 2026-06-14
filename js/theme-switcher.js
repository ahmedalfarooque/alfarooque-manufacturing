/* ═══════════════════════════════════════════════════════════════════
   ALFAROUQI MANUFACTURING — THEME MANAGER v3.0
   Dark default | Light premium | localStorage | System detection
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ── Apply theme INSTANTLY (no flash) ── */
(function earlyApply() {
  var saved = localStorage.getItem('alfarouqi_theme');
  if (!saved) {
    var sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    saved = sys ? 'light' : 'dark';
  }
  if (saved === 'light') document.body.classList.add('light');
  document.body.setAttribute('data-theme', saved);
})();

/* ── Full manager ── */
(function ThemeManager() {
  var KEY = 'alfarouqi_theme';

  function getCurrent() {
    return document.body.classList.contains('light') ? 'light' : 'dark';
  }

  function apply(theme, animate) {
    if (animate) {
      var ov = document.getElementById('theme-overlay') || createOverlay();
      ov.classList.add('flash');
      setTimeout(function() {
        document.body.classList.toggle('light', theme === 'light');
        document.body.setAttribute('data-theme', theme);
        updateAllButtons();
        setTimeout(function() { ov.classList.remove('flash'); }, 120);
      }, 180);
    } else {
      document.body.classList.toggle('light', theme === 'light');
      document.body.setAttribute('data-theme', theme);
      updateAllButtons();
    }
    localStorage.setItem(KEY, theme);
  }

  function toggle() {
    apply(getCurrent() === 'dark' ? 'light' : 'dark', true);
  }

  function createOverlay() {
    var d = document.createElement('div');
    d.id = 'theme-overlay';
    document.body.appendChild(d);
    return d;
  }

  function makeBtn() {
    var theme = getCurrent();
    var isAr  = document.documentElement.lang === 'ar';
    var btn   = document.createElement('button');
    btn.className = 'glass-ctrl theme-toggle-btn';
    btn.setAttribute('aria-label', isAr ? 'تغيير المظهر' : 'Toggle theme');
    btn.innerHTML =
      '<span class="ctrl-icon">' + (theme === 'light' ? '🌙' : '☀️') + '</span>' +
      '<span class="ctrl-label">' + (theme === 'light' ? (isAr ? 'داكن' : 'Dark') : (isAr ? 'فاتح' : 'Light')) + '</span>';
    btn.addEventListener('click', toggle);
    return btn;
  }

  function updateAllButtons() {
    var theme = getCurrent();
    var isAr  = document.documentElement.lang === 'ar';
    document.querySelectorAll('.theme-toggle-btn').forEach(function(btn) {
      var icon  = btn.querySelector('.ctrl-icon');
      var label = btn.querySelector('.ctrl-label');
      if (icon)  icon.textContent  = theme === 'light' ? '🌙' : '☀️';
      if (label) label.textContent = theme === 'light' ? (isAr ? 'داكن' : 'Dark') : (isAr ? 'فاتح' : 'Light');
    });
  }

  function injectNavBtn() {
    /* Find/create .nav-controls in nav */
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var ctrl = nav.querySelector('.nav-controls');
    if (!ctrl) {
      ctrl = document.createElement('div');
      ctrl.className = 'nav-controls';
      var burger = nav.querySelector('.nav-burger');
      if (burger) nav.insertBefore(ctrl, burger);
      else nav.appendChild(ctrl);
    }
    ctrl.appendChild(makeBtn());
  }

  function injectFloatBtn() {
    var cluster = document.querySelector('.float-controls');
    if (!cluster) {
      cluster = document.createElement('div');
      cluster.className = 'float-controls';
      document.body.appendChild(cluster);
    }
    /* Theme btn goes at bottom of cluster */
    cluster.appendChild(makeBtn());
  }

  function watchSystem() {
    if (!window.matchMedia) return;
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
      if (!localStorage.getItem(KEY)) apply(e.matches ? 'light' : 'dark', true);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    createOverlay();
    updateAllButtons();
    injectNavBtn();
    injectFloatBtn();
    watchSystem();
  });
})();
