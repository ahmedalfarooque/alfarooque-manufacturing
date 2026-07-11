/* ═══════════════════════════════════════════════════════════════
   AL FAROOQUE Admin — Lucide → Glass icon shim
   Replaces the lucide CDN entirely. Defines window.lucide.createIcons()
   so js/admin/dashboard.js (which calls lucide.createIcons() after every
   render) keeps working untouched: each <i data-lucide="name"> becomes
   either
     • a glass icon  <svg class="gicon"><use href="#gi-…"/></svg>
       (sprite injected inline by /js/glass-icons.js), or
     • a minimal currentColor stroke glyph for micro-glyphs (plus, x,
       menu, spinners, checkmarks…) where a 3D glass plate would be
       visual noise on a small button.
   MUST load after /js/glass-icons.js and before /js/admin/dashboard.js.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  /* lucide name → glass symbol id (without the "gi-" prefix) */
  var GLASS = {
    'layout-dashboard': 'dashboard',
    'bell':             'bell',
    'shopping-cart':    'bag',
    'users':            'users',
    'user-cog':         'users',
    'user':             'user',
    'file-text':        'receipt',
    'receipt':          'receipt',
    'file-bar-chart':   'receipt',
    'scroll-text':      'receipt',
    'credit-card':      'receipt',
    'banknote':         'receipt',
    'mail':             'mail',
    'mail-plus':        'mail',
    'package':          'box',
    'layers':           'box',
    'warehouse':        'box',
    'factory':          'gear',
    'settings':         'gear',
    'edit':             'gear',
    'pencil':           'gear',
    'bar-chart-3':      'chart',
    'globe':            'target',
    'shield':           'shield',
    'log-out':          'logout',
    'search':           'search',
    'eye':              'search',
    'sun':              'sun',
    'moon':             'moon',
    'clock':            'clock',
    'alert-triangle':   'flag',
    'hammer':           'wrench',
    'wrench':           'wrench',
    'truck':            'truck',
    'folder':           'folder',
    'heart':            'heart'
  };

  /* Micro-glyph fallbacks: names where a glass plate makes no sense.
     Rendered as plain 24×24 currentColor strokes (lucide-compatible
     geometry) so small buttons stay crisp. */
  var GLYPH = {
    'plus':          '<path d="M12 5v14M5 12h14"/>',
    'minus':         '<path d="M5 12h14"/>',
    'x':             '<path d="M18 6 6 18M6 6l12 12"/>',
    'close':         '<path d="M18 6 6 18M6 6l12 12"/>',
    'check':         '<path d="M20 6 9 17l-5-5"/>',
    'check-circle':  '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m22 4-10 10.01-3-2.36"/>',
    'x-circle':      '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    'loader':        '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
    'menu':          '<path d="M4 6h16M4 12h16M4 18h16"/>',
    'trash':         '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    'trash-2':       '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    'chevron-down':  '<path d="m6 9 6 6 6-6"/>',
    'chevron-up':    '<path d="m18 15-6-6-6 6"/>',
    'chevron-left':  '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'arrow-left':    '<path d="M19 12H5m7 7-7-7 7-7"/>',
    'arrow-right':   '<path d="M5 12h14m-7-7 7 7-7 7"/>'
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var XLINK_NS = 'http://www.w3.org/1999/xlink';

  function makeGlass(name, sourceClass) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', ('gicon ' + (sourceClass || '')).trim());
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('data-lucide', name);
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#gi-' + GLASS[name]);
    use.setAttributeNS(XLINK_NS, 'xlink:href', '#gi-' + GLASS[name]);
    svg.appendChild(use);
    return svg;
  }

  function makeGlyph(name, sourceClass) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', ('gi-glyph ' + (sourceClass || '')).trim());
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('data-lucide', name);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    /* Unknown names degrade to a neutral dot so nothing ever errors. */
    svg.innerHTML = GLYPH[name] || '<circle cx="12" cy="12" r="9"/>';
    return svg;
  }

  function createIcons() {
    var nodes = document.querySelectorAll('i[data-lucide]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var name = el.getAttribute('data-lucide') || '';
      var cls = el.getAttribute('class') || '';
      var out = GLASS[name] ? makeGlass(name, cls) : makeGlyph(name, cls);
      if (el.parentNode) el.parentNode.replaceChild(out, el);
    }
  }

  window.lucide = { createIcons: createIcons };

  /* First paint: dashboard.js also calls icons() on boot, but running once
     here covers any static markup on pages that don't. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createIcons);
  } else {
    createIcons();
  }
})();
