/* ════════════════════════════════════════════════════════════════
   AL FAROOQUE — Products Hero Typewriter Animation
   Sequence: eyebrow fade → main text types → pause → accent types
             → cursor removed → paragraph fade-up
   Replay: page refresh, back/forward (bfcache), theme toggle.
   Works in both LTR (English) and RTL (Arabic) layouts.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var block   = document.querySelector('.prod-section-header');
    if (!block) return;

    var eyebrow = block.querySelector('.eyebrow');
    var titleEl = block.querySelector('.ps-page-title');
    var subEl   = block.querySelector('.ps-page-sub');
    if (!eyebrow || !titleEl || !subEl) return;

    var accentEl = titleEl.querySelector('.accent');

    /* Capture original text before any manipulation */
    var mainNode = null;
    for (var i = 0; i < titleEl.childNodes.length; i++) {
      if (titleEl.childNodes[i].nodeType === 3) { mainNode = titleEl.childNodes[i]; break; }
    }
    if (!mainNode) return;

    var origMain   = mainNode.textContent;
    var origAccent = accentEl ? accentEl.textContent : '';

    /* Accessibility */
    titleEl.setAttribute('aria-label', (origMain + origAccent).trim());

    /* ── Reduced motion: instant reveal ─────────────────────────── */
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mainNode.textContent = origMain;
      if (accentEl) accentEl.textContent = origAccent;
      eyebrow.style.opacity = '1';
      subEl.style.opacity   = '1';
      return;
    }

    /* ── Generation counter ──────────────────────────────────────
       Incrementing gen aborts any in-flight animation cleanly.   */
    var gen = 0;

    /* ── Reset to initial hidden state ──────────────────────────── */
    function reset() {
      gen++;
      titleEl.classList.remove('ps-typing');
      mainNode.textContent = '';
      if (accentEl) accentEl.textContent = '';

      eyebrow.style.transition = 'none';
      eyebrow.style.opacity    = '0';
      eyebrow.style.transform  = 'translateY(10px)';
      eyebrow.style.willChange = 'opacity, transform';

      subEl.style.transition = 'none';
      subEl.style.opacity    = '0';
      subEl.style.transform  = 'translateY(14px)';
      subEl.style.willChange = 'opacity, transform';
    }

    /* ── Run full animation sequence ─────────────────────────────
       Speed targets:
         "Engineered to " — ~1.2–1.5 s  (14 chars × 45 ms = 630 ms + 460 ms lead)
         200 ms pause
         "Impress"        — ~0.8–1.0 s  ( 7 chars × 50 ms = 350 ms)             */
    function play(g) {
      if (g !== gen) return;
      titleEl.classList.add('ps-typing');

      /* Double-RAF: ensures reset styles are painted before transition starts */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (g !== gen) return;
          eyebrow.style.transition = 'opacity 0.42s ease, transform 0.42s ease';
          eyebrow.style.opacity    = '1';
          eyebrow.style.transform  = 'translateY(0)';
        });
      });

      setTimeout(function () {
        if (g !== gen) return;
        typeChars(mainNode, origMain, 45, g, function () {
          if (g !== gen) return;
          setTimeout(function () {
            if (g !== gen) return;
            if (accentEl) {
              typeChars(accentEl, origAccent, 50, g, function () { finishUp(g); });
            } else {
              finishUp(g);
            }
          }, 200); /* pause between main and accent */
        });
      }, 460);
    }

    /* ── Char-by-char typing (Unicode-safe for Arabic diacritics) ── */
    function typeChars(node, text, baseMs, g, onDone) {
      var chars = Array.from(text);
      var idx   = 0;
      function step() {
        if (g !== gen) return; /* abort if generation changed */
        if (idx < chars.length) {
          node.textContent = chars.slice(0, ++idx).join('');
          setTimeout(step, baseMs + ((Math.random() * 16 - 8) | 0));
        } else {
          if (onDone) onDone();
        }
      }
      step();
    }

    /* ── After typing completes ──────────────────────────────────── */
    function finishUp(g) {
      if (g !== gen) return;
      titleEl.classList.remove('ps-typing');

      setTimeout(function () {
        if (g !== gen) return;
        requestAnimationFrame(function () {
          subEl.style.transition = 'opacity 0.50s ease, transform 0.50s ease';
          subEl.style.opacity    = '1';
          subEl.style.transform  = 'translateY(0)';

          setTimeout(function () {
            eyebrow.style.willChange = 'auto';
            subEl.style.willChange   = 'auto';
          }, 600);
        });
      }, 100);
    }

    /* ── Wait for preloader .done before starting ────────────────
       main.js adds .done to #preloader ~900 ms after window.load  */
    function afterPreloader(fn) {
      var pl = document.getElementById('preloader');
      if (!pl || pl.classList.contains('done')) { fn(); return; }
      var mo = new MutationObserver(function () {
        var p = document.getElementById('preloader');
        if (!p || p.classList.contains('done')) { mo.disconnect(); fn(); }
      });
      mo.observe(document.body, { childList: true });
      mo.observe(pl, { attributes: true, attributeFilter: ['class'] });
    }

    /* ── Initial start (IO + preloader) ─────────────────────────── */
    reset(); /* hide immediately; prevents flash before IO fires */

    if (!window.IntersectionObserver) {
      afterPreloader(function () { play(gen); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          io.disconnect();
          afterPreloader(function () { play(gen); });
        }
      }, { threshold: 0.10 });
      io.observe(block);
    }

    /* ── Replay: back/forward navigation (bfcache restore) ──────── */
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        reset();
        void eyebrow.offsetWidth; /* flush so transition:none takes effect */
        play(gen);
      }
    });

    /* ── Replay: theme toggle (Light ↔ Dark) ─────────────────────
       Debounced 300 ms to let theme transition complete first.    */
    var themeTimer  = null;
    var lastTheme   = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    var themeObs    = new MutationObserver(function () {
      var cur = document.documentElement.classList.contains('light') ? 'light' : 'dark';
      if (cur !== lastTheme) {
        lastTheme = cur;
        clearTimeout(themeTimer);
        themeTimer = setTimeout(function () {
          reset();
          void eyebrow.offsetWidth;
          play(gen);
        }, 300);
      }
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    themeObs.observe(document.body,            { attributes: true, attributeFilter: ['class'] });
  }
})();
