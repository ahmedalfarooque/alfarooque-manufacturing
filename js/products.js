/* ════════════════════════════════════════════════════════════
   AL FAROOQUE MANUFACTURING — PRODUCTS PAGE v1.0
   Hero Slider · Product Grid · Cart · Modal · Orders
   ════════════════════════════════════════════════════════════ */
'use strict';

/* ════ CONFIG — update before going live ════ */
var WA_NUMBER   = '966563000051';       // WhatsApp number, no leading +
var ORDER_EMAIL = 'sales@alfarooque.com';
var CART_KEY    = 'afq-products-cart';
var SLIDE_MS    = 5000;                 // Hero auto-advance interval (ms)

/* ════ LANGUAGE ════ */
var IS_AR = document.documentElement.lang === 'ar';
var BASE_PATH = IS_AR ? '' : '';        // Both files in root; assets path same

/* ════════════════════════════════════════════
   PRODUCT DATA
   ════════════════════════════════════════════ */
var PRODUCTS = [
  {
    id: 1, cat: 'wood',
    name: 'Premium Wooden Dining Table',
    nameAr: 'طاولة طعام خشبية فاخرة',
    desc: 'Handcrafted solid oak dining table with a premium satin finish. Features mortise-and-tenon joinery, available in custom sizes with a choice of natural to ebony stains.',
    descAr: 'طاولة طعام مصنوعة يدوياً من خشب البلوط الصلب بتشطيب ساتان فاخر. تتميز بوصلات متينة وأحجام مخصصة مع مجموعة من التشطيبات.',
    price: 2500,
    img: 'assets/images/gallery/gallery-01.jpg',
    imgs: ['assets/images/gallery/gallery-01.jpg','assets/images/gallery/gallery-05.jpg','assets/images/gallery/company-03.jpg'],
    specs: {'Material':'Solid Oak','Dimensions':'180 × 90 × 75 cm','Finish':'Satin Lacquer','Capacity':'6 – 8 Persons','Lead Time':'3 – 4 Weeks'},
    specsAr: {'المادة':'خشب البلوط الصلب','الأبعاد':'180 × 90 × 75 سم','التشطيب':'طلاء ساتان','السعة':'6 – 8 أشخاص','مدة التسليم':'3 – 4 أسابيع'}
  },
  {
    id: 2, cat: 'wood',
    name: 'Custom Wood Cabinet',
    nameAr: 'خزانة خشبية مخصصة',
    desc: 'Floor-to-ceiling built-in cabinet with soft-close drawers and adjustable shelving. Available in melamine, veneer, or solid wood facings with concealed LED lighting.',
    descAr: 'خزانة مدمجة من الأرض للسقف مع أدراج إغلاق ناعم وأرفف قابلة للتعديل. متوفرة بوجوه ميلامين أو قشرة أو خشب صلب مع إضاءة LED خفية.',
    price: 3200,
    img: 'assets/images/gallery/gallery-05.jpg',
    imgs: ['assets/images/gallery/gallery-05.jpg','assets/images/gallery/gallery-01.jpg','assets/images/gallery/company-05.jpg'],
    specs: {'Material':'MDF + Veneer Face','Hardware':'Blum Soft-Close','Lighting':'LED Strip (optional)','Finish':'Lacquered Veneer','Lead Time':'4 – 5 Weeks'},
    specsAr: {'المادة':'MDF بوجه قشرة','المعدات':'بلوم إغلاق ناعم','الإضاءة':'شريط LED (اختياري)','التشطيب':'قشرة مطلية','مدة التسليم':'4 – 5 أسابيع'}
  },
  {
    id: 3, cat: 'steel',
    name: 'Steel Stair Railing',
    nameAr: 'درابزين درج فولاذي',
    desc: 'Precision-fabricated steel stair railing with powder-coated finish and tempered glass infill. Designed to BS 6180 standard for commercial and residential projects.',
    descAr: 'درابزين درج فولاذي مصنوع بدقة مع طلاء بودرة ولوحات زجاج مقسى. مصمم وفق معيار BS 6180 للمشاريع التجارية والسكنية.',
    price: 1850,
    img: 'assets/images/gallery/gallery-10.jpg',
    imgs: ['assets/images/gallery/gallery-10.jpg','assets/images/gallery/gallery-15.jpg','assets/images/gallery/company-10.jpg'],
    specs: {'Material':'S235 Structural Steel','Infill':'Tempered Glass / Solid','Finish':'Powder Coat','Standard':'BS 6180:2011','Lead Time':'2 – 3 Weeks'},
    specsAr: {'المادة':'فولاذ هيكلي S235','الحشو':'زجاج مقسى / صلب','التشطيب':'طلاء بودرة','المعيار':'BS 6180:2011','مدة التسليم':'2 – 3 أسابيع'}
  },
  {
    id: 4, cat: 'steel',
    name: 'Structural Steel Frame',
    nameAr: 'إطار فولاذي هيكلي',
    desc: 'Heavy-duty structural steel frame fabricated to engineering drawings. Includes full MIG/MMA welding, zinc primer coating, and SASO-certified quality inspection.',
    descAr: 'إطار فولاذي هيكلي ثقيل مصنوع وفق الرسومات الهندسية. يشمل اللحام الكامل وطلاء زنك أساسي وفحص جودة معتمد SASO.',
    price: 4900,
    img: 'assets/images/gallery/gallery-15.jpg',
    imgs: ['assets/images/gallery/gallery-15.jpg','assets/images/gallery/gallery-10.jpg','assets/images/gallery/company-15.jpg'],
    specs: {'Material':'S355 Structural Steel','Process':'MIG / MMA Welding','Coating':'Zinc Primer','Inspection':'SASO Certified','Lead Time':'3 – 6 Weeks'},
    specsAr: {'المادة':'فولاذ هيكلي S355','العملية':'لحام MIG / MMA','الطلاء':'تزنيك أساسي','الفحص':'معتمد SASO','مدة التسليم':'3 – 6 أسابيع'}
  },
  {
    id: 5, cat: 'aluminium',
    name: 'Aluminium Sliding Window',
    nameAr: 'نافذة ألومنيوم منزلقة',
    desc: 'SASO-certified aluminium sliding window with double-glazed units and thermal break profile. Available in custom sizes, powder-coat or anodised finish.',
    descAr: 'نافذة ألومنيوم منزلقة معتمدة SASO بوحدات زجاجية مزدوجة ومقطع عازل حراري. متوفرة بأحجام مخصصة وطلاء بودرة أو أنودة.',
    price: 1450,
    img: 'assets/images/gallery/company-01.jpg',
    imgs: ['assets/images/gallery/company-01.jpg','assets/images/gallery/company-05.jpg','assets/images/gallery/company-08.jpg'],
    specs: {'Profile':'Thermal Break 6063-T5','Glazing':'Double 6+12+6 mm','Certification':'SASO','Finish':'Powder Coat / Anodised','Lead Time':'2 – 4 Weeks'},
    specsAr: {'الملف':'مقطع عازل حراري 6063-T5','الزجاج':'مزدوج 6+12+6 ملم','الشهادة':'SASO','التشطيب':'طلاء بودرة / أنودة','مدة التسليم':'2 – 4 أسابيع'}
  },
  {
    id: 6, cat: 'aluminium',
    name: 'Aluminium Glass Door',
    nameAr: 'باب ألومنيوم زجاجي',
    desc: 'Full-height aluminium-framed glass door with multi-point locking, hydraulic soft-close, and 10mm tempered safety glass. Ideal for commercial interiors.',
    descAr: 'باب زجاجي بإطار ألومنيوم بارتفاع كامل مع قفل متعدد النقاط وإغلاق هيدروليكي ناعم وزجاج أمان مقسى 10 ملم. مثالي للديكورات التجارية.',
    price: 2100,
    img: 'assets/images/gallery/company-05.jpg',
    imgs: ['assets/images/gallery/company-05.jpg','assets/images/gallery/company-01.jpg','assets/images/gallery/company-08.jpg'],
    specs: {'Frame':'Aluminium 6063-T5','Glass':'Tempered 10mm Safety','Lock':'Multi-Point Secure','Closer':'Hydraulic Soft-Close','Lead Time':'3 – 4 Weeks'},
    specsAr: {'الإطار':'ألومنيوم 6063-T5','الزجاج':'مقسى أمان 10 ملم','القفل':'متعدد النقاط','الإغلاق':'هيدروليكي ناعم','مدة التسليم':'3 – 4 أسابيع'}
  }
];

/* ════ Helper ════ */
function t(en, ar) { return IS_AR ? ar : en; }
function fmt(n) { return 'SAR ' + Number(n).toLocaleString('en-US'); }
function esc(s) { return encodeURIComponent(s); }

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

    // Parallax on scroll
    window.addEventListener('scroll', function() {
      var y = window.scrollY;
      var hero = document.querySelector('.ph-hero');
      if (!hero) return;
      var heroH = hero.offsetHeight;
      if (y > heroH) return;
      var ratio = y / heroH;
      document.querySelectorAll('.ph-slide-bg').forEach(function(bg) {
        bg.style.transform = 'translateY(' + (ratio * 30) + '%)';
      });
    }, {passive: true});
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

function catLabel(cat) {
  var map = {wood: t('Wood Works','أعمال الخشب'), steel: t('Steel Works','أعمال الحديد'), aluminium: t('Aluminium Works','أعمال الألومنيوم')};
  return map[cat] || cat;
}

function buildCard(p) {
  var div = document.createElement('div');
  div.className = 'prod-card';
  div.dataset.id  = p.id;
  div.dataset.cat = p.cat;

  var name  = IS_AR ? p.nameAr  : p.name;
  var desc  = IS_AR ? p.descAr  : p.desc;
  var badge = catLabel(p.cat);
  var addLbl   = t('Add to Cart','أضف إلى السلة');
  var orderLbl = t('Order Now','اطلب الآن');
  var availLbl = t('Available','متاح');

  div.innerHTML = [
    '<div class="prod-card-img">',
      '<img src="' + p.img + '" alt="' + name + '" loading="lazy">',
      '<span class="prod-badge ' + p.cat + '">' + badge + '</span>',
      '<div class="prod-img-hover"><span class="prod-view-lbl">' + t('View Details','عرض التفاصيل') + '</span></div>',
    '</div>',
    '<div class="prod-card-body">',
      '<span class="prod-cat-tag">' + badge + '</span>',
      '<div class="prod-name">' + name + '</div>',
      '<p class="prod-desc">' + desc + '</p>',
      '<div class="prod-price-row">',
        '<div class="prod-price">' + fmt(p.price) + '</div>',
        '<span class="prod-avail">' + availLbl + '</span>',
      '</div>',
      '<div class="prod-actions">',
        '<button class="btn-add-cart" data-id="' + p.id + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>' +
          addLbl +
        '</button>',
        '<button class="btn-order-now" data-id="' + p.id + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
          orderLbl +
        '</button>',
      '</div>',
    '</div>'
  ].join('');

  return div;
}

function renderProducts() {
  if (!grid) return;
  grid.innerHTML = '';
  PRODUCTS.forEach(function(p) {
    var card = buildCard(p);
    grid.appendChild(card);
  });
  // Staggered entrance
  var cards = grid.querySelectorAll('.prod-card');
  cards.forEach(function(c, i) {
    setTimeout(function() { c.classList.add('visible'); }, 80 + i * 80);
  });
  // Delegate card body click → modal
  grid.addEventListener('click', function(e) {
    var btn = e.target.closest('.btn-add-cart');
    var ord = e.target.closest('.btn-order-now');
    var card = e.target.closest('.prod-card');
    if (btn) {
      e.stopPropagation();
      var id = parseInt(btn.dataset.id, 10);
      cart.add(id, 1);
      btn.classList.add('added');
      btn.textContent = t('Added!', 'تمت الإضافة!');
      setTimeout(function() {
        btn.classList.remove('added');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>' + t('Add to Cart','أضف إلى السلة');
      }, 1800);
    } else if (ord) {
      e.stopPropagation();
      var id = parseInt(ord.dataset.id, 10);
      orderModal.open(id, 1);
    } else if (card) {
      var id = parseInt(card.dataset.id, 10);
      prodModal.open(id);
    }
  });
}

/* ════════════════════════════════════════════
   PRODUCT FILTERS
   ════════════════════════════════════════════ */
function initFilters() {
  var btns = document.querySelectorAll('.prod-filter');
  btns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      btns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var cat = btn.dataset.cat;
      filterCards(cat);
    });
  });
}

function filterCards(cat) {
  var cards = grid ? grid.querySelectorAll('.prod-card') : [];
  cards.forEach(function(c, i) {
    var match = cat === 'all' || c.dataset.cat === cat;
    if (match) {
      c.classList.remove('hidden');
      c.style.opacity = '0';
      c.style.transform = 'translateY(20px)';
      setTimeout(function() {
        c.style.opacity = '';
        c.style.transform = '';
        c.classList.add('visible');
      }, i * 60);
    } else {
      c.classList.add('hidden');
      c.classList.remove('visible');
    }
  });
}

/* ════════════════════════════════════════════
   PRODUCT MODAL
   ════════════════════════════════════════════ */
var prodModal = {
  el: null,
  modalQty: 1,
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
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && self.el.classList.contains('open')) self.close();
    });
  },

  open: function(id) {
    var p = PRODUCTS.filter(function(x){return x.id===id;})[0];
    if (!p || !this.el) return;
    this.currentProduct = p;
    this.modalQty = 1;
    this.populate(p);
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close: function() {
    if (!this.el) return;
    this.el.classList.remove('open');
    document.body.style.overflow = '';
  },

  populate: function(p) {
    var name = IS_AR ? p.nameAr : p.name;
    var desc = IS_AR ? p.descAr : p.desc;
    var specs = IS_AR ? p.specsAr : p.specs;

    document.getElementById('pmCat').textContent = catLabel(p.cat);
    document.getElementById('pmTitle').textContent = name;
    document.getElementById('pmPrice').innerHTML = fmt(p.price);
    document.getElementById('pmDesc').textContent = desc;

    // Specs table
    var specsEl = document.getElementById('pmSpecs');
    specsEl.innerHTML = '';
    Object.keys(specs).forEach(function(k) {
      var row = document.createElement('div');
      row.className = 'pm-spec-row';
      row.innerHTML = '<div class="pm-spec-key">' + k + '</div><div class="pm-spec-val">' + specs[k] + '</div>';
      specsEl.appendChild(row);
    });

    // Main image
    var mainImg = document.getElementById('pmMainImg');
    mainImg.src = p.imgs[0];
    mainImg.alt = name;

    // Thumbnails
    var thumbsEl = document.getElementById('pmThumbs');
    thumbsEl.innerHTML = '';
    var self = this;
    p.imgs.forEach(function(src, i) {
      var div = document.createElement('div');
      div.className = 'pm-thumb' + (i === 0 ? ' active' : '');
      div.innerHTML = '<img src="' + src + '" alt="' + name + ' ' + (i+1) + '" loading="lazy">';
      div.addEventListener('click', function() {
        mainImg.src = src;
        thumbsEl.querySelectorAll('.pm-thumb').forEach(function(t){ t.classList.remove('active'); });
        div.classList.add('active');
      });
      thumbsEl.appendChild(div);
    });

    this.updateQty();
  },

  updateQty: function() {
    var el = document.getElementById('pmQtyNum');
    if (el) el.textContent = this.modalQty;
    var totalEl = document.getElementById('pmTotal');
    if (totalEl && this.currentProduct) {
      totalEl.innerHTML = t('Total: ','الإجمالي: ') + '<strong>' + fmt(this.currentProduct.price * this.modalQty) + '</strong>';
    }
  }
};

/* ════════════════════════════════════════════
   CART SYSTEM
   ════════════════════════════════════════════ */
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

    this.renderDrawer();
    this.updateBadge();
  },

  load: function() {
    try { this.items = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { this.items = []; }
  },

  save: function() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(this.items)); } catch(e) {}
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
    item.qty = Math.max(1, item.qty + delta);
    this.save();
    this.renderDrawer();
    this.updateBadge(false);
  },

  total: function() {
    return this.items.reduce(function(sum, i) {
      var p = PRODUCTS.filter(function(x){return x.id===i.id;})[0];
      return sum + (p ? p.price * i.qty : 0);
    }, 0);
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
      badge.classList.remove('bump');
      void badge.offsetWidth;
      badge.classList.add('bump');
    }
    // Update drawer count
    var dc = document.getElementById('cartDrCount');
    if (dc) dc.textContent = t(c + ' item' + (c!==1?'s':''), c + ' منتج');
  },

  renderDrawer: function() {
    var list = document.getElementById('cartItemsList');
    if (!list) return;
    var self = this;
    if (!this.items.length) {
      list.innerHTML = '<div class="cart-empty-msg"><span class="cart-empty-ico">🛒</span><div class="cart-empty-txt">' + t('Your cart is empty','سلة التسوق فارغة') + '</div></div>';
    } else {
      list.innerHTML = '';
      this.items.forEach(function(ci) {
        var p = PRODUCTS.filter(function(x){return x.id===ci.id;})[0];
        if (!p) return;
        var name = IS_AR ? p.nameAr : p.name;
        var el = document.createElement('div');
        el.className = 'cart-item';
        el.dataset.id = p.id;
        el.innerHTML = [
          '<div class="cart-item-img"><img src="' + p.img + '" alt="' + name + '" loading="lazy"></div>',
          '<div>',
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
        list.appendChild(el);
      });
      // Delegate events
      list.querySelectorAll('.ci-minus').forEach(function(b){
        b.addEventListener('click', function(){ self.updateQty(parseInt(b.dataset.id,10), -1); });
      });
      list.querySelectorAll('.ci-plus').forEach(function(b){
        b.addEventListener('click', function(){ self.updateQty(parseInt(b.dataset.id,10), 1); });
      });
      list.querySelectorAll('.cart-item-remove').forEach(function(b){
        b.addEventListener('click', function(){ self.remove(parseInt(b.dataset.id,10)); });
      });
    }
    // Update totals
    var subEl = document.getElementById('cartSubtotal');
    var totEl = document.getElementById('cartGrandTotal');
    var total = this.total();
    if (subEl) subEl.textContent = fmt(total);
    if (totEl) totEl.textContent = fmt(total);
    // Enable/disable proceed
    var proceedBtn = document.getElementById('cartProceed');
    if (proceedBtn) proceedBtn.disabled = !this.items.length;
    this.updateBadge(false);
  }
};

/* ════════════════════════════════════════════
   ORDER MODAL
   ════════════════════════════════════════════ */
var orderModal = {
  el: null,
  productId: null,
  qty: 1,
  isCartOrder: false,

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
    document.getElementById('omWaBtn').addEventListener('click', function() { self.sendWhatsApp(); });
    document.getElementById('omEmBtn').addEventListener('click', function() { self.sendEmail(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && self.el.classList.contains('open')) self.close();
    });
  },

  open: function(id, qty) {
    this.productId  = id;
    this.qty        = qty || 1;
    this.isCartOrder= false;
    var p = PRODUCTS.filter(function(x){return x.id===id;})[0];
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
    this.qty = cart.count();
    // Show cart summary
    var p = {img: 'assets/images/logo/IAA_LOGO.png', nameAr: 'سلة التسوق', name: 'Cart Order (' + this.qty + ' items)'};
    document.getElementById('omProdImg').src = p.img;
    document.getElementById('omProdImg').alt = IS_AR ? p.nameAr : p.name;
    document.getElementById('omProdName').textContent = IS_AR ? p.nameAr : p.name;
    document.getElementById('omProdPrice').textContent = fmt(cart.total());
    document.getElementById('omProdNote').textContent = t('Cart total','إجمالي السلة');
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
    var totEl = document.getElementById('omTotalLine');
    if (!totEl) return;
    var val;
    if (this.isCartOrder) {
      val = cart.total();
    } else {
      var p = PRODUCTS.filter(function(x){return x.id === orderModal.productId;})[0];
      val = p ? p.price * this.qty : 0;
    }
    totEl.innerHTML = '<span>' + t('Total','الإجمالي') + '</span><span>' + fmt(val) + '</span>';
    var qtyEl = document.getElementById('omQtyVal');
    if (qtyEl && !this.isCartOrder) qtyEl.textContent = this.qty;
  },

  buildMessage: function() {
    var name  = document.getElementById('omName').value.trim()  || '—';
    var phone = document.getElementById('omPhone').value.trim() || '—';
    var email = document.getElementById('omEmail').value.trim() || '—';
    var msg   = document.getElementById('omMsg').value.trim()   || '';
    var lines = [];
    if (IS_AR) {
      lines.push('🛒 *طلب منتج جديد — الفاروقي للتصنيع*\n');
      if (this.isCartOrder) {
        lines.push('📦 *المنتجات:*');
        cart.items.forEach(function(ci) {
          var p = PRODUCTS.filter(function(x){return x.id===ci.id;})[0];
          if (p) lines.push('  • ' + p.nameAr + ' × ' + ci.qty + ' — ' + fmt(p.price * ci.qty));
        });
        lines.push('💰 *الإجمالي:* ' + fmt(cart.total()));
      } else {
        var p = PRODUCTS.filter(function(x){return x.id===this.productId;})[0];
        if (p) {
          lines.push('📦 *المنتج:* ' + p.nameAr);
          lines.push('🔢 *الكمية:* ' + this.qty);
          lines.push('💰 *الإجمالي:* ' + fmt(p.price * this.qty));
        }
      }
      lines.push('\n👤 *الاسم:* ' + name);
      lines.push('📞 *الهاتف:* ' + phone);
      lines.push('📧 *البريد:* ' + email);
      if (msg) lines.push('💬 *ملاحظة:* ' + msg);
      lines.push('\nأرغب في تأكيد الطلب. يرجى التواصل معي.');
    } else {
      lines.push('🛒 *New Product Order — AL FAROOQUE Manufacturing*\n');
      if (this.isCartOrder) {
        lines.push('📦 *Products:*');
        cart.items.forEach(function(ci) {
          var p = PRODUCTS.filter(function(x){return x.id===ci.id;})[0];
          if (p) lines.push('  • ' + p.name + ' × ' + ci.qty + ' — ' + fmt(p.price * ci.qty));
        });
        lines.push('💰 *Total:* ' + fmt(cart.total()));
      } else {
        var p = PRODUCTS.filter(function(x){return x.id===orderModal.productId;})[0];
        if (p) {
          lines.push('📦 *Product:* ' + p.name);
          lines.push('🔢 *Quantity:* ' + this.qty);
          lines.push('💰 *Total:* ' + fmt(p.price * this.qty));
        }
      }
      lines.push('\n👤 *Name:* ' + name);
      lines.push('📞 *Phone:* ' + phone);
      lines.push('📧 *Email:* ' + email);
      if (msg) lines.push('💬 *Note:* ' + msg);
      lines.push('\nI would like to place this order. Please contact me.');
    }
    return lines.join('\n');
  },

  buildEmailBody: function() {
    var name  = document.getElementById('omName').value.trim()  || '—';
    var phone = document.getElementById('omPhone').value.trim() || '—';
    var email = document.getElementById('omEmail').value.trim() || '—';
    var msg   = document.getElementById('omMsg').value.trim()   || '';
    var lines = [];
    if (IS_AR) {
      lines.push('طلب منتج جديد — الفاروقي للتصنيع\n');
      if (this.isCartOrder) {
        lines.push('المنتجات:');
        cart.items.forEach(function(ci) {
          var p = PRODUCTS.filter(function(x){return x.id===ci.id;})[0];
          if (p) lines.push('  - ' + p.nameAr + ' × ' + ci.qty + ' = ' + fmt(p.price * ci.qty));
        });
        lines.push('الإجمالي: ' + fmt(cart.total()));
      } else {
        var p = PRODUCTS.filter(function(x){return x.id===this.productId;})[0];
        if (p) {
          lines.push('المنتج: ' + p.nameAr);
          lines.push('الكمية: ' + this.qty);
          lines.push('الإجمالي: ' + fmt(p.price * this.qty));
        }
      }
      lines.push('\nالاسم: ' + name);
      lines.push('الهاتف: ' + phone);
      lines.push('البريد الإلكتروني: ' + email);
      if (msg) lines.push('ملاحظة: ' + msg);
      lines.push('\nأرغب في تأكيد الطلب.');
    } else {
      lines.push('New Product Order — AL FAROOQUE Manufacturing\n');
      if (this.isCartOrder) {
        lines.push('Products:');
        cart.items.forEach(function(ci) {
          var p = PRODUCTS.filter(function(x){return x.id===ci.id;})[0];
          if (p) lines.push('  - ' + p.name + ' x ' + ci.qty + ' = ' + fmt(p.price * ci.qty));
        });
        lines.push('Total: ' + fmt(cart.total()));
      } else {
        var p = PRODUCTS.filter(function(x){return x.id===orderModal.productId;})[0];
        if (p) {
          lines.push('Product: ' + p.name);
          lines.push('Quantity: ' + this.qty);
          lines.push('Total: ' + fmt(p.price * this.qty));
        }
      }
      lines.push('\nName: ' + name);
      lines.push('Phone: ' + phone);
      lines.push('Email: ' + email);
      if (msg) lines.push('Note: ' + msg);
      lines.push('\nI would like to place this order. Please contact me.');
    }
    return lines.join('\n');
  },

  sendWhatsApp: function() {
    var text = this.buildMessage();
    var url  = 'https://wa.me/' + WA_NUMBER + '?text=' + esc(text);
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  sendEmail: function() {
    var p = this.isCartOrder ? null : PRODUCTS.filter(function(x){return x.id===orderModal.productId;})[0];
    var subject = IS_AR
      ? 'طلب جديد — ' + (p ? p.nameAr : 'طلب سلة')
      : 'New Product Order — ' + (p ? p.name : 'Cart Order');
    var body = this.buildEmailBody();
    window.location.href = 'mailto:' + ORDER_EMAIL + '?subject=' + esc(subject) + '&body=' + esc(body);
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
   INIT
   ════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  slider.init();
  renderProducts();
  initFilters();
  cart.init();
  prodModal.init();
  orderModal.init();
  updateYear();
  /* Patch language switcher after it initialises */
  setTimeout(patchLangSwitcher, 50);
});
