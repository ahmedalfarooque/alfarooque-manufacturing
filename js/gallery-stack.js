/* ═══════════════════════════════════════════════════════════════
   AL FAROOQUE — Stacked / Centered Gallery
   gallery-stack.js
   Replaces the old 3D rotating ring carousel (gallery3d.js) on the
   homepage. Ships its own lightbox (mirrors the #glb pattern that
   gallery3d.js still provides on the gallery pages) so this file has
   no runtime dependency on gallery3d.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var IS_RTL = document.documentElement.dir === 'rtl';

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     LIGHTBOX (same markup/classes as gallery3d.js's #glb so the
     existing .glb CSS in main.css is reused as-is)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function createLightbox() {
    if (document.getElementById('glb')) return bindLightbox();

    var el = document.createElement('div');
    el.id = 'glb';
    el.className = 'glb';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', IS_RTL ? 'عارض الصور' : 'Image viewer');
    el.innerHTML =
      '<div class="glb-bg"></div>' +
      '<button class="glb-close" aria-label="' + (IS_RTL ? 'إغلاق' : 'Close') + '">&#x2715;</button>' +
      '<button class="glb-prev" aria-label="' + (IS_RTL ? 'التالي' : 'Previous') + '">&#8249;</button>' +
      '<button class="glb-next" aria-label="' + (IS_RTL ? 'السابق' : 'Next') + '">&#8250;</button>' +
      '<div class="glb-frame"><img id="glb-img" src="" alt="" class="glb-img"></div>' +
      '<div class="glb-counter" id="glb-counter" aria-live="polite"></div>';
    document.body.appendChild(el);
    return bindLightbox();
  }

  function bindLightbox() {
    var lb = document.getElementById('glb');
    if (!lb) return null;
    if (lb.__gstackBound) return lb.__gstackApi;
    lb.__gstackBound = true;

    var images = [];
    var idx = 0;
    var touchX = 0;

    function open(imgArr, startIdx) {
      images = imgArr;
      idx = startIdx;
      render();
      lb.classList.add('glb--open');
      document.body.classList.add('no-scroll');
      setTimeout(function () {
        var btn = lb.querySelector('.glb-close');
        if (btn) btn.focus();
      }, 50);
    }

    function close() {
      lb.classList.remove('glb--open');
      document.body.classList.remove('no-scroll');
    }

    function render() {
      var img = document.getElementById('glb-img');
      var counter = document.getElementById('glb-counter');
      if (!img || !images.length) return;

      img.classList.remove('glb-img--in');

      var entry = images[idx];
      img.alt = entry.alt || '';
      img.onload = function () { img.classList.add('glb-img--in'); };
      img.onerror = function () { img.classList.add('glb-img--in'); };
      img.src = entry.src;
      if (img.complete && img.naturalWidth) img.classList.add('glb-img--in');

      if (counter) counter.textContent = (idx + 1) + ' / ' + images.length;

      [-1, 1].forEach(function (d) {
        var ni = (idx + d + images.length) % images.length;
        var pre = new Image();
        pre.src = images[ni].src;
      });
    }

    function prev() { idx = (idx - 1 + images.length) % images.length; render(); }
    function next() { idx = (idx + 1) % images.length; render(); }

    lb.querySelector('.glb-bg').addEventListener('click', close);
    lb.querySelector('.glb-close').addEventListener('click', close);
    lb.querySelector('.glb-prev').addEventListener('click', function () { IS_RTL ? next() : prev(); });
    lb.querySelector('.glb-next').addEventListener('click', function () { IS_RTL ? prev() : next(); });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('glb--open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); IS_RTL ? next() : prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); IS_RTL ? prev() : next(); }
    });

    lb.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX;
    }, { passive: true });

    lb.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) {
        IS_RTL ? (dx < 0 ? prev() : next()) : (dx < 0 ? next() : prev());
      }
    }, { passive: true });

    lb.__gstackApi = { open: open, close: close };
    return lb.__gstackApi;
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STACKED / CENTERED GALLERY
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function initStack(lb) {
    var wrap = document.getElementById('gstack-wrap');
    if (!wrap) return;
    var track = wrap.querySelector('.gstack-track');
    if (!track) return;
    var cards = Array.prototype.slice.call(track.querySelectorAll('.gstack-card'));
    if (!cards.length) return;

    var N = cards.length;
    var active = 0;
    var pointerFine = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);

    var imgData = cards.map(function (c) {
      var img = c.querySelector('img');
      return { src: img ? img.src : '', alt: img ? img.alt : '' };
    });

    /* shortest signed distance from i to active, in a circular list of N */
    function normDelta(d) {
      while (d > N / 2) d -= N;
      while (d < -N / 2) d += N;
      return d;
    }

    function render() {
      cards.forEach(function (card, i) {
        var delta = normDelta(i - active);
        // In RTL, "next" reads visually to the left, so mirror the sign.
        var display = IS_RTL ? -delta : delta;
        var pos;
        if (display === 0) pos = 'active';
        else if (Math.abs(display) > 3) pos = 'hidden';
        else pos = (display > 0 ? 'r' : 'l') + Math.abs(display);

        card.dataset.pos = pos;

        if (pos === 'active') {
          card.setAttribute('aria-current', 'true');
        } else {
          card.removeAttribute('aria-current');
        }
        card.setAttribute('tabindex', pos === 'hidden' ? '-1' : '0');
      });
    }

    function setActive(i) {
      active = ((i % N) + N) % N;
      render();
    }

    function step(dir) { setActive(active + dir); }

    /* ── Hover-to-activate (desktop, pointer:fine only) with hover-intent debounce ── */
    if (pointerFine) {
      var hoverTimer = null;
      cards.forEach(function (card, i) {
        card.addEventListener('mouseenter', function () {
          clearTimeout(hoverTimer);
          if (i === active) return;
          hoverTimer = setTimeout(function () { setActive(i); }, 150);
        });
        card.addEventListener('mouseleave', function () {
          clearTimeout(hoverTimer);
        });
      });
    }

    /* ── Click / Enter / Space: activate, or open lightbox if already active ── */
    cards.forEach(function (card, i) {
      card.addEventListener('click', function () {
        if (i === active) { if (lb) lb.open(imgData, i); }
        else setActive(i);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (i === active) { if (lb) lb.open(imgData, i); }
          else setActive(i);
        }
      });
    });

    /* ── Wheel navigation, scoped to the widget only — never fights the
       page's Lenis-driven scroll, which is untouched outside these bounds. ── */
    var wheelAccum = 0;
    var wheelCooldown = false;
    var WHEEL_THRESHOLD = 40;
    var WHEEL_COOLDOWN_MS = 450;

    wrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (wheelCooldown) return;
      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) > WHEEL_THRESHOLD) {
        step(wheelAccum > 0 ? 1 : -1);
        wheelAccum = 0;
        wheelCooldown = true;
        setTimeout(function () { wheelCooldown = false; }, WHEEL_COOLDOWN_MS);
      }
    }, { passive: false });

    /* ── Touch swipe with simple velocity-based snap ── */
    var tStartX = 0, tStartT = 0, tLastX = 0, tLastT = 0;

    wrap.addEventListener('touchstart', function (e) {
      tStartX = tLastX = e.touches[0].clientX;
      tStartT = tLastT = Date.now();
    }, { passive: true });

    wrap.addEventListener('touchmove', function (e) {
      tLastX = e.touches[0].clientX;
      tLastT = Date.now();
    }, { passive: true });

    wrap.addEventListener('touchend', function () {
      var dx = tLastX - tStartX;
      var dt = Math.max(1, tLastT - tStartT);
      var velocity = dx / dt; // px/ms
      var THRESH_DX = 40, THRESH_V = 0.5;
      if (Math.abs(dx) > THRESH_DX || Math.abs(velocity) > THRESH_V) {
        var dir = dx < 0 ? 1 : -1; // swipe left -> next (LTR)
        if (IS_RTL) dir = -dir;    // swipe right -> next (RTL)
        step(dir);
      }
    }, { passive: true });

    /* ── Keyboard (delegated from any focused card, or the wrap itself) ── */
    wrap.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var rightIsNext = !IS_RTL;
      if (e.key === 'ArrowRight') step(rightIsNext ? 1 : -1);
      else step(rightIsNext ? -1 : 1);
    });

    render();
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     BOOTSTRAP
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function init() {
    var lb = createLightbox();
    initStack(lb);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
