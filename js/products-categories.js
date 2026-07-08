/* ════════════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — PRODUCTS PAGE
   Category Showcase Sections (Doors · Tables · Sofa · Beds &
   Accessories · Wardrobes & Cupboards)

   Depends on js/products.js having already run in the same page:
   reuses its global buildCard()/pcCardClickHandler()/PRODUCTS/
   window.__productsReady rather than re-implementing card rendering
   or re-fetching /api/products a second time.
   ════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  var IS_AR = document.documentElement.lang === 'ar';
  var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SLIDE_INTERVAL_MS = 4800;

  /* slug -> DOM ids, set in the HTML markup for each showcase block */
  var CATS = [
    { slug: 'doors' },
    { slug: 'tables' },
    { slug: 'sofa' },
    { slug: 'beds' },
    { slug: 'wardrobes-cupboards' },
  ];

  /* ── Image slider: cross-fade + Ken-Burns between up to 3 images ── */
  function initSlider(sliderEl, images) {
    sliderEl.innerHTML = '';
    if (!images || !images.length) {
      var ph = document.createElement('div');
      ph.className = 'cat-showcase-media-placeholder';
      ph.textContent = IS_AR ? 'الصور قريباً' : 'Images coming soon';
      sliderEl.appendChild(ph);
      return;
    }

    var pick = images.slice(0, 3);

    /* Skeleton shimmer until the first image has actually decoded —
       prevents a flash of empty box on slow connections. */
    sliderEl.classList.add('cat-slider--loading');

    var slides = pick.map(function (src, i) {
      var d = document.createElement('div');
      d.className = 'cat-slide' + (i === 0 ? ' is-active' : '');
      /* Quoted url("…") — several real filenames contain parentheses
         (e.g. "…(Muhannad)_….jpg"), which encodeURIComponent leaves
         bare; unquoted CSS url() treats them as syntax and silently
         drops the whole declaration, leaving the slide blank. */
      d.style.backgroundImage = 'url("' + src + '")';
      sliderEl.appendChild(d);
      return d;
    });

    /* Preload all picked images; reveal as soon as the first lands. */
    pick.forEach(function (src, i) {
      var im = new Image();
      if (i === 0) {
        im.onload = im.onerror = function () { sliderEl.classList.remove('cat-slider--loading'); };
      }
      im.src = src;
    });

    /* Single image, or reduced-motion preference: freeze on first frame */
    if (slides.length < 2 || REDUCED_MOTION) return;

    var cur = 0;
    var paused = false;
    sliderEl.addEventListener('mouseenter', function () { paused = true; });
    sliderEl.addEventListener('mouseleave', function () { paused = false; });

    setInterval(function () {
      if (paused) return;
      var next = (cur + 1) % slides.length;
      slides[cur].classList.remove('is-active');
      /* Force reflow so the Ken-Burns @keyframes animation restarts
         from scale(1) instead of continuing a cached animation state. */
      void slides[next].offsetWidth;
      slides[next].classList.add('is-active');
      cur = next;
    }, SLIDE_INTERVAL_MS);
  }

  /* ── 3-product preview grid, reusing products.js's own card builder
     and click delegation so wishlist/add-to-cart/quick-view/share all
     work identically to the main grid with zero new interaction JS. ── */
  function renderCategoryProducts(wrapEl, items) {
    wrapEl.innerHTML = '';
    if (!items.length) return;
    items.forEach(function (p) {
      var card = window.buildCard(p);
      card.classList.add('visible');
      card.setAttribute('data-reveal', 'fade-up');
      wrapEl.appendChild(card);
    });
    wrapEl.addEventListener('click', window.pcCardClickHandler);
  }

  function boot() {
    /* Images: fetch independently per category, as soon as the page is
       ready — doesn't need to wait on the product catalog. */
    CATS.forEach(function (c) {
      var sliderEl = document.getElementById('catSlider-' + c.slug);
      if (!sliderEl) return;
      fetch('/api/category-images?category=' + encodeURIComponent(c.slug))
        .then(function (res) { return res.json(); })
        .then(function (data) { initSlider(sliderEl, data && data.images); })
        .catch(function () { initSlider(sliderEl, []); });
    });

    /* Products: wait for the same catalog fetch products.js already
       kicked off (window.__productsReady), then filter client-side —
       no second /api/products request. */
    if (!window.__productsReady) return;
    window.__productsReady.then(function () {
      var PRODUCTS = window.PRODUCTS || [];
      CATS.forEach(function (c) {
        var wrapEl = document.getElementById('catProducts-' + c.slug);
        if (!wrapEl) return;
        var items = PRODUCTS.filter(function (p) { return p.cat === c.slug; }).slice(0, 3);
        renderCategoryProducts(wrapEl, items);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
