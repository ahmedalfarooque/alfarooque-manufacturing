/* ═══════════════════════════════════════════════════════════════
   AL FAROOQUE — Glass icon loader
   Fetches assets/icons/glass-icons.svg ONCE and injects it inline at
   the start of <body>, so every `<svg class="gicon"><use href="#gi-x">`
   on the page resolves same-document — required for the sprite's
   gradients/filters and CSS-variable tints to apply in all browsers
   (external-file <use> references don't reliably receive either).
   Cached in sessionStorage so navigation between pages doesn't refetch.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  var KEY = 'af-glass-icons-v2';
  var URL = '/assets/icons/glass-icons.svg';

  function inject(svgText) {
    if (document.getElementById('giSpriteRoot')) return;
    var holder = document.createElement('div');
    holder.id = 'giSpriteRoot';
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    holder.innerHTML = svgText;
    document.body.insertBefore(holder, document.body.firstChild);
    document.documentElement.classList.add('gi-ready');
  }

  function boot() {
    var cached = null;
    try { cached = sessionStorage.getItem(KEY); } catch (e) {}
    if (cached) { inject(cached); return; }
    fetch(URL)
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (text) {
        if (!text || text.indexOf('<svg') === -1) return;
        try { sessionStorage.setItem(KEY, text); } catch (e) {}
        inject(text);
      })
      .catch(function () { /* icons degrade to empty slots; text/labels remain */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
