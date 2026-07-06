/* ════════════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — PRODUCTS PAGE v1.0
   Hero Slider · Product Grid · Cart · Modal · Orders
   ════════════════════════════════════════════════════════════ */
'use strict';

/* ════ CONFIG — update before going live ════ */
var WA_NUMBER   = '966545542792';       // WhatsApp number, no leading +
var ORDER_EMAIL = 'arshad@alfarooque.com';
var CART_KEY    = 'afq-products-cart';
var SLIDE_MS    = 5000;                 // Hero auto-advance interval (ms)

/* ════ LANGUAGE ════ */
var IS_AR = document.documentElement.lang === 'ar';
var BASE_PATH = IS_AR ? '' : '';        // Both files in root; assets path same

/* ════ POLYFILLS ════ */
var _ric = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : function(cb) { setTimeout(cb, 1); };

/* ════════════════════════════════════════════
   PRODUCT DATA
   ════════════════════════════════════════════ */
/* Products page reads product data exclusively from /api/products, which
   is the SAME public.products table the Admin Dashboard edits (see
   api/admin/products.js) — this is the single source of truth. There is
   no static/seed/mock product list anywhere in this file: an admin price
   or content edit is live on this page on next load, with nothing else
   to keep in sync.

   window.__productsReady resolves once the fetch settles (success or
   failure) so anything that reads PRODUCTS on page load — this file's
   own renderProducts() and product-filter.js's pfRenderAll() — waits for
   it first instead of racing an empty array. */
var PRODUCTS = [];
var PRODUCTS_MAP = {};
function getProduct(id) { return PRODUCTS_MAP[id] || null; }

/* Category display names/order also come live from the database (the
   same public.categories table the Admin Dashboard's Categories module
   edits) — previously catLabel() below used a hardcoded name map, so
   renaming a category in the admin never showed up on this page. */
var CATEGORIES_MAP = {};

var _productsReadyResolve;
window.__productsReady = new Promise(function (resolve) { _productsReadyResolve = resolve; });

(function loadProductsFromApi() {
  Promise.all([
    fetch('/api/products').then(function (res) { return res.json(); }),
    fetch('/api/categories').then(function (res) { return res.json(); }).catch(function () { return { categories: [] }; }),
  ])
    .then(function (results) {
      var data = results[0], catData = results[1];

      var rows = (data && data.products) || [];
      PRODUCTS = rows.map(function (row) {
        /* sizes is the only field the old static catalog didn't already
           split by language at the data layer (t() baked the fallback
           string into whichever language the page happened to be at
           parse time) — pick the right one here, once, so every other
           part of this file keeps reading p.sizes exactly as before. */
        row.sizes = (IS_AR && row.sizesAr && row.sizesAr.length) ? row.sizesAr : row.sizes;
        return row;
      });
      PRODUCTS_MAP = {};
      PRODUCTS.forEach(function (p) { PRODUCTS_MAP[p.id] = p; });

      CATEGORIES_MAP = {};
      ((catData && catData.categories) || []).forEach(function (c) {
        CATEGORIES_MAP[c.slug] = { name: c.name, nameAr: c.name_ar || c.name };
      });
    })
    .catch(function (err) {
      console.error('[Products] Failed to load catalog from /api/products or /api/categories:', err);
      PRODUCTS = [];
      PRODUCTS_MAP = {};
      CATEGORIES_MAP = {};
    })
    .then(function () { _productsReadyResolve(); });
})();

/* ════ Helper ════ */
function t(en, ar) { return IS_AR ? ar : en; }
function fmt(n) { return 'SAR ' + Number(n).toLocaleString('en-US'); }
function esc(s) { return encodeURIComponent(s); }
function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/* ════ Wishlist ════ */
var wishlist = {
  _key: 'afq-wishlist',
  _set: null,
  _load: function() {
    if (this._set) return;
    try { this._set = new Set(JSON.parse(localStorage.getItem(this._key) || '[]')); }
    catch(e) { this._set = new Set(); }
  },
  _save: function() {
    try { localStorage.setItem(this._key, JSON.stringify(Array.from(this._set))); } catch(e){}
  },
  has: function(id) { this._load(); return this._set.has(id); },
  toggle: function(id) {
    this._load();
    if (this._set.has(id)) this._set.delete(id); else this._set.add(id);
    this._save();
    var added = this._set.has(id);
    /* Sync to Supabase if the user is logged in */
    if (window.AFAuth && typeof window.AFAuth.currentUser === 'function'
        && window.AFAuth.currentUser()
        && typeof window.AFAuth.toggleWishlist === 'function') {
      window.AFAuth.toggleWishlist(id, added).catch(function(){});
    }
    /* Store product metadata in localStorage so dashboard can show names/prices */
    try {
      var WM_KEY = 'afq-wishlist-meta';
      var wm = {};
      try { wm = JSON.parse(localStorage.getItem(WM_KEY) || '{}'); } catch(e) {}
      if (added) {
        var prod = null;
        for (var _pi = 0; _pi < PRODUCTS.length; _pi++) {
          if (PRODUCTS[_pi].id === id) { prod = PRODUCTS[_pi]; break; }
        }
        if (prod) {
          wm[String(id)] = { nameEn: prod.name || '', nameAr: prod.nameAr || prod.name || '',
            price: prod.price || 0, img: prod.img || '', cat: prod.cat || '' };
        }
      } else {
        delete wm[String(id)];
      }
      localStorage.setItem(WM_KEY, JSON.stringify(wm));
    } catch(_e) {}
    return added;
  }
};

/* ════ Share ════ */
function productDetailUrl(id) {
  return (IS_AR ? '/product-ar.html' : '/product.html') + '?id=' + id;
}

function shareProduct(p) {
  var name = IS_AR ? p.nameAr : p.name;
  var url  = window.location.origin + productDetailUrl(p.id);
  if (navigator.share) {
    navigator.share({ title: name, text: name + ' — AL FAROOQUE Manufacturing', url: url }).catch(function(){});
  } else {
    try { navigator.clipboard.writeText(url); } catch(e){}
    var el = document.getElementById('pfShareToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pfShareToast';
      el.className = 'pf-share-toast';
      document.body.appendChild(el);
    }
    el.textContent = t('Link copied!', 'تم نسخ الرابط!');
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); }, 2200);
  }
}

/* ════ Stars renderer ════ */
function starsHtml(rating, reviewCount) {
  if (!rating) return '';
  var full = Math.floor(rating);
  var half = (rating - full) >= 0.5;
  var html = '<div class="prod-rating">';
  html += '<span class="prod-stars" aria-label="' + rating + ' out of 5">';
  for (var i = 0; i < 5; i++) {
    if (i < full)            html += '<span class="star star-full">★</span>';
    else if (i === full && half) html += '<span class="star star-half">★</span>';
    else                     html += '<span class="star star-empty">★</span>';
  }
  html += '</span>';
  if (reviewCount) html += '<span class="prod-review-count">(' + reviewCount + ')</span>';
  html += '</div>';
  return html;
}

/* ════════════════════════════════════════════
   HERO SLIDER
   ════════════════════════════════════════════ */
var slider = {
  cur: 0,
  total: 0,
  timer: null,
  progressTimer: null,
  slides: [],
  dots: [],
  progressEl: null,

  init: function() {
    this.slides = document.querySelectorAll('.ph-slide');
    this.dots   = document.querySelectorAll('.ph-dot');
    this.progressEl = document.getElementById('phProgress');
    this.total  = this.slides.length;
    if (!this.total) return;

    // Arrows
    var prev = document.getElementById('phPrev');
    var next = document.getElementById('phNext');
    var self = this;
    if (prev) prev.addEventListener('click', function() { self.go(self.cur - 1); });
    if (next) next.addEventListener('click', function() { self.go(self.cur + 1); });

    // Dots
    this.dots.forEach(function(d, i) {
      d.addEventListener('click', function() { self.go(i); });
    });

    // Touch swipe
    var startX = 0;
    var sliderEl = document.getElementById('phSlider');
    if (sliderEl) {
      sliderEl.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, {passive:true});
      sliderEl.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) self.go(dx < 0 ? self.cur + 1 : self.cur - 1);
      }, {passive:true});
    }

    this.show(0);
    this.startAuto();
    // Don't burn a timer + CSS transition advancing slides nobody is
    // watching while the tab is in the background.
    document.addEventListener('visibilitychange', function() {
      document.hidden ? self.stopAuto() : self.startAuto();
    });

    // Parallax on scroll — cache references once
    var phHero = document.querySelector('.ph-hero');
    var phBgs  = document.querySelectorAll('.ph-slide-bg');
    if (phHero && phBgs.length) {
      var phTicking = false;
      window.addEventListener('scroll', function() {
        if (phTicking) return; phTicking = true;
        requestAnimationFrame(function() {
          phTicking = false;
          var y = window.scrollY;
          var heroH = phHero.offsetHeight;
          if (y > heroH) return;
          var ratio = y / heroH;
          var val = 'translateY(' + (ratio * 30) + '%)';
          for (var i = 0; i < phBgs.length; i++) {
            phBgs[i].style.transform = val;
          }
        });
      }, {passive: true});
    }
  },

  go: function(idx) {
    var n = ((idx % this.total) + this.total) % this.total;
    this.show(n);
    this.resetAuto();
  },

  show: function(idx) {
    var self = this;
    this.slides.forEach(function(s, i) { s.classList.toggle('active', i === idx); });
    this.dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });
    this.cur = idx;
    this.startProgress();
  },

  startAuto: function() {
    var self = this;
    this.timer = setInterval(function() { self.go(self.cur + 1); }, SLIDE_MS);
  },

  stopAuto: function() {
    clearInterval(this.timer);
  },

  resetAuto: function() {
    clearInterval(this.timer);
    this.startAuto();
  },

  startProgress: function() {
    var el = this.progressEl;
    if (!el) return;
    el.style.transition = 'none';
    el.style.width = '0%';
    var self = this;
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        el.style.transition = 'width ' + SLIDE_MS + 'ms linear';
        el.style.width = '100%';
      });
    });
  }
};

/* ════════════════════════════════════════════
   PRODUCT RENDERING
   ════════════════════════════════════════════ */
var grid = document.getElementById('prodGrid');

/* Category display name comes from the live public.categories table
   (CATEGORIES_MAP, populated in loadProductsFromApi() above) — renaming
   a category in the Admin Dashboard shows up here on next load. The
   small map below is only a graceful-degradation fallback (e.g. a
   momentary network hiccup on /api/categories), not a second source of
   truth: it's never preferred over live data when live data exists. */
function catLabel(cat) {
  var live = CATEGORIES_MAP[cat];
  if (live) return IS_AR ? live.nameAr : live.name;
  var fallback = {
    doors:     t('Doors','الأبواب'),
    wood:      t('Wood Works','أعمال الخشب'),
    steel:     t('Steel Works','أعمال الحديد'),
    aluminium: t('Aluminium Works','أعمال الألومنيوم'),
    beds:      t('Beds & Accessories','الأسرة والإكسسوارات'),
    sofa:      t('Sofa','الكنب'),
    'aluminium-windows': t('Aluminium Windows','نوافذ الألمنيوم'),
    'fire-rated-doors':  t('Fire Rated Doors','أبواب مقاومة للحريق')
  };
  return fallback[cat] || cat;
}

/* ════════════════════════════════════════════
   PRODUCT IMAGE STACK
   ════════════════════════════════════════════ */
function ProductImageStack(container, imgs, name, productId) {
  this.container   = container;
  this.imgs        = imgs;
  this.name        = name;
  this.productId   = productId;
  this.frontIdx    = 0;
  this.locked      = false;
  this._touchStartX = 0;
  /* true on devices that have a real pointer and support CSS :hover */
  this._hasHover   = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  this._build();
}

/* Returns 'front'|'left'|'right'|'back' for image at imgIdx given current frontIdx.
   n=1: only front
   n=2: front + right
   n=3: front, left(1), right(2)
   n=4: front, left(1), back(2), right(3) */
ProductImageStack.prototype._posOf = function(imgIdx) {
  var n    = this.imgs.length;
  var diff = (imgIdx - this.frontIdx + n) % n;
  if (diff === 0) return 'front';
  if (n === 2)    return 'right';
  if (diff === 1) return 'left';
  if (n === 3)    return 'right';
  if (diff === 2) return 'back';
  return 'right';
};

ProductImageStack.prototype._build = function() {
  var self = this;
  var n = this.imgs.length;
  this.container.innerHTML = '';

  var wrap = document.createElement('div');
  wrap.className = 'iss-wrap';
  this.container.appendChild(wrap);
  this._wrap = wrap;

  this._cards = this.imgs.map(function(src, i) {
    var card = document.createElement('div');
    card.className    = 'iss-card';
    card.dataset.pos  = self._posOf(i);
    card.dataset.idx  = i;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', self.name + ' — ' + t('Image', 'صورة') + ' ' + (i + 1));
    card.setAttribute('tabindex', i === 0 ? '0' : '-1');
    var img       = document.createElement('img');
    img.src        = src;
    img.alt        = self.name + ' ' + (i + 1);
    img.loading    = i === 0 ? 'eager' : 'lazy';
    img.decoding   = 'async';
    card.appendChild(img);
    wrap.appendChild(card);
    return card;
  });

  /* Counter: "1/3" top-right — only shown when n > 1 */
  if (n > 1) {
    var counter = document.createElement('div');
    counter.className = 'iss-counter';
    counter.setAttribute('aria-hidden', 'true');
    counter.textContent = '1/' + n;
    this.container.appendChild(counter);
    this._counter = counter;
  } else {
    this._counter = null;
  }

  /* Navigation dots — only shown when n > 1 */
  if (n > 1) {
    var dotsWrap = document.createElement('div');
    dotsWrap.className = 'iss-dots';
    dotsWrap.setAttribute('aria-hidden', 'true');
    this._dotEls = this.imgs.map(function(_, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'iss-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', t('Image', 'صورة') + ' ' + (i + 1));
      dot.addEventListener('click', function(e) {
        e.stopPropagation();
        self.rotateTo(i);
      });
      dotsWrap.appendChild(dot);
      return dot;
    });
    this.container.appendChild(dotsWrap);
  } else {
    this._dotEls = [];
  }

  this._applyZ();
  this._bind();
};

/* Sync z-index, counter, and dots to current frontIdx */
ProductImageStack.prototype._applyZ = function() {
  var self = this;
  var n = this.imgs.length;
  this._cards.forEach(function(card, i) {
    card.style.zIndex = self._posOf(i) === 'front' ? '3' : '2';
    card.setAttribute('tabindex', self._posOf(i) === 'front' ? '0' : '-1');
  });
  if (this._counter) {
    this._counter.textContent = (this.frontIdx + 1) + '/' + n;
  }
  if (this._dotEls && this._dotEls.length) {
    this._dotEls.forEach(function(dot, i) {
      dot.classList.toggle('active', i === self.frontIdx);
    });
  }
};

/* Smoothly rotate so newFront becomes the front image */
ProductImageStack.prototype.rotateTo = function(newFront) {
  if (newFront === this.frontIdx || this.locked) return;
  this.locked = true;
  var self    = this;
  var n       = this.imgs.length;

  /* Elevate the incoming card above the current front before the CSS transition fires */
  this._cards[newFront].style.zIndex = '4';

  this.frontIdx = newFront;
  this._cards.forEach(function(card, i) {
    card.dataset.pos = self._posOf(i);
  });

  /* Update counter and dots immediately for instant feedback */
  if (this._counter) {
    this._counter.textContent = (this.frontIdx + 1) + '/' + n;
  }
  if (this._dotEls && this._dotEls.length) {
    this._dotEls.forEach(function(dot, i) {
      dot.classList.toggle('active', i === self.frontIdx);
    });
  }

  /* Normalise z-indices after the CSS transition completes */
  setTimeout(function() {
    self.locked = false;
    self._applyZ();
  }, 520);
};

ProductImageStack.prototype._bind = function() {
  var self = this;
  var n    = this.imgs.length;
  var wrap = this._wrap;

  /* ── Desktop hover: mouseover delegates to the wrap (mouseenter doesn't bubble) ── */
  if (self._hasHover) {
    wrap.addEventListener('mouseover', function(e) {
      var card = e.target.closest('.iss-card');
      if (!card) return;
      var i = parseInt(card.dataset.idx, 10);
      if (self._posOf(i) !== 'front') self.rotateTo(i);
    });
  }

  /* ── Click / tap: single delegated listener on the wrap ── */
  wrap.addEventListener('click', function(e) {
    var card = e.target.closest('.iss-card');
    if (!card) return;
    e.stopPropagation();
    var i = parseInt(card.dataset.idx, 10);
    var isFront = self._posOf(i) === 'front';
    if (!self._hasHover && !isFront) {
      self.rotateTo(i);
    } else {
      imgGallery.open(self.productId, i);
    }
  });

  /* ── Keyboard: single delegated listener on the wrap ── */
  wrap.addEventListener('keydown', function(e) {
    if (!e.target.closest('.iss-card')) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      self.rotateTo((self.frontIdx + 1) % n);
      self._cards[self.frontIdx].focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      self.rotateTo((self.frontIdx - 1 + n) % n);
      self._cards[self.frontIdx].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      imgGallery.open(self.productId, self.frontIdx);
    }
  });

  /* ── Touch swipe ── */
  wrap.addEventListener('touchstart', function(e) {
    self._touchStartX = e.touches[0].clientX;
  }, { passive: true });

  wrap.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - self._touchStartX;
    if (Math.abs(dx) > 35) {
      var newFront = dx < 0
        ? (self.frontIdx - 1 + n) % n
        : (self.frontIdx + 1) % n;
      self.rotateTo(newFront);
    }
  }, { passive: true });
};

/* ════════════════════════════════════════════
   CART TOAST
   ════════════════════════════════════════════ */
var _toastEl    = null;
var _toastTimer = null;

function showCartToast(productName) {
  if (!_toastEl) {
    var el = document.createElement('div');
    el.className = 'cart-toast';
    el.innerHTML = [
      '<span class="cart-toast-icon">',
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      '</span>',
      '<div class="cart-toast-body">',
        '<div class="cart-toast-title">' + t('Added to Cart', 'أُضيف إلى السلة') + '</div>',
        '<div class="cart-toast-name"></div>',
      '</div>',
      '<button class="cart-toast-view">' + t('View Cart', 'عرض السلة') + '</button>',
      '<button class="cart-toast-close" aria-label="' + t('Close', 'إغلاق') + '">&times;</button>'
    ].join('');
    document.body.appendChild(el);
    _toastEl = el;
    el.querySelector('.cart-toast-view').addEventListener('click', function() {
      cart.openDrawer();
      _hideCartToast();
    });
    el.querySelector('.cart-toast-close').addEventListener('click', _hideCartToast);
  }
  _toastEl.querySelector('.cart-toast-name').textContent = productName;
  clearTimeout(_toastTimer);
  _toastEl.classList.add('show');
  _toastTimer = setTimeout(_hideCartToast, 3200);
}

function _hideCartToast() {
  if (_toastEl) _toastEl.classList.remove('show');
  clearTimeout(_toastTimer);
}

/* ════════════════════════════════════════════
   CARD BUILDER
   ════════════════════════════════════════════ */
function buildCard(p) {
  var name        = IS_AR ? p.nameAr : p.name;
  var desc        = IS_AR ? p.descAr : p.desc;
  var warrantyLbl = IS_AR ? p.warrantyLabelAr : p.warrantyLabel;
  var detailsLbl  = t('View Details','عرض التفاصيل');
  var orderLbl    = t('Order Now','اطلب الآن');
  var addCartLbl  = t('Add to Cart','أضف للسلة');
  var hasImgs     = p.imgs && p.imgs.length > 0;
  var catLbl      = catLabel(p.cat);
  var inWishlist  = wishlist.has(p.id);

  /* Image area */
  var imgArea = document.createElement('div');
  imgArea.className = 'prod-card-img';

  if (hasImgs) {
    new ProductImageStack(imgArea, p.imgs, name, p.id);
  } else {
    var noImg = document.createElement('div');
    noImg.className = 'prod-card-no-img';
    noImg.innerHTML =
      '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
      '<span>' + t('Image Coming Soon','الصورة قريباً') + '</span>';
    imgArea.appendChild(noImg);
  }

  /* Category badge — after image stack so ProductImageStack._build() doesn't wipe it */
  var catBadge = document.createElement('span');
  catBadge.className = 'prod-cat-badge';
  catBadge.textContent = catLbl;
  imgArea.appendChild(catBadge);

  /* Quality badge (NEW, BEST SELLER, FEATURED, SALE, etc.) */
  if (p.badge) {
    var qBadge = document.createElement('span');
    qBadge.className = 'prod-q-badge prod-q-badge--' + p.badge.toLowerCase().replace(/\s+/g, '-');
    qBadge.textContent = p.badge;
    imgArea.appendChild(qBadge);
  }

  /* Quick actions overlay */
  var qa = document.createElement('div');
  qa.className = 'prod-qa';
  qa.innerHTML = [
    '<button class="pqa-btn btn-wishlist' + (inWishlist ? ' wishlisted' : '') + '" data-id="' + p.id + '" aria-label="' + t('Wishlist','المفضلة') + '" title="' + t('Wishlist','المفضلة') + '">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (inWishlist ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
    '</button>',
    '<button class="pqa-btn btn-quickview" data-id="' + p.id + '" aria-label="' + t('Quick View','عرض سريع') + '" title="' + t('Quick View','عرض سريع') + '">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    '</button>',
    '<button class="pqa-btn btn-share" data-id="' + p.id + '" aria-label="' + t('Share','مشاركة') + '" title="' + t('Share','مشاركة') + '">',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    '</button>'
  ].join('');
  imgArea.appendChild(qa);

  /* Card wrapper */
  var div = document.createElement('div');
  div.className   = 'prod-card';
  div.dataset.id  = p.id;
  div.dataset.cat = p.cat;
  div.appendChild(imgArea);

  /* Card body */
  var stockHtml = '';
  if (p.availability) {
    var isStock = p.availability === 'In Stock';
    stockHtml = '<span class="prod-stock ' + (isStock ? 'ps-instock' : 'ps-order') + '">' +
      (isStock
        ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' + t('In Stock','متوفر')
        : t('Made to Order','حسب الطلب')
      ) + '</span>';
  }

  var priceHtml = '<div class="prod-price-row">' +
    '<div class="prod-price">' + fmt(p.price) + '</div>' +
    (p.oldPrice ? '<div class="prod-old-price">' + fmt(p.oldPrice) + '</div>' : '') +
    (warrantyLbl
      ? '<span class="prod-warranty-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' + warrantyLbl + '</span>'
      : '') +
    '</div>';

  var body = document.createElement('div');
  body.className = 'prod-card-body';
  body.innerHTML = [
    '<div class="prod-name-row">',
      '<div class="prod-name">' + name + '</div>',
      stockHtml,
    '</div>',
    starsHtml(p.rating, p.reviewCount),
    '<p class="prod-desc">' + desc + '</p>',
    priceHtml,
    '<div class="prod-actions">',
      '<button class="btn-view-details" data-id="' + p.id + '" aria-label="' + detailsLbl + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        detailsLbl +
      '</button>',
      '<button class="btn-add-cart" data-id="' + p.id + '" aria-label="' + addCartLbl + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/><line x1="17" y1="9" x2="17" y2="15"/><line x1="14" y1="12" x2="20" y2="12"/></svg>' +
        addCartLbl +
      '</button>',
      '<button class="btn-order-now" data-id="' + p.id + '" aria-label="' + orderLbl + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
        orderLbl +
      '</button>',
    '</div>'
  ].join('');
  div.appendChild(body);

  return div;
}

var BATCH_SIZE = 12;       // LCM(4,3,2)=12 — every initial render & Load More ends on a complete row
var renderedCount = 0;

function renderBatch() {
  if (!grid) return;
  var slice = PRODUCTS.slice(renderedCount, renderedCount + BATCH_SIZE);
  var frag = document.createDocumentFragment();   // efficient single reflow
  var newCards = [];
  slice.forEach(function(p) {
    var card = buildCard(p);
    frag.appendChild(card);
    newCards.push(card);
  });
  grid.appendChild(frag);
  newCards.forEach(function(c, i) {
    setTimeout(function() { c.classList.add('visible'); }, 30 + i * 45);
  });
  renderedCount += slice.length;
  var wrap = document.getElementById('prodLoadMoreWrap');
  if (wrap) wrap.style.display = (renderedCount < PRODUCTS.length) ? '' : 'none';
}

/* Shared delegated click handler for any container of .prod-card
   elements — used by both the main grid and the New Arrivals strip. */
function pcCardClickHandler(e) {
  var detBtn   = e.target.closest('.btn-view-details');
  var ord      = e.target.closest('.btn-order-now');
  var addCart  = e.target.closest('.btn-add-cart');
  var wlBtn    = e.target.closest('.btn-wishlist');
  var qvBtn    = e.target.closest('.btn-quickview');
  var shareBtn = e.target.closest('.btn-share');
  var imgArea  = e.target.closest('.prod-card-img');
  var card     = e.target.closest('.prod-card');

  if (wlBtn) {
    e.stopPropagation();
    var id = parseInt(wlBtn.dataset.id, 10);
    var added = wishlist.toggle(id);
    wlBtn.classList.toggle('wishlisted', added);
    var svg = wlBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', added ? 'currentColor' : 'none');
  } else if (qvBtn) {
    e.stopPropagation();
    var qvId = parseInt(qvBtn.dataset.id, 10);
    /* On the standalone detail page #prodModal is rendered inline
       (.pd-inline, no visible close/backdrop) rather than as a real
       overlay — opening it there would just silently swap the page's
       main product and lock body scroll with no way to close it.
       Navigate to that product's own detail page instead. */
    if (window.__isProductDetailPage) location.href = productDetailUrl(qvId);
    else prodModal.open(qvId);
  } else if (shareBtn) {
    e.stopPropagation();
    var sp = getProduct(parseInt(shareBtn.dataset.id, 10));
    if (sp) shareProduct(sp);
  } else if (detBtn) {
    e.stopPropagation();
    location.href = productDetailUrl(parseInt(detBtn.dataset.id, 10));
  } else if (ord) {
    e.stopPropagation();
    orderModal.open(parseInt(ord.dataset.id, 10), 1);
  } else if (addCart) {
    e.stopPropagation();
    var p = getProduct(parseInt(addCart.dataset.id, 10));
    if (p) { cart.add(p.id, 1); showCartToast(IS_AR ? p.nameAr : p.name); }
  } else if (imgArea) {
    var imgCard = imgArea.closest('.prod-card');
    if (imgCard) imgGallery.open(parseInt(imgCard.dataset.id, 10), 0);
  } else if (card) {
    location.href = productDetailUrl(parseInt(card.dataset.id, 10));
  }
}

function renderProducts() {
  if (!grid) return;
  grid.innerHTML = '';
  renderedCount = 0;
  renderBatch();
  // Load More button
  var lm = document.getElementById('prodLoadMore');
  if (lm) {
    lm.textContent = t('Load More Products', 'عرض المزيد من المنتجات');
    lm.addEventListener('click', renderBatch);
  }
  // Delegate card click events (attached once)
  grid.addEventListener('click', pcCardClickHandler);
}

/* ── New Arrivals strip — newest/"New"-badged products from the
   live catalog, reusing the same card builder + click handling. ── */
function renderNewArrival() {
  var wrap  = document.getElementById('newArrival');
  var track = document.getElementById('newArrivalTrack');
  if (!wrap || !track || !PRODUCTS.length) return;

  var items = PRODUCTS.filter(function(p) {
    return p.badge && p.badge.toLowerCase() === 'new';
  });
  if (items.length < 3) items = PRODUCTS.slice(0, 6);
  items = items.slice(0, 8);
  if (!items.length) return;

  track.innerHTML = '';
  items.forEach(function(p) {
    var card = buildCard(p);
    card.classList.add('visible');
    track.appendChild(card);
  });
  track.addEventListener('click', pcCardClickHandler);
  wrap.style.display = '';
}

/* ── Newsletter — front-end only for now. No backend endpoint exists
   for storing subscriber emails, so this just confirms the intent to
   the visitor via the existing cart toast; wire to a real endpoint
   (e.g. a Supabase table + API route) before relying on it to grow a
   list. ── */
function initNewsletterForm() {
  var form = document.getElementById('newsletterForm');
  if (!form) return;
  var btn = form.querySelector('.newsletter-submit');
  var defaultLabel = btn ? btn.textContent : '';
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var input = document.getElementById('newsletterEmail');
    var email = input ? input.value.trim() : '';
    if (!email || !btn) return;
    btn.textContent = t('Subscribed ✓', 'تم الاشتراك ✓');
    btn.disabled = true;
    setTimeout(function() {
      btn.textContent = defaultLabel;
      btn.disabled = false;
      form.reset();
    }, 2600);
  });
}


/* ════════════════════════════════════════════
   PRODUCT MODAL
   ════════════════════════════════════════════ */
var prodModal = {
  el: null,
  modalQty: 1,
  currentImgIdx: 0,
  currentProduct: null,

  init: function() {
    this.el = document.getElementById('prodModal');
    if (!this.el) return;
    var self = this;
    document.getElementById('pmClose').addEventListener('click', function() { self.close(); });
    document.getElementById('prodModalBd').addEventListener('click', function() { self.close(); });
    document.getElementById('pmQtyMinus').addEventListener('click', function() {
      if (self.modalQty > 1) { self.modalQty--; self.updateQty(); }
    });
    document.getElementById('pmQtyPlus').addEventListener('click', function() {
      self.modalQty++;
      self.updateQty();
    });
    document.getElementById('pmAddCart').addEventListener('click', function() {
      if (!self.currentProduct) return;
      cart.add(self.currentProduct.id, self.modalQty);
      self.close();
    });
    document.getElementById('pmOrderNow').addEventListener('click', function() {
      if (!self.currentProduct) return;
      self.close();
      orderModal.open(self.currentProduct.id, self.modalQty);
    });
    var quoteBtn = document.getElementById('pmQuoteBtn');
    if (quoteBtn) {
      quoteBtn.addEventListener('click', function() {
        if (!self.currentProduct) return;
        self.close();
        orderModal.open(self.currentProduct.id, self.modalQty);
      });
    }
    document.addEventListener('keydown', function(e) {
      if (!self.el || !self.el.classList.contains('open')) return;
      if (e.key === 'Escape') { self.close(); }
      else if (e.key === 'ArrowLeft')  { self.goImg(self.currentImgIdx - 1); }
      else if (e.key === 'ArrowRight') { self.goImg(self.currentImgIdx + 1); }
    });

    // Inject gallery prev/next nav buttons + touch swipe
    var gallerySide = this.el.querySelector('.pm-gallery-side');
    if (gallerySide) {
      var prevBtn = document.createElement('button');
      prevBtn.className = 'pm-img-prev';
      prevBtn.setAttribute('aria-label', t('Previous image','الصورة السابقة'));
      prevBtn.innerHTML = '&#8592;';
      prevBtn.addEventListener('click', function(e) { e.stopPropagation(); self.goImg(self.currentImgIdx - 1); });

      var nextBtn = document.createElement('button');
      nextBtn.className = 'pm-img-next';
      nextBtn.setAttribute('aria-label', t('Next image','الصورة التالية'));
      nextBtn.innerHTML = '&#8594;';
      nextBtn.addEventListener('click', function(e) { e.stopPropagation(); self.goImg(self.currentImgIdx + 1); });

      gallerySide.appendChild(prevBtn);
      gallerySide.appendChild(nextBtn);

      var pmTouchX = 0;
      var mainImgWrap = this.el.querySelector('.pm-main-img');
      if (mainImgWrap) {
        mainImgWrap.addEventListener('touchstart', function(e) { pmTouchX = e.touches[0].clientX; }, {passive:true});
        mainImgWrap.addEventListener('touchend', function(e) {
          var dx = e.changedTouches[0].clientX - pmTouchX;
          if (Math.abs(dx) > 40) self.goImg(dx < 0 ? self.currentImgIdx + 1 : self.currentImgIdx - 1);
        }, {passive:true});
      }
    }
  },

  goImg: function(idx) {
    if (!this.currentProduct) return;
    var p    = this.currentProduct;
    var imgs = p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);
    var len  = imgs.length;
    if (!len) return;
    var n = ((idx % len) + len) % len;

    /* Same image — nothing to do */
    if (n === this.currentImgIdx) return;

    var prev = this.currentImgIdx;
    this.currentImgIdx = n;

    /* Update active thumbnail using cached refs — no querySelectorAll per click */
    if (this._thumbEls) {
      if (this._thumbEls[prev]) this._thumbEls[prev].classList.remove('active');
      if (this._thumbEls[n])    this._thumbEls[n].classList.add('active');
    }

    /* Swap main image via decode() so the browser can decode off the main thread.
       The Promise resolves in a microtask if already decoded (cached), or async if not.
       Either way the click handler returns immediately, keeping INP low. */
    var mainImg = document.getElementById('pmMainImg');
    if (!mainImg || !imgs[n]) return;
    var src    = imgs[n];
    var altTxt = (IS_AR ? p.nameAr : p.name) + ' ' + (n + 1);
    var tmpImg = new Image();
    tmpImg.src = src;
    var doSwap = function() { mainImg.src = src; mainImg.alt = altTxt; };
    (tmpImg.decode ? tmpImg.decode().then(doSwap).catch(doSwap) : (doSwap(), Promise.resolve()));

    /* Preload the adjacent images so the next click is instant */
    var self = this;
    _ric(function() {
      [-1, 1].forEach(function(d) {
        var adj = ((n + d + len) % len);
        if (adj !== prev && imgs[adj]) {
          var pre = new Image();
          pre.src = imgs[adj];
          pre.decode && pre.decode().catch(function(){});
        }
      });
    }, { timeout: 1000 });
  },

  open: function(id) {
    var p = getProduct(id);
    if (!p || !this.el) return;
    this.currentProduct = p;
    this.modalQty = 1;
    this._thumbEls = null; /* clear stale refs from previous product */

    /* Phase 1 — paint the modal shell immediately so the frame commits fast (good INP). */
    this.populateFast(p);
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';

    /* Phase 2 — fill the heavy sections (specs table, tags, thumbnails) after the first
       painted frame so they never block the interaction response. */
    var self = this;
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        self.populateSlow(p);
      });
    });
  },

  close: function() {
    if (!this.el) return;
    this.el.classList.remove('open');
    document.body.style.overflow = '';
  },

  /* Phase 1: above-the-fold content — name, price, image. Runs before first paint. */
  populateFast: function(p) {
    var name        = IS_AR ? p.nameAr : p.name;
    var desc        = IS_AR ? p.descAr : p.desc;
    var warrantyLbl = IS_AR ? p.warrantyLabelAr : p.warrantyLabel;

    document.getElementById('pmCat').textContent   = catLabel(p.cat);
    document.getElementById('pmTitle').textContent  = name;
    document.getElementById('pmPrice').innerHTML    = fmt(p.price);
    document.getElementById('pmDesc').textContent   = desc;

    var wBadge = document.getElementById('pmWarrantyBadge');
    if (wBadge) {
      wBadge.textContent = warrantyLbl || '';
      wBadge.style.display = warrantyLbl ? '' : 'none';
    }

    /* Main image — needed above the fold */
    var mainImg = document.getElementById('pmMainImg');
    var imgs = p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);
    this.currentImgIdx = 0;
    if (imgs.length) {
      mainImg.src = imgs[0];
      mainImg.alt = name;
      mainImg.style.display = '';
    } else {
      mainImg.src = '';
      mainImg.style.display = 'none';
    }

    this.updateQty();
  },

  /* Phase 2: below-the-fold content — deferred to after the first frame. */
  populateSlow: function(p) {
    var name         = IS_AR ? p.nameAr : p.name;
    var specs        = IS_AR ? p.specsAr : p.specs;
    var features     = IS_AR ? (p.featuresAr || []) : (p.features || []);
    var applications = IS_AR ? (p.applicationsAr || []) : (p.applications || []);
    var finishes     = IS_AR ? (p.finishesAr || []) : (p.finishes || []);
    var sizes        = p.sizes || ['2100 × 900 mm', '2100 × 1000 mm'];
    var imgs         = p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);

    /* Features list */
    var featEl = document.getElementById('pmFeatures');
    if (featEl) {
      featEl.innerHTML = features.map(function(f) {
        return '<li><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' + f + '</li>';
      }).join('');
    }

    /* Specs table — build with fragment to minimise reflow */
    var specsEl = document.getElementById('pmSpecs');
    if (specsEl) {
      var frag = document.createDocumentFragment();
      Object.keys(specs).forEach(function(k) {
        var row = document.createElement('div');
        row.className = 'pm-spec-row';
        row.innerHTML = '<div class="pm-spec-key">' + k + '</div><div class="pm-spec-val">' + specs[k] + '</div>';
        frag.appendChild(row);
      });
      specsEl.innerHTML = '';
      specsEl.appendChild(frag);
    }

    /* Tag groups */
    var appsEl = document.getElementById('pmApplications');
    if (appsEl) appsEl.innerHTML = applications.map(function(a) { return '<span class="pm-tag">' + a + '</span>'; }).join('');

    var finEl = document.getElementById('pmFinishes');
    if (finEl) finEl.innerHTML = finishes.map(function(f) { return '<span class="pm-tag">' + f + '</span>'; }).join('');

    var sizeEl = document.getElementById('pmSizes');
    if (sizeEl) sizeEl.innerHTML = sizes.map(function(s) { return '<span class="pm-tag pm-tag-size">' + s + '</span>'; }).join('');

    /* WhatsApp link */
    var waEl = document.getElementById('pmWhatsapp');
    if (waEl) {
      waEl.href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(t(
        'Hello Al Farooque Manufacturing, I am interested in: ' + name + '. Please send me a quotation.',
        'مرحباً شركة الفاروق للتصنيع، أنا مهتم بـ: ' + name + '. أرجو إرسال عرض سعر.'
      ));
    }

    /* Quote button */
    var quoteEl = document.getElementById('pmQuoteBtn');
    if (quoteEl) quoteEl.dataset.id = p.id;

    /* Thumbnails — build with fragment, cache element refs for fast goImg() */
    var thumbsEl = document.getElementById('pmThumbs');
    if (thumbsEl) {
      var self = this;
      var thumbFrag = document.createDocumentFragment();
      var thumbEls  = [];
      imgs.forEach(function(src, i) {
        var div = document.createElement('div');
        div.className = 'pm-thumb' + (i === 0 ? ' active' : '');
        var img = document.createElement('img');
        img.src      = src;
        img.alt      = name + ' ' + (i + 1);
        img.loading  = 'lazy';
        img.decoding = 'async';
        div.appendChild(img);
        div.addEventListener('click', function() { self.goImg(i); });
        thumbFrag.appendChild(div);
        thumbEls.push(div);
      });
      thumbsEl.innerHTML = '';
      thumbsEl.appendChild(thumbFrag);
      this._thumbEls = thumbEls; /* store for O(1) active-state swaps in goImg() */
    }

    /* Pre-decode all product images on idle so subsequent goImg() calls resolve instantly */
    if (imgs.length > 1) {
      _ric(function() {
        imgs.forEach(function(src, i) {
          if (i === 0) return; /* first image already decoded by populateFast */
          var pre = new Image();
          pre.src = src;
          pre.decode && pre.decode().catch(function(){});
        });
      }, { timeout: 2000 });
    }
  },

  /* Legacy alias — kept so any external callers still work. */
  populate: function(p) {
    this.populateFast(p);
    this.populateSlow(p);
  },

  updateQty: function() {
    var el = document.getElementById('pmQtyNum');
    if (el) el.textContent = this.modalQty;
    var totalEl = document.getElementById('pmTotal');
    if (totalEl && this.currentProduct) {
      totalEl.textContent = t('Total: ','الإجمالي: ');
      var strong = document.createElement('strong');
      strong.textContent = fmt(this.currentProduct.price * this.modalQty);
      totalEl.appendChild(strong);
    }
  }
};

/* ════════════════════════════════════════════
   CART SYSTEM
   ════════════════════════════════════════════ */

/* Debounced cart → Supabase sync (fires 1.5 s after last cart change) */
var _cartSyncTimer = null;
function _debouncedSyncCart() {
  clearTimeout(_cartSyncTimer);
  _cartSyncTimer = setTimeout(function() {
    if (window.AFAuth && typeof window.AFAuth.currentUser === 'function'
        && window.AFAuth.currentUser()
        && typeof window.AFAuth.saveCartToServer === 'function') {
      window.AFAuth.saveCartToServer(cart.items).catch(function(){});
    }
  }, 1500);
}

var cart = {
  items: [],
  drawerEl: null,
  backdropEl: null,
  fabBadge: null,

  init: function() {
    this.load();
    this.drawerEl  = document.getElementById('cartDrawer');
    this.backdropEl= document.getElementById('cartBackdrop');
    this.fabBadge  = document.getElementById('cartFabBadge');
    var self = this;

    var fab = document.getElementById('cartFab');
    if (fab) fab.addEventListener('click', function() { self.openDrawer(); });

    var closeBtn = document.getElementById('cartClose');
    if (closeBtn) closeBtn.addEventListener('click', function() { self.closeDrawer(); });

    if (this.backdropEl) this.backdropEl.addEventListener('click', function() { self.closeDrawer(); });

    var proceedBtn = document.getElementById('cartProceed');
    if (proceedBtn) proceedBtn.addEventListener('click', function() {
      if (!self.items.length) return;
      self.closeDrawer();
      orderModal.openCart();
    });

    /* Single delegated listener on list — handles all qty/remove clicks */
    var list = document.getElementById('cartItemsList');
    if (list) {
      list.addEventListener('click', function(e) {
        var minus  = e.target.closest('.ci-minus');
        var plus   = e.target.closest('.ci-plus');
        var remove = e.target.closest('.cart-item-remove');
        if (minus)  self.updateQty(parseInt(minus.dataset.id, 10), -1);
        else if (plus)   self.updateQty(parseInt(plus.dataset.id, 10), 1);
        else if (remove) self.remove(parseInt(remove.dataset.id, 10));
      });
    }

    this.renderDrawer();
    this.updateBadge();
  },

  load: function() {
    try { this.items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { this.items = []; }
  },

  save: function() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(this.items)); } catch(e) {}
    /* Save extended metadata (count + product details) for account dashboard */
    try {
      var meta = {
        count:    this.count(),
        subtotal: this.total(),
        vat:      this.vat(),
        grand:    this.grand(),
        items: this.items.map(function(ci) {
          var p = getProduct(ci.id);
          return {
            id:       ci.id,
            nameEn:   p ? p.name   : ('Product #' + ci.id),
            nameAr:   p ? p.nameAr : ('منتج #' + ci.id),
            price:    p ? p.price  : 0,
            qty:      ci.qty,
            lineTotal: p ? p.price * ci.qty : 0,
            img:      p ? p.img    : '',
          };
        }),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('afq-cart-meta', JSON.stringify(meta));
    } catch(e) {}
    /* Sync to server (debounced — avoids spamming Supabase on rapid changes) */
    _debouncedSyncCart();
  },

  add: function(id, qty) {
    var existing = this.items.filter(function(i){return i.id===id;})[0];
    if (existing) {
      existing.qty += qty;
    } else {
      this.items.push({id: id, qty: qty});
    }
    this.save();
    this.renderDrawer();
    this.updateBadge(true);
  },

  remove: function(id) {
    this.items = this.items.filter(function(i){return i.id!==id;});
    this.save();
    this.renderDrawer();
    this.updateBadge(false);
  },

  updateQty: function(id, delta) {
    var item = this.items.filter(function(i){return i.id===id;})[0];
    if (!item) return;
    item.qty = item.qty + delta;
    if (item.qty <= 0) { return this.remove(id); }
    this.save();
    this.renderDrawer();
    this.updateBadge(false);
  },

  total: function() {
    return this.items.reduce(function(sum, i) {
      var p = getProduct(i.id);
      return sum + (p ? p.price * i.qty : 0);
    }, 0);
  },

  vat: function() {
    return Math.round(this.total() * 0.15);
  },

  grand: function() {
    return this.total() + this.vat();
  },

  count: function() {
    return this.items.reduce(function(s,i){return s+i.qty;}, 0);
  },

  openDrawer: function() {
    if (this.drawerEl)   this.drawerEl.classList.add('open');
    if (this.backdropEl) this.backdropEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeDrawer: function() {
    if (this.drawerEl)   this.drawerEl.classList.remove('open');
    if (this.backdropEl) this.backdropEl.classList.remove('open');
    document.body.style.overflow = '';
  },

  updateBadge: function(bump) {
    var c = this.count();
    var badge = this.fabBadge;
    if (!badge) return;
    badge.textContent = c;
    badge.classList.toggle('show', c > 0);
    if (bump && c > 0) {
      /* Use rAF double-frame to restart animation without forced layout */
      badge.classList.remove('bump');
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { badge.classList.add('bump'); });
      });
    }
    var dc = document.getElementById('cartDrCount');
    if (dc) dc.textContent = t(c + ' item' + (c!==1?'s':''), c + ' منتج');
  },

  renderDrawer: function() {
    var list = document.getElementById('cartItemsList');
    if (!list) return;
    var frag = document.createDocumentFragment();
    if (!this.items.length) {
      var empty = document.createElement('div');
      empty.className = 'cart-empty-msg';
      empty.innerHTML = '<span class="cart-empty-ico">🛒</span><div class="cart-empty-txt">' + t('Your cart is empty','سلة التسوق فارغة') + '</div>';
      frag.appendChild(empty);
    } else {
      this.items.forEach(function(ci) {
        var p = getProduct(ci.id);
        if (!p) return;
        var name = IS_AR ? p.nameAr : p.name;
        var el = document.createElement('div');
        el.className = 'cart-item';
        el.dataset.id = p.id;
        el.innerHTML = [
          '<div class="cart-item-img"><img src="' + p.img + '" alt="' + name + '" loading="lazy" decoding="async"></div>',
          '<div class="cart-item-info">',
            '<div class="cart-item-name">' + name + '</div>',
            '<div class="cart-item-unit-price">' + fmt(p.price * ci.qty) + '</div>',
            '<div class="ci-qty-ctrl">',
              '<button class="ci-qty-btn ci-minus" data-id="' + p.id + '">−</button>',
              '<span class="ci-qty-val">' + ci.qty + '</span>',
              '<button class="ci-qty-btn ci-plus" data-id="' + p.id + '">+</button>',
            '</div>',
          '</div>',
          '<button class="cart-item-remove" data-id="' + p.id + '" aria-label="' + t('Remove','حذف') + '">×</button>'
        ].join('');
        frag.appendChild(el);
      });
    }
    list.textContent = ''; /* clear without innerHTML assignment */
    list.appendChild(frag);

    /* Single delegated listener — set once in init(), not recreated here */
    var total = this.total();
    var vat   = this.vat();
    var grand = this.grand();
    var subEl = document.getElementById('cartSubtotal');
    var vatEl = document.getElementById('cartVat');
    var totEl = document.getElementById('cartGrandTotal');
    if (subEl) subEl.textContent = fmt(total);
    if (vatEl) vatEl.textContent = fmt(vat);
    if (totEl) totEl.textContent = fmt(grand);
    var proceedBtn = document.getElementById('cartProceed');
    if (proceedBtn) proceedBtn.disabled = !this.items.length;
    this.updateBadge(false);
  }
};

/* One id per checkout attempt, sent to /api/quote as an idempotency key
   so a retried/duplicated request (double click, refresh mid-request)
   upserts the same order row instead of inserting a second one. */
function genOrderId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* ════════════════════════════════════════════
   ORDER MODAL
   ════════════════════════════════════════════ */
var orderModal = {
  el: null,
  productId: null,
  qty: 1,
  isCartOrder: false,
  submitting: false,       // re-entry guard — blocks a second submit() while one is in flight
  orderIdempotencyKey: null, // one stable id per checkout attempt (see open()/openCart())

  init: function() {
    this.el = document.getElementById('orderModal');
    if (!this.el) return;
    var self = this;
    document.getElementById('omClose').addEventListener('click', function() { self.close(); });
    document.getElementById('orderModalBd').addEventListener('click', function() { self.close(); });
    document.getElementById('omQtyMinus').addEventListener('click', function() {
      if (self.qty > 1) { self.qty--; self.updateTotal(); }
    });
    document.getElementById('omQtyPlus').addEventListener('click', function() {
      self.qty++;
      self.updateTotal();
    });
    var submitBtn = document.getElementById('omSubmit');
    if (submitBtn) submitBtn.addEventListener('click', function() { self.submit(); });
    var omForm = document.getElementById('omForm');
    if (omForm) omForm.addEventListener('submit', function(e) { e.preventDefault(); self.submit(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && self.el.classList.contains('open')) self.close();
    });
  },

  open: function(id, qty) {
    this.productId  = id;
    this.qty        = qty || 1;
    this.isCartOrder= false;
    this.orderIdempotencyKey = genOrderId();
    var p = getProduct(id);
    if (!p) return;
    var name = IS_AR ? p.nameAr : p.name;
    document.getElementById('omProdImg').src = p.img;
    document.getElementById('omProdImg').alt = name;
    document.getElementById('omProdName').textContent = name;
    document.getElementById('omProdPrice').textContent = fmt(p.price);
    document.getElementById('omProdNote').textContent = t('Unit price','سعر الوحدة');
    document.getElementById('omQtyVal').textContent = this.qty;
    // Show qty section for single product
    var qtySection = document.getElementById('omQtySection');
    if (qtySection) qtySection.style.display = '';
    this.updateTotal();
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  openCart: function() {
    this.isCartOrder = true;
    this.orderIdempotencyKey = genOrderId();
    this.qty = cart.count();
    // Show cart summary
    var p = {img: 'assets/images/logo/IAA_LOGO.png', nameAr: 'سلة التسوق', name: 'Cart Order (' + this.qty + ' items)'};
    document.getElementById('omProdImg').src = p.img;
    document.getElementById('omProdImg').alt = IS_AR ? p.nameAr : p.name;
    document.getElementById('omProdName').textContent = IS_AR ? p.nameAr : p.name;
    document.getElementById('omProdPrice').textContent = fmt(cart.grand());
    document.getElementById('omProdNote').textContent = t('Grand Total (incl. 15% VAT)','الإجمالي الكلي (شامل ضريبة 15%)');
    var qtySection = document.getElementById('omQtySection');
    if (qtySection) qtySection.style.display = 'none';
    this.updateTotal();
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close: function() {
    if (!this.el) return;
    this.el.classList.remove('open');
    document.body.style.overflow = '';
  },

  updateTotal: function() {
    var subEl   = document.getElementById('omSubtotalVal');
    var vatEl   = document.getElementById('omVatVal');
    var grandEl = document.getElementById('omGrandVal');
    if (!subEl) return;
    var subtotal, vat, grand;
    if (this.isCartOrder) {
      subtotal = cart.total();
      vat      = cart.vat();
      grand    = cart.grand();
    } else {
      var p = getProduct(orderModal.productId);
      subtotal = p ? p.price * this.qty : 0;
      vat      = Math.round(subtotal * 0.15);
      grand    = subtotal + vat;
    }
    subEl.textContent   = fmt(subtotal);
    vatEl.textContent   = fmt(vat);
    grandEl.textContent = fmt(grand);
    var qtyEl = document.getElementById('omQtyVal');
    if (qtyEl && !this.isCartOrder) qtyEl.textContent = this.qty;
  },

  /* Build the structured payload sent to the backend (/api/quote) */
  buildPayload: function() {
    var name  = document.getElementById('omName').value.trim();
    var phone = document.getElementById('omPhone').value.trim();
    var email = document.getElementById('omEmail').value.trim();
    var msg   = document.getElementById('omMsg').value.trim();

    var payload = {
      language:      IS_AR ? 'ar' : 'en',
      name:          name,
      phone:         phone,
      email:         email,
      message:       msg,
      clientOrderId: this.orderIdempotencyKey || genOrderId(),
    };

    if (this.isCartOrder) {
      payload.type  = 'cart';
      payload.items = cart.items.map(function(ci) {
        var p = getProduct(ci.id);
        return {
          name:      p ? (IS_AR ? p.nameAr : p.name) : ('#' + ci.id),
          qty:       ci.qty,
          price:     p ? p.price : 0,
          lineTotal: p ? p.price * ci.qty : 0,
        };
      });
      payload.subtotal   = cart.total();
      payload.vat        = cart.vat();
      payload.grandTotal = cart.grand();
    } else {
      var p = getProduct(this.productId);
      var sub = p ? p.price * this.qty : 0;
      var vat = Math.round(sub * 0.15);
      payload.type       = 'order';
      payload.product    = p ? (IS_AR ? p.nameAr : p.name) : ('#' + this.productId);
      payload.quantity   = this.qty;
      payload.subtotal   = sub;
      payload.vat        = vat;
      payload.grandTotal = sub + vat;
    }
    return payload;
  },

  /* Render a status message inside the modal (info | success | error) */
  setStatus: function(text, kind) {
    var el = document.getElementById('omStatus');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'om-status' + (kind ? ' om-status-' + kind : '');
    el.style.display = text ? 'block' : 'none';
  },

  /* Submit the order to the backend — no WhatsApp / mailto.

     Order persistence now happens ENTIRELY server-side, in a single
     upsert (api/quote.js → persistSubmission), for both Direct Order and
     Cart Checkout, guest and signed-in alike. There used to also be a
     separate client-side Supabase insert here for signed-in users — that
     created a second row per checkout (and, for cart orders, one built
     from an already-cleared cart, saving 0 items / SAR 0). Removed
     entirely; the access token below just lets the server attribute the
     one order it creates to the real account instead of treating it as
     a guest order. */
  submit: function() {
    var self = this;
    if (this.submitting) return; // re-entry guard — blocks a second concurrent submit

    var name  = document.getElementById('omName').value.trim();
    var phone = document.getElementById('omPhone').value.trim();
    var email = document.getElementById('omEmail').value.trim();
    var btn   = document.getElementById('omSubmit');

    /* Client-side validation */
    if (!name || !phone) {
      this.setStatus(t('Please enter your name and phone number.',
                       'يرجى إدخال الاسم ورقم الهاتف.'), 'error');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.setStatus(t('Please enter a valid email address.',
                       'يرجى إدخال بريد إلكتروني صحيح.'), 'error');
      return;
    }

    this.submitting = true;
    var origLabel = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
    this.setStatus(t('Sending your order…', 'جارٍ إرسال طلبك…'), 'info');
    if (btn) btn.textContent = t('Sending…', 'جارٍ الإرسال…');

    /* Read the cart/product data into a fixed payload up front, once —
       nothing after this point re-reads cart.items, so clearing the cart
       on success can never race with what gets sent to the server. */
    var payload = this.buildPayload();

    var tokenPromise = (window.AFAuth && typeof window.AFAuth.getAccessToken === 'function')
      ? window.AFAuth.getAccessToken().catch(function() { return null; })
      : Promise.resolve(null);

    function endSubmitting() {
      self.submitting = false;
      if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); btn.innerHTML = origLabel; }
    }

    tokenPromise.then(function(token) {
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      return fetch('/api/quote', { method: 'POST', headers: headers, body: JSON.stringify(payload) });
    })
    .then(function(res) {
      return res.json().catch(function() { return {}; }).then(function(json) {
        return { ok: res.ok, status: res.status, json: json };
      });
    })
    .then(function(r) {
      if (r.ok && r.json.success) {
        console.log('[Order] SUCCESS — email sent to arshad@alfarooque.com, id:', r.json.id);
        self.setStatus(t('Thank you. Your request has been submitted successfully.',
                         'شكراً لك. تم إرسال طلبك بنجاح.'), 'success');
        if (btn) { btn.classList.remove('is-loading'); btn.textContent = t('✓ Submitted', '✓ تم الإرسال'); }

        /* Clear the cart (local + server-persisted) on a successful cart order */
        if (self.isCartOrder) {
          cart.items = [];
          cart.save();
          cart.renderDrawer();
          cart.updateBadge(false);
          if (window.AFAuth && typeof window.AFAuth.saveCartToServer === 'function') {
            window.AFAuth.saveCartToServer([]).catch(function(){});
          }
        }
        /* Reset & close after the user has read the confirmation */
        setTimeout(function() {
          var form = document.getElementById('omForm');
          if (form) form.reset();
          self.close();
          self.setStatus('', '');
          endSubmitting();
        }, 3200);
      } else {
        var detail = (r.json && (r.json.error || r.json.message)) ||
                     ('Request failed (HTTP ' + r.status + ')');
        console.error('[Order] FAILED — HTTP', r.status, r.json);
        self.setStatus(t('Could not send your order: ', 'تعذّر إرسال طلبك: ') + detail, 'error');
        endSubmitting();
      }
    })
    .catch(function(err) {
      console.error('[Order] Network error:', err);
      self.setStatus(t('Network error — please check your connection and try again.',
                       'خطأ في الشبكة — يرجى التحقق من الاتصال والمحاولة مرة أخرى.'), 'error');
      endSubmitting();
    });
  }
};

/* ════════════════════════════════════════════
   YEAR
   ════════════════════════════════════════════ */
function updateYear() {
  var el = document.getElementById('current-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ════════════════════════════════════════════
   LANGUAGE SWITCHER PATCH (products pages)
   Ensures EN↔AR redirect works for products pages
   ════════════════════════════════════════════ */
function patchLangSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    var target = btn.dataset.lang;
    var current = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    if (target === current) return;
    btn.addEventListener('click', function(e) {
      e.stopImmediatePropagation();
      localStorage.setItem('language', target);
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.2s ease';
      var dest = target === 'ar' ? 'products-ar.html' : 'products.html';
      setTimeout(function() { window.location.href = dest; }, 200);
    }, true);
  });
}

/* ════════════════════════════════════════════
   IMAGE GALLERY
   ════════════════════════════════════════════ */
var imgGallery = {
  el: null,
  currentIdx: 0,
  currentImgs: [],

  init: function() {
    var self = this;
    var modal = document.createElement('div');
    modal.className = 'img-gallery-modal';
    modal.id = 'imgGalleryModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', t('Image Gallery', 'معرض الصور'));
    modal.innerHTML = [
      '<div class="ig-backdrop" id="igBackdrop"></div>',
      '<button class="ig-close" id="igClose" aria-label="' + t('Close','إغلاق') + '">&#215;</button>',
      '<button class="ig-arrow ig-prev" id="igPrev" aria-label="' + t('Previous','السابق') + '">&#8592;</button>',
      '<button class="ig-arrow ig-next" id="igNext" aria-label="' + t('Next','التالي') + '">&#8594;</button>',
      '<div class="ig-inner">',
        '<div class="ig-main">',
          '<div class="ig-main-img-wrap" id="igMainImgWrap">',
            '<img id="igMainImg" src="" alt="" loading="eager">',
          '</div>',
        '</div>',
        '<div class="ig-counter" id="igCounter" aria-live="polite"></div>',
      '<div class="ig-thumbs" id="igThumbs"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);
    this.el = modal;

    document.getElementById('igClose').addEventListener('click', function() { self.close(); });
    document.getElementById('igBackdrop').addEventListener('click', function() { self.close(); });
    document.getElementById('igPrev').addEventListener('click', function() { self.go(self.currentIdx - 1); });
    document.getElementById('igNext').addEventListener('click', function() { self.go(self.currentIdx + 1); });

    document.addEventListener('keydown', function(e) {
      if (!self.el || !self.el.classList.contains('open')) return;
      if (e.key === 'Escape')      { self.close(); }
      else if (e.key === 'ArrowLeft')  { self.go(self.currentIdx - 1); }
      else if (e.key === 'ArrowRight') { self.go(self.currentIdx + 1); }
    });

    var touchStartX = 0;
    var wrap = document.getElementById('igMainImgWrap');
    if (wrap) {
      wrap.addEventListener('touchstart', function(e) {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      wrap.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) self.go(dx < 0 ? self.currentIdx + 1 : self.currentIdx - 1);
      }, { passive: true });
    }
  },

  open: function(id, startIdx) {
    var p = getProduct(id);
    if (!p || !this.el) return;
    var name = IS_AR ? p.nameAr : p.name;
    this.currentImgs = p.imgs && p.imgs.length ? p.imgs : (p.img ? [p.img] : []);
    if (!this.currentImgs.length) return;
    this._savedScrollY = window.pageYOffset;
    this.buildThumbs(name);
    this.go(startIdx !== undefined ? startIdx : 0);
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close: function() {
    if (!this.el) return;
    this.el.classList.remove('open');
    document.body.style.overflow = '';
    if (this._savedScrollY !== undefined) {
      window.scrollTo(0, this._savedScrollY);
      this._savedScrollY = undefined;
    }
  },

  go: function(idx) {
    var len = this.currentImgs.length;
    var n = ((idx % len) + len) % len;
    this.currentIdx = n;
    var mainImg = document.getElementById('igMainImg');
    if (mainImg) mainImg.src = this.currentImgs[n];
    document.querySelectorAll('#igThumbs .ig-thumb').forEach(function(th, i) {
      th.classList.toggle('active', i === n);
    });
    var prevBtn  = document.getElementById('igPrev');
    var nextBtn  = document.getElementById('igNext');
    var counter  = document.getElementById('igCounter');
    var show = len > 1;
    if (prevBtn) prevBtn.style.display = show ? '' : 'none';
    if (nextBtn) nextBtn.style.display = show ? '' : 'none';
    if (counter) counter.textContent = show ? (n + 1) + ' / ' + len : '';
  },

  buildThumbs: function(name) {
    var self = this;
    var thumbsEl = document.getElementById('igThumbs');
    if (!thumbsEl) return;
    thumbsEl.innerHTML = '';
    this.currentImgs.forEach(function(src, i) {
      var btn = document.createElement('button');
      btn.className = 'ig-thumb';
      btn.setAttribute('aria-label', name + ' ' + (i + 1));
      var img = document.createElement('img');
      img.src = src;
      img.alt = name + ' ' + (i + 1);
      img.loading = 'lazy';
      btn.appendChild(img);
      btn.addEventListener('click', function() { self.go(i); });
      thumbsEl.appendChild(btn);
    });
  }
};

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async function() {
  /* Wait for the live catalog (see PRODUCT DATA above) before anything
     below reads PRODUCTS/getProduct() — otherwise the very first render
     of the grid/cart would run against an empty array. Resolves quickly
     (same-origin JSON) and only once, on either success or failure. */
  await window.__productsReady;

  slider.init();
  renderProducts();
  renderNewArrival();
  initNewsletterForm();
  cart.init();
  prodModal.init();
  orderModal.init();
  imgGallery.init();
  updateYear();

  /* Nav cart icon (present on every page) links here with ?openCart=1
     when the page itself has no cart drawer of its own. */
  if (new URLSearchParams(location.search).get('openCart') === '1') {
    cart.openDrawer();
  }
  /* Patch language switcher after it initialises */
  setTimeout(patchLangSwitcher, 50);

  /* ── Auth state sync ──
     Restores the user's cart + wishlist from Supabase on login,
     and resets both to empty on logout. */
  if (typeof window.AFAuth !== 'undefined' && typeof window.AFAuth.onChange === 'function') {
    var _prevAuthUser = null;
    window.AFAuth.onChange(function(user) {
      var wasLoggedIn = !!_prevAuthUser;
      var isLoggedIn  = !!user;
      _prevAuthUser   = user;

      if (isLoggedIn && !wasLoggedIn) {
        /* User just logged in — mergeGuestCart() already synced local→server→local.
           Give it a moment then reload the cart + wishlist from localStorage. */
        setTimeout(function() {
          cart.load();
          cart.renderDrawer();
          cart.updateBadge(false);

          /* Sync wishlist from Supabase to localStorage, then refresh UI buttons */
          if (typeof window.AFAuth.syncWishlistToLocal === 'function') {
            window.AFAuth.syncWishlistToLocal().then(function() {
              wishlist._set = null; /* invalidate cache — next .has() re-reads localStorage */
              document.querySelectorAll('.btn-wishlist').forEach(function(btn) {
                var id   = parseInt(btn.dataset.id, 10);
                var inWL = wishlist.has(id);
                btn.classList.toggle('wishlisted', inWL);
                var svg = btn.querySelector('svg');
                if (svg) svg.setAttribute('fill', inWL ? 'currentColor' : 'none');
              });
            }).catch(function(){});
          }
        }, 700);

      } else if (!isLoggedIn && wasLoggedIn) {
        /* User just logged out — localStorage already cleared by signOut().
           Reload cart (will be empty) and reset wishlist button states. */
        cart.load();
        cart.renderDrawer();
        cart.updateBadge(false);
        wishlist._set = null;
        document.querySelectorAll('.btn-wishlist').forEach(function(btn) {
          btn.classList.remove('wishlisted');
          var svg = btn.querySelector('svg');
          if (svg) svg.setAttribute('fill', 'none');
        });
      }
    });
  }

  /* ── Pending checkout resume (after Google OAuth) ──
     If the user was mid-checkout when they were asked to log in via Google,
     callback.html kept the flag and redirected here. Now that auth is
     settled, open the cart drawer and auto-click Checkout. */
  try {
    if (sessionStorage.getItem('af-pending-checkout') === '1') {
      sessionStorage.removeItem('af-pending-checkout');
      if (typeof window.AFAuth !== 'undefined' && typeof window.AFAuth.onChange === 'function') {
        var _pendingCheckoutOff = window.AFAuth.onChange(function(pendingUser) {
          if (pendingUser) {
            setTimeout(function() {
              if (typeof _pendingCheckoutOff === 'function') { _pendingCheckoutOff(); _pendingCheckoutOff = null; }
              if (cart.items && cart.items.length) {
                cart.openDrawer();
                setTimeout(function() {
                  var cartProceedBtn = document.getElementById('cartProceed');
                  if (cartProceedBtn) cartProceedBtn.click();
                }, 600);
              }
            }, 1200);
          }
        });
      }
    }
  } catch(_pce) {}
});
