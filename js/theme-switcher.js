/* ═══════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — THEME SWITCHER v4.1
   ▸ Dark is ALWAYS default for first-time visitors
   ▸ Reads localStorage key: "theme" ("dark"|"light")
   ▸ No system-preference override — dark always wins
   ▸ Flash-free: early script in <head> handles first paint
   ═══════════════════════════════════════════════════════ */
'use strict';

(function() {
  var STORE = 'theme';

  if (!localStorage.getItem(STORE)) {
    localStorage.setItem(STORE, 'dark');
  }

  function current() {
    return localStorage.getItem(STORE) || 'dark';
  }

  /* Cached button list — populated once after DOMContentLoaded */
  var _buttons = null;
  function buttons() {
    if (!_buttons) _buttons = document.querySelectorAll('.theme-toggle-btn');
    return _buttons;
  }

  function apply(theme, animate) {
    if (animate) {
      var ov = document.getElementById('theme-overlay');
      if (ov) { ov.classList.add('flash'); }
      setTimeout(function() {
        _apply(theme);
        if (ov) { setTimeout(function(){ ov.classList.remove('flash'); }, 100); }
      }, 160);
    } else {
      _apply(theme);
    }
    localStorage.setItem(STORE, theme);
  }

  function _apply(theme) {
    var isLight = theme === 'light';
    document.documentElement.classList.toggle('light', isLight);
    document.body.classList.toggle('light', isLight);
    document.documentElement.setAttribute('data-theme', theme);
    updateButtons(theme);
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark', true);
  }

  function updateButtons(theme) {
    var isLight = theme === 'light';
    var isAr    = document.documentElement.lang === 'ar';
    buttons().forEach(function(btn) {
      var icon  = btn.querySelector('.ctrl-icon');
      var lbl   = btn.querySelector('.ctrl-label');
      if (icon)  icon.textContent  = isLight ? '🌙' : '☀️';
      if (lbl)   lbl.textContent   = isLight ? (isAr ? 'داكن' : 'Dark') : (isAr ? 'فاتح' : 'Light');
      btn.setAttribute('aria-pressed', String(isLight));
    });
  }

  function createBtn() {
    var theme = current();
    var isAr  = document.documentElement.lang === 'ar';
    var isLight = theme === 'light';
    var btn   = document.createElement('button');
    btn.className = 'glass-ctrl theme-toggle-btn';
    btn.setAttribute('aria-label', isAr ? 'تغيير المظهر' : 'Toggle theme');
    btn.setAttribute('aria-pressed', String(isLight));
    btn.innerHTML =
      '<span class="ctrl-icon">' + (isLight ? '🌙' : '☀️') + '</span>' +
      '<span class="ctrl-label">' + (isLight ? (isAr ? 'داكن' : 'Dark') : (isAr ? 'فاتح' : 'Light')) + '</span>';
    btn.addEventListener('click', toggle);
    return btn;
  }

  function createOverlay() {
    if (document.getElementById('theme-overlay')) return;
    var d = document.createElement('div');
    d.id = 'theme-overlay';
    d.style.cssText =
      'position:fixed;inset:0;z-index:9990;pointer-events:none;' +
      'background:#0b0f14;opacity:0;transition:opacity 0.18s ease;';
    document.body.appendChild(d);
    /* Style already defined in themes.css — no dynamic <style> injection needed */
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
    ctrl.appendChild(createBtn());
    _buttons = null; /* invalidate cache after adding new button */
  }

  function injectFloat() {
    var cluster = document.querySelector('.float-controls');
    if (!cluster) {
      cluster = document.createElement('div');
      cluster.className = 'float-controls';
      document.body.appendChild(cluster);
    }
    cluster.appendChild(createBtn());
    _buttons = null; /* invalidate cache after adding new button */
  }

  document.addEventListener('DOMContentLoaded', function() {
    createOverlay();
    _apply(current());
    injectNav();
    injectFloat();
  });
})();
