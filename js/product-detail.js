/* ═══════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — PRODUCT DETAIL PAGE
   Renders a single product on product.html / product-ar.html
   using the exact same data + render logic as the products.html
   modal (prodModal.populateFast/populateSlow), just targeting an
   in-page layout instead of a fixed overlay. Adds: rating stars,
   a wishlist button, related products, and recently-viewed —
   none of which the modal itself renders.

   No reviews/Q&A section — supabase/schema.sql only has an
   aggregate review_count column on products, no reviews table,
   so this intentionally does not fabricate review data. Add a
   real reviews table + API route before building that section.
   ═══════════════════════════════════════════════════════ */
'use strict';

(function() {
  var RECENT_KEY = 'afq-recently-viewed';
  var RECENT_MAX = 8;

  function getIdFromUrl() {
    return parseInt(new URLSearchParams(location.search).get('id'), 10);
  }

  function readRecent() {
    try {
      var raw = localStorage.getItem(RECENT_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function recordRecent(id) {
    var arr = readRecent().filter(function(x) { return x !== id; });
    arr.unshift(id);
    if (arr.length > RECENT_MAX) arr = arr.slice(0, RECENT_MAX);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function renderCardTrack(trackEl, wrapEl, products) {
    if (!trackEl || !wrapEl || !products.length) return;
    trackEl.innerHTML = '';
    products.forEach(function(p) {
      var card = buildCard(p);
      card.classList.add('visible');
      trackEl.appendChild(card);
    });
    trackEl.addEventListener('click', pcCardClickHandler);
    wrapEl.style.display = '';
  }

  function renderRating(p) {
    var el = document.getElementById('pdRating');
    if (!el) return;
    el.innerHTML = starsHtml(p.rating, p.reviewCount);
  }

  function wireWishlist(p) {
    var btn = document.getElementById('pdWishlistBtn');
    if (!btn) return;
    function sync() {
      var inWl = wishlist.has(p.id);
      btn.classList.toggle('wishlisted', inWl);
      var svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', inWl ? 'currentColor' : 'none');
    }
    btn.dataset.id = p.id;
    sync();
    btn.addEventListener('click', function() {
      wishlist.toggle(p.id);
      sync();
    });
  }

  function renderBreadcrumb(p) {
    var catEl  = document.getElementById('pdBcCat');
    var nameEl = document.getElementById('pdBcName');
    if (catEl)  catEl.textContent  = catLabel(p.cat);
    if (nameEl) nameEl.textContent = IS_AR ? p.nameAr : p.name;
  }

  function setMeta(p) {
    var name = IS_AR ? p.nameAr : p.name;
    var desc = IS_AR ? p.descAr : p.desc;
    var suffix = IS_AR ? ' — الفاروقي للتصنيع' : ' — AL FAROOQUE Manufacturing';
    document.title = name + suffix;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && desc) metaDesc.setAttribute('content', desc.slice(0, 160));
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', name);
    if (p.imgs && p.imgs[0]) {
      var ogImg = document.querySelector('meta[property="og:image"]');
      if (!ogImg) {
        ogImg = document.createElement('meta');
        ogImg.setAttribute('property', 'og:image');
        document.head.appendChild(ogImg);
      }
      ogImg.setAttribute('content', p.imgs[0]);
    }
  }

  function showNotFound() {
    var nf = document.getElementById('pdNotFound');
    var modal = document.getElementById('prodModal');
    if (nf) nf.hidden = false;
    if (modal) modal.style.display = 'none';
  }

  async function render() {
    if (window.__productsReady) await window.__productsReady;

    var id = getIdFromUrl();
    var p = isNaN(id) ? null : getProduct(id);
    if (!p) { showNotFound(); return; }

    setMeta(p);
    renderBreadcrumb(p);

    prodModal.currentProduct = p;
    prodModal.currentImgIdx = 0;
    prodModal.modalQty = 1;
    prodModal.populateFast(p);
    prodModal.populateSlow(p);

    renderRating(p);
    wireWishlist(p);

    var before = readRecent().filter(function(x) { return x !== p.id; });
    var recentProducts = before.map(getProduct).filter(Boolean).slice(0, 6);
    recordRecent(p.id);

    var related = PRODUCTS.filter(function(x) { return x.cat === p.cat && x.id !== p.id; }).slice(0, 8);
    renderCardTrack(document.getElementById('pdRelatedTrack'), document.getElementById('pdRelated'), related);
    renderCardTrack(document.getElementById('pdRecentTrack'), document.getElementById('pdRecent'), recentProducts);
  }

  document.addEventListener('DOMContentLoaded', render);
})();
