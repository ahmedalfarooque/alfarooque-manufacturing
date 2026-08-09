/* ═══════════════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — PREMIUM SCROLL EXPERIENCE ENGINE
   Lenis (inertia scroll) + GSAP/ScrollTrigger (reveal · parallax · pin)

   Loaded on public marketing pages only (never account/admin/auth).
   Resilient by design: if the CDN libraries fail to load, or the
   visitor prefers reduced motion, every `.reveal`/`[data-reveal]`
   element is made instantly visible instead of staying hidden —
   the page is always readable even without this script.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IS_RTL = document.documentElement.dir === 'rtl';
  const desktopMq = window.matchMedia('(min-width: 992px)');
  const HAS_LIBS = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined' && typeof window.Lenis !== 'undefined';

  function revealEverythingNow(root) {
    const scope = root || document;
    scope.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
    scope.querySelectorAll('[data-reveal]').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
      el.style.clipPath = 'none';
    });
  }

  /* ═══ CORE SCROLL UX — always runs natively, regardless of whether
     GSAP/Lenis are available. This is the same behavior main.js had
     before this file existed (progress bar, nav-scrolled toggle,
     active-link highlight, division-page hero parallax, anchor-link
     scrolling): a CDN outage should only cost the premium animation
     layer below, never this baseline UX. Superseded by the Lenis-driven
     dispatcher further down when the libraries ARE available (that one
     takes over and this native listener is torn down). ═══ */
  const coreDispatcher = (function coreScrollUx() {
    const bar = document.getElementById('progress-bar');
    const nav = document.querySelector('.nav');
    const navAs = [...document.querySelectorAll('.nav-links a, .nav-mobile a')];
    const sections = [...document.querySelectorAll('section[id]')];
    const heroImgs = [...document.querySelectorAll('.svc-hero-img')];
    const isDesktopWidth = () => window.innerWidth >= 992;

    let offsets = [];
    function measure() {
      offsets = sections.map(s => ({ id: s.id, top: s.offsetTop, bottom: s.offsetTop + s.offsetHeight }));
    }
    measure();
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('load', measure);

    function apply(scroll) {
      if (bar) {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? scroll / max : 0) + ')';
      }
      if (nav) nav.classList.toggle('scrolled', scroll > 50);
      if (navAs.length) {
        const y = scroll + 100;
        for (const o of offsets) {
          if (o.top <= y && o.bottom > y) {
            navAs.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + o.id));
            break;
          }
        }
      }
      if (heroImgs.length && isDesktopWidth() && !REDUCED_MOTION) {
        heroImgs.forEach(im => { im.style.transform = 'translateY(' + (scroll * 0.18).toFixed(1) + 'px)'; });
      }
    }

    let ticking = false;
    function nativeHandler() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => { ticking = false; apply(window.scrollY); });
    }
    window.addEventListener('scroll', nativeHandler, { passive: true });
    apply(window.scrollY);

    return { apply, teardownNative: () => window.removeEventListener('scroll', nativeHandler) };
  })();

  /* ═══ ANCHOR-LINK SCROLLING — native fallback (scrollIntoView).
     Replaced by lenis.scrollTo() below once Lenis is available. */
  function nativeAnchorHandler(e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  document.addEventListener('click', nativeAnchorHandler);

  /* Libraries missing (CDN outage/blocked) → premium layer degrades,
     core UX above keeps working. `revealNew` still exposed so
     dynamically-loaded content (product cards fetched after this
     script already ran) is guaranteed visible instead of silently
     staying hidden — see the full explanation on the GSAP path's
     `revealNew` below. */
  if (!HAS_LIBS) {
    revealEverythingNow();
    window.ScrollExperience = { revealNew: (root) => revealEverythingNow(root) };
    return;
  }

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  if (REDUCED_MOTION) {
    revealEverythingNow();
    window.ScrollExperience = { revealNew: (root) => revealEverythingNow(root) };
    return;
  }

  /* ═══ LENIS — native-scroll smoothing (documentElement.scrollTop
     really moves; nothing here uses a transformed wrapper div, since
     too much existing code reads window.scrollY directly). ═══ */
  const lenis = new window.Lenis({
    duration: 1.05,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    syncTouch: false, /* native touch scroll on mobile — avoids fighting existing swipe UIs (product gallery, filter sheet) */
  });
  window.__lenis = lenis;

  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);

  /* Hand the core dispatcher over to Lenis's smoothed scroll value
     instead of the raw native one, and stop double-driving it from
     the native `scroll` event. */
  coreDispatcher.teardownNative();
  lenis.on('scroll', ({ scroll }) => coreDispatcher.apply(scroll));

  /* Upgrade anchor-link scrolling to Lenis (native scrollIntoView would
     otherwise fight Lenis's RAF loop and stutter). */
  document.removeEventListener('click', nativeAnchorHandler);
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: 0, duration: 1.2 }); }
  });

  /* ═══ LEGACY `.reveal` ENGINE — same visual result as the old
     IntersectionObserver version (opacity 0→1, translateY 32→0 via
     the existing CSS transition + `.in` class), just triggered by
     ScrollTrigger instead, so it shares one scroll-observation system
     with everything else on the page.

     `bindReveal`/`bindDataReveal` are factored out (not just an inline
     forEach) because pages that inject content AFTER this script has
     already run — product cards fetched from /api/products and
     rendered by js/products.js and js/products-categories.js — need
     the exact same binding applied to elements that didn't exist yet
     at the point of the one-time querySelectorAll below. Without this,
     any `.reveal`/`[data-reveal]` card added post-load never gets a
     ScrollTrigger and stays permanently at its hidden (opacity:0)
     starting state — invisible forever, not just "mid-animation" —
     since ScrollTrigger.refresh() only recalculates existing triggers'
     positions, it does not discover new elements. `data-reveal-bound`
     guards against double-binding the same element twice. ═══ */
  const REVEAL_PRESETS = {
    'fade-up':    { from: { opacity: 0, y: 46 },                                    to: { opacity: 1, y: 0 } },
    'fade-left':  { from: { opacity: 0, x: IS_RTL ? -70 : 70 },                      to: { opacity: 1, x: 0 } },
    'fade-right': { from: { opacity: 0, x: IS_RTL ? 70 : -70 },                      to: { opacity: 1, x: 0 } },
    'zoom':       { from: { opacity: 0, scale: 0.86 },                              to: { opacity: 1, scale: 1 } },
    'blur':       { from: { opacity: 0, filter: 'blur(16px)' },                     to: { opacity: 1, filter: 'blur(0px)' } },
    'mask':       { from: { opacity: 1, clipPath: 'inset(0 0 100% 0)' },            to: { opacity: 1, clipPath: 'inset(0 0 0% 0)' } },
  };

  function bindReveal(el) {
    if (el.dataset.revealBound) return;
    el.dataset.revealBound = '1';
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => el.classList.add('in'),
    });
  }

  /* Batched per-variant (same as the original single pass) so a group
     of cards entering the viewport together still stagger — this is
     what gives a freshly-rendered product grid its sequential reveal
     instead of every card popping in at once. `scope` lets a re-scan
     (see `revealNew` below) batch only the newly-added elements. */
  function bindDataRevealBatch(scope) {
    Object.keys(REVEAL_PRESETS).forEach(variant => {
      const els = [...scope.querySelectorAll('[data-reveal="' + variant + '"]')]
        .filter(el => !el.dataset.revealBound);
      if (!els.length) return;
      els.forEach(el => { el.dataset.revealBound = '1'; });
      const preset = REVEAL_PRESETS[variant];
      ScrollTrigger.batch(els, {
        start: 'top 88%',
        once: true,
        onEnter: batch => gsap.fromTo(batch, preset.from, {
          ...preset.to,
          duration: 0.95,
          ease: 'power3.out',
          stagger: 0.12,
          overwrite: 'auto',
        }),
      });
    });
  }

  /* Initial page-load scan — identical triggers/timing to before. */
  document.querySelectorAll('.reveal').forEach(bindReveal);
  bindDataRevealBatch(document);

  /* Re-scan hook for dynamically-injected content (see comment above).
     Exposed on window.ScrollExperience.revealNew — call it with the
     newly-inserted container right after adding cards to the DOM. */
  function revealNew(root) {
    const scope = root || document;
    scope.querySelectorAll('.reveal').forEach(bindReveal);
    bindDataRevealBatch(scope);
  }

  /* ═══ `[data-parallax]` / `[data-parallax-speed]` — vertical layer
     depth. Negative speed = moves opposite to scroll (background),
     positive = moves with extra speed (foreground). Desktop only. ═══ */
  if (desktopMq.matches) {
    document.querySelectorAll('[data-parallax]').forEach(el => {
      const speed = parseFloat(el.dataset.parallaxSpeed || '0.25');
      gsap.to(el, {
        y: () => speed * 120,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    });

    /* ═══ `[data-scale-scroll]` — subtle zoom while a large image
       travels through the viewport. ═══ */
    document.querySelectorAll('[data-scale-scroll]').forEach(el => {
      gsap.fromTo(el, { scale: 1 }, {
        scale: 1.08, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    });
  }

  /* ═══ `[data-mouse-parallax]` — small mouse-follow drift for
     floating decorative elements (hero orbits/chips). Own GSAP
     transform, kept off elements that already use [data-tilt]/[data-mag]
     to avoid two systems fighting over one `transform`. ═══ */
  document.querySelectorAll('[data-mouse-parallax]').forEach(el => {
    if (window.innerWidth < 992) return;
    const depth = parseFloat(el.dataset.mouseParallax || '18');
    const scope = el.closest('section') || document.body;
    let rect = null, raf = 0;
    scope.addEventListener('mousemove', e => {
      if (!rect) rect = scope.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        gsap.to(el, { x: px * depth, y: py * depth, duration: 0.7, ease: 'power2.out', overwrite: 'auto' });
      });
    }, { passive: true });
    scope.addEventListener('mouseleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.7, overwrite: 'auto' }));
  });

  /* ═══ `[data-split-reveal]` — word-stagger headline reveal on load
     (no paid GSAP SplitText plugin; a small vanilla word-split). ═══ */
  document.querySelectorAll('[data-split-reveal]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => '<span class="sr-word"><span class="sr-word-in">' + w + '</span></span>').join(' ');
    gsap.fromTo(el.querySelectorAll('.sr-word-in'),
      { yPercent: 110 },
      { yPercent: 0, duration: 0.9, ease: 'power3.out', stagger: 0.05, delay: 0.15 });
  });

  /* ═══ `[data-horizontal-scroll]` — pinned horizontal rail (desktop
     only; falls back to normal stacked/scrollable content on mobile
     since the CSS for this attribute is itself gated by a min-width
     media query — see css/scroll-experience.css). ═══ */
  if (desktopMq.matches) {
    document.querySelectorAll('[data-horizontal-scroll]').forEach(track => {
      const distance = track.scrollWidth - track.parentElement.offsetWidth;
      if (distance <= 0) return;
      gsap.to(track, {
        x: () => -distance,
        ease: 'none',
        scrollTrigger: {
          trigger: track.parentElement,
          start: 'top top',
          end: () => '+=' + distance,
          scrub: 0.6,
          pin: true,
          pinType: 'transform', /* see initPin() comment — avoids fixed-pin drift under Lenis */
          invalidateOnRefresh: true,
        },
      });
    });
  }

  /* ═══ `[data-pin]` — generic sticky-section pin helper, exposed for
     other scripts (e.g. product-detail.js, which must wait for its
     own content to render before the pin height can be measured). ═══ */
  function initPin(el, opts) {
    if (!el || !desktopMq.matches) return null;
    return ScrollTrigger.create(Object.assign({
      trigger: el,
      pin: true,
      pinType: 'transform', /* Lenis drives scroll via its own RAF loop rather than
        letting the browser's native scroll alone own it — GSAP's default `pinType:
        "fixed"` recomputes the pinned element's `top` against scroll on every tick,
        which double-accounts for Lenis's smoothing and makes the "pinned" element
        drift 1:1 with scroll instead of staying put. Forcing transform-based pinning
        (translate the element to counteract scroll, instead of `position:fixed`) is
        the documented fix for GSAP ScrollTrigger + Lenis. */
      start: 'top 100px',
      end: '+=100%',
      pinSpacing: true,
      invalidateOnRefresh: true,
    }, opts || {}));
  }
  document.querySelectorAll('[data-pin]').forEach(el => initPin(el));

  window.ScrollExperience = {
    lenis,
    gsap,
    ScrollTrigger,
    initPin,
    isRtl: IS_RTL,
    isDesktop: () => desktopMq.matches,
    refresh: () => ScrollTrigger.refresh(),
    revealNew,
  };
})();
