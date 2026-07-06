/* ═══════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — NAV ACTIONS
   Wires the header icon cluster (search / wishlist / cart /
   account) that sits in every page's .nav-actions. Reads the
   same localStorage the products page already writes to, so
   badge counts stay correct across pages without a cart drawer.
   ═══════════════════════════════════════════════════════ */
'use strict';

(function() {
  var CART_KEY = 'afq-products-cart';
  var WISH_KEY = 'afq-wishlist';

  function readCount(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return 0;
      var data = JSON.parse(raw);
      if (Array.isArray(data)) return data.length;
      if (data && typeof data === 'object') return Object.keys(data).length;
      return 0;
    } catch (e) { return 0; }
  }

  function setBadge(el, count) {
    if (!el) return;
    el.textContent = count > 99 ? '99+' : String(count);
    el.hidden = count <= 0;
  }

  function refreshBadges() {
    setBadge(document.getElementById('navWishlistBadge'), readCount(WISH_KEY));
    var fabBadge = document.getElementById('cartFabBadge');
    var cartCount = fabBadge ? (parseInt(fabBadge.textContent, 10) || 0) : readCount(CART_KEY);
    setBadge(document.getElementById('navCartBadge'), cartCount);
  }

  function initSearch() {
    var btn   = document.getElementById('navSearchBtn');
    var panel = document.getElementById('navSearchPanel');
    var input = document.getElementById('navSearchInput');
    var close = document.getElementById('navSearchClose');
    var form  = document.getElementById('navSearchForm');
    if (!btn || !panel || !form) return;

    function open() {
      panel.hidden = false;
      requestAnimationFrame(function() { panel.classList.add('is-open'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-expanded', 'true');
      if (input) setTimeout(function() { input.focus(); }, 200);
    }
    function close_() {
      panel.classList.remove('is-open');
      btn.classList.remove('is-active');
      btn.setAttribute('aria-expanded', 'false');
      setTimeout(function() { panel.hidden = true; }, 350);
    }
    btn.addEventListener('click', function() {
      panel.hidden ? open() : close_();
    });
    if (close) close.addEventListener('click', close_);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !panel.hidden) close_();
    });
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var q = (input && input.value || '').trim();
      var url = '/products.html' + (q ? '?search=' + encodeURIComponent(q) : '');
      location.href = url;
    });
  }

  function initCart() {
    var btn = document.getElementById('navCartBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var fab = document.getElementById('cartFab');
      if (fab) { fab.click(); return; }
      location.href = '/products.html?openCart=1';
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    initSearch();
    initCart();
    refreshBadges();
    /* Keep the nav cart badge in sync with the live drawer badge, and
       catch cross-tab wishlist/cart changes via the storage event. */
    var fabBadge = document.getElementById('cartFabBadge');
    if (fabBadge && window.MutationObserver) {
      new MutationObserver(refreshBadges).observe(fabBadge, { childList: true, characterData: true, subtree: true });
    }
    window.addEventListener('storage', function(e) {
      if (e.key === CART_KEY || e.key === WISH_KEY) refreshBadges();
    });
    /* Same-tab writes don't fire 'storage' — poll lightly as a fallback
       so the badge updates right after an add-to-cart/wishlist click. */
    setInterval(refreshBadges, 1500);
  });
})();
