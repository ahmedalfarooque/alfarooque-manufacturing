/* ═══════════════════════════════════════════════════════════════
   AL FAROOQUE — Premium 3D Gallery & Lightbox
   gallery3d.js
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var IS_RTL = document.documentElement.dir === 'rtl';

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PREMIUM LIGHTBOX
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

    var images = [];
    var idx = 0;
    var touchX = 0;
    var touchStartCount = 0;

    /* ── Zoom state ── double-click/double-tap toggles a fixed 2.2x
       centered zoom; pinch (two-finger touch) gives a real, live scale
       between 1x and 3x. Both are intentionally simple (no panning) —
       enough to inspect detail on a photo without turning the viewer
       into a full pan-and-zoom widget. Always reset when the image
       changes or the viewer closes, so nothing carries over. */
    var scale = 1;
    var pinching = false;
    var pinchStartDist = 0;
    var pinchStartScale = 1;
    var lastTapTime = 0;
    var lastTapX = 0, lastTapY = 0;

    function applyZoom(next, animate) {
      scale = Math.max(1, Math.min(3, next));
      var img = document.getElementById('glb-img');
      if (!img) return;
      img.style.transition = animate ? '' : 'none';
      img.style.transform = scale > 1 ? 'scale(' + scale + ')' : '';
      img.classList.toggle('glb-img--zoomed', scale > 1.02);
      if (!animate) {
        // force reflow so the next transform change (e.g. pinch release) re-enables transition cleanly
        void img.offsetHeight;
        img.style.transition = '';
      }
    }
    function resetZoom() { applyZoom(1, true); }
    function toggleZoom() { applyZoom(scale > 1 ? 1 : 2.2, true); }

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
      resetZoom();
    }

    function render() {
      var img = document.getElementById('glb-img');
      var counter = document.getElementById('glb-counter');
      if (!img || !images.length) return;

      resetZoom();
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
    lb.querySelector('.glb-prev').addEventListener('click', IS_RTL ? next : prev);
    lb.querySelector('.glb-next').addEventListener('click', IS_RTL ? prev : next);

    var glbImgEl = document.getElementById('glb-img');
    if (glbImgEl) glbImgEl.addEventListener('dblclick', function (e) { e.preventDefault(); toggleZoom(); });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('glb--open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); IS_RTL ? next() : prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); IS_RTL ? prev() : next(); }
    });

    function touchDist(touches) {
      var dx = touches[0].clientX - touches[1].clientX;
      var dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    lb.addEventListener('touchstart', function (e) {
      touchStartCount = e.touches.length;
      if (e.touches.length === 2) {
        pinching = true;
        pinchStartDist = touchDist(e.touches);
        pinchStartScale = scale;
      } else if (e.touches.length === 1) {
        touchX = e.touches[0].clientX;
        /* Manual double-tap detection (dblclick doesn't reliably fire
           on touch): two quick taps close together in place toggle zoom. */
        var now = Date.now();
        var dx = Math.abs(e.touches[0].clientX - lastTapX);
        var dy = Math.abs(e.touches[0].clientY - lastTapY);
        if (now - lastTapTime < 320 && dx < 30 && dy < 30) {
          toggleZoom();
          lastTapTime = 0;
        } else {
          lastTapTime = now;
          lastTapX = e.touches[0].clientX;
          lastTapY = e.touches[0].clientY;
        }
      }
    }, { passive: true });

    lb.addEventListener('touchmove', function (e) {
      if (pinching && e.touches.length === 2) {
        e.preventDefault();
        var ratio = touchDist(e.touches) / (pinchStartDist || 1);
        applyZoom(pinchStartScale * ratio, false);
      }
    }, { passive: false });

    lb.addEventListener('touchend', function (e) {
      var wasPinching = pinching;
      pinching = false;
      if (wasPinching) {
        if (scale < 1.15) resetZoom(); else applyZoom(scale, true);
        return;
      }
      // Never swipe-navigate mid-pinch, while zoomed in, or after a multi-touch gesture.
      if (touchStartCount > 1 || scale > 1) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) {
        IS_RTL ? (dx < 0 ? prev() : next()) : (dx < 0 ? next() : prev());
      }
    }, { passive: true });

    return { open: open, close: close };
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     3D ROTATING CAROUSEL
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function initCarousel(lb) {
    var wrap = document.getElementById('gallery3d-wrap');
    if (!wrap) return;
    var stage = wrap.querySelector('.gallery3d-stage');
    var ring = wrap.querySelector('.gallery3d-ring');
    if (!stage || !ring) return;
    var cards = Array.prototype.slice.call(ring.querySelectorAll('.gallery3d-card'));
    if (!cards.length) return;

    var N = cards.length;
    var R = 0;
    var angle = 0;
    var speed = 0;
    var targetSpeed = 0;
    var wheelTimer = null;
    var resizeTimer = null;
    var hovered = null;
    var rafId = null;

    function getR() {
      var w = window.innerWidth;
      if (w >= 1400) return 590;
      if (w >= 1200) return 510;
      if (w >= 1024) return 450;
      if (w >= 768)  return 370;
      if (w >= 480)  return 295;
      return 235;
    }

    function getCardW() {
      var w = window.innerWidth;
      if (w >= 1024) return 260;
      if (w >= 768)  return 215;
      return 166;
    }

    function getCardH() {
      var w = window.innerWidth;
      if (w >= 1024) return 178;
      if (w >= 768)  return 147;
      return 114;
    }

    function getBaseSpeed() {
      var w = window.innerWidth;
      var s = w >= 1024 ? 0.22 : w >= 768 ? 0.30 : 0.26;
      return IS_RTL ? -s : s;
    }

    function layout() {
      R = getR();
      var cw = getCardW(), ch = getCardH();
      cards.forEach(function (card, i) {
        card.style.width  = cw + 'px';
        card.style.height = ch + 'px';
        card.style.left   = (-cw / 2) + 'px';
        card.style.top    = (-ch / 2) + 'px';
        card.style.transform = 'rotateY(' + ((360 / N) * i) + 'deg) translateZ(' + R + 'px)';
      });
    }

    function tick() {
      speed += (targetSpeed - speed) * 0.05;
      angle += speed;
      ring.style.transform = 'rotateY(' + angle + 'deg)';

      cards.forEach(function (card, i) {
        if (card === hovered) return;
        var facing = ((angle + (360 / N) * i) % 360 + 360) % 360;
        var c = Math.cos(facing * Math.PI / 180);
        /* Front-facing card = fully opaque; the card directly behind the
           ring's center fades to ~20% so the full circular arrangement
           stays visible through it instead of disappearing. */
        card.style.opacity = (0.2 + (c + 1) / 2 * 0.8).toFixed(3);
      });

      rafId = requestAnimationFrame(tick);
    }

    var imgData = cards.map(function (c) {
      var img = c.querySelector('img');
      return { src: img ? img.src : '', alt: img ? img.alt : '' };
    });

    cards.forEach(function (card, i) {
      card.addEventListener('mouseenter', function () {
        hovered = card;
        card.style.opacity = '1';
        var theta = (360 / N) * i;
        card.style.transition = 'transform 0.35s ease, box-shadow 0.35s ease, opacity 0.35s ease';
        card.style.transform = 'rotateY(' + theta + 'deg) translateZ(' + (R + 55) + 'px)';
      });

      card.addEventListener('mouseleave', function () {
        hovered = null;
        var theta = (360 / N) * i;
        card.style.transition = 'transform 0.4s ease, box-shadow 0.35s ease, opacity 0.15s ease';
        card.style.transform = 'rotateY(' + theta + 'deg) translateZ(' + R + 'px)';
        setTimeout(function () { card.style.transition = ''; }, 420);
      });

      card.addEventListener('click', function () {
        if (lb) lb.open(imgData, i);
      });

      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (lb) lb.open(imgData, i);
        }
      });
    });

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var d = e.deltaY > 0 ? 2.0 : -2.0;
      if (IS_RTL) d = -d;
      targetSpeed = getBaseSpeed() + d;
      targetSpeed = Math.max(-9, Math.min(9, targetSpeed));
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () { targetSpeed = getBaseSpeed(); }, 900);
    }, { passive: false });

    var tDragX = 0;
    stage.addEventListener('touchstart', function (e) {
      tDragX = e.touches[0].clientX;
    }, { passive: true });

    stage.addEventListener('touchmove', function (e) {
      var dx = e.touches[0].clientX - tDragX;
      tDragX = e.touches[0].clientX;
      targetSpeed += IS_RTL ? dx * 0.04 : -dx * 0.04;
      targetSpeed = Math.max(-8, Math.min(8, targetSpeed));
    }, { passive: true });

    stage.addEventListener('touchend', function () {
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () { targetSpeed = getBaseSpeed(); }, 700);
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = null;
      } else {
        rafId = requestAnimationFrame(tick);
      }
    });

    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        layout();
        targetSpeed = getBaseSpeed();
      }, 200);
    }, { passive: true });

    layout();
    speed = getBaseSpeed();
    targetSpeed = getBaseSpeed();
    tick();
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     GALLERY PAGE GRID
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function initGrid(lb) {
    var container = document.querySelector('.gallery-masonry');
    if (!container || !lb) return;
    var items = Array.prototype.slice.call(container.querySelectorAll('.gal-item'));
    if (!items.length) return;
    var isPremium = container.classList.contains('gallery-masonry--premium');

    var imgData = items.map(function (item) {
      var img = item.querySelector('img');
      return { src: img ? img.src : '', alt: img ? img.alt : '' };
    });

    items.forEach(function (item, i) {
      item.addEventListener('click', function () { lb.open(imgData, i); });

      if (!isPremium) return;

      /* Keyboard access: these tiles are plain <div>s (not links/
         buttons), so make them real interactive controls — same
         open-on-activate behavior as a click, exposed to keyboard and
         assistive tech. Doesn't touch any other page's .gal-item. */
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', imgData[i].alt || 'View image');
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          lb.open(imgData, i);
        }
      });

      /* Fade-in once the real photo is actually decoded, not just
         requested — img.complete is already true instantly for
         browser-cached images, so this covers both the fresh-lazy-load
         case and the warm-cache case without ever getting stuck. */
      var img = item.querySelector('img');
      if (!img) return;
      var markLoaded = function () { item.classList.add('gi-loaded'); };
      if (img.complete && img.naturalWidth) markLoaded();
      else {
        img.addEventListener('load', markLoaded, { once: true });
        img.addEventListener('error', markLoaded, { once: true });
      }
    });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     BOOTSTRAP
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function init() {
    var lb = createLightbox();
    initCarousel(lb);
    initGrid(lb);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
