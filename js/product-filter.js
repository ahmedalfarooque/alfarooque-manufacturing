/* ════════════════════════════════════════════════════════════
   AL FAROOQUE — Product Search & Filter System
   Desktop: one horizontal glass toolbar (Search | Category |
   Material | Price | Sort | Reset) mounted inside nav header.
   Mobile (≤768px): search bar + Filter button visible only.
   All other controls open as a glass-morphism bottom sheet.
   Depends on: products.js (PRODUCTS, buildCard, grid, t, IS_AR)
   ════════════════════════════════════════════════════════════ */
'use strict';

/* ── State ────────────────────────────────────────────────── */
var pfState = {
  query:        '',
  category:     'all',
  material:     'all',
  priceMin:     0,
  priceMax:     20000,
  sort:         'featured'
};

var PF_BATCH       = 12;
var _pfVisible     = [];   /* filtered + sorted product list */
var _pfRendered    = 0;    /* how many from _pfVisible are in the DOM */
var _pfSearchTimer = null;
var _pfSheetBuilt  = false; /* lazy — sheet DOM created on first open */
var _pfScrollY     = 0;     /* saved scroll position while sheet is open */

/* ── Dynamic option extraction ────────────────────────────── */
function pfExtract(field) {
  var seen = Object.create(null);
  PRODUCTS.forEach(function(p) {
    var v = (p[field] || '').trim();
    if (v) seen[v] = true;
  });
  return Object.keys(seen).sort();
}

function pfCapitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/* Default display order: interleave products by category (round-robin)
   — one Door, one Bed, one Sofa, repeat — instead of grouping a whole
   category together. Category sequence follows first appearance in
   PRODUCTS (doors → beds → sofa). Used for the default 'featured' view
   only; filters/search/other sorts are unaffected. */
function pfRoundRobinByCat(arr) {
  var order  = [];                 /* category order from PRODUCTS */
  var groups = Object.create(null);
  PRODUCTS.forEach(function(p) {
    var c = p.cat || '';
    if (!(c in groups)) { groups[c] = []; order.push(c); }
  });
  order.forEach(function(c) { groups[c] = []; });
  arr.forEach(function(p) {
    var c = p.cat || '';
    if (!(c in groups)) { groups[c] = []; order.push(c); }
    groups[c].push(p);
  });
  var result = [];
  var idx = 0, added = true;
  while (added) {
    added = false;
    for (var i = 0; i < order.length; i++) {
      var g = groups[order[i]];
      if (g.length > idx) { result.push(g[idx]); added = true; }
    }
    idx++;
  }
  return result;
}

/* ── Filter + sort ────────────────────────────────────────── */
function pfMatch(p, q) {
  if (!q) return true;
  var haystack = [
    IS_AR ? p.nameAr : p.name,
    IS_AR ? p.descAr : p.desc,
    p.cat || '',
    p.material || ''
  ];
  var feats = IS_AR ? p.featuresAr : p.features;
  if (feats) haystack = haystack.concat(feats);
  return haystack.some(function(s) {
    return s && s.toLowerCase().indexOf(q) !== -1;
  });
}

function pfGetFiltered() {
  var q = pfState.query.toLowerCase().trim();
  var arr = PRODUCTS.filter(function(p) {
    if (!pfMatch(p, q)) return false;
    if (pfState.category !== 'all' && p.cat !== pfState.category) return false;
    if (pfState.material !== 'all' && (p.material || '') !== pfState.material) return false;
    if (p.price < pfState.priceMin || p.price > pfState.priceMax) return false;
    return true;
  });

  if (pfState.sort === 'price-asc')  arr.sort(function(a,b){ return a.price - b.price; });
  else if (pfState.sort === 'price-desc') arr.sort(function(a,b){ return b.price - a.price; });
  else if (pfState.sort === 'name-az') arr.sort(function(a,b){
    return (IS_AR ? a.nameAr : a.name).localeCompare(IS_AR ? b.nameAr : b.name);
  });
  else if (pfState.sort === 'name-za') arr.sort(function(a,b){
    return (IS_AR ? b.nameAr : b.name).localeCompare(IS_AR ? a.nameAr : a.name);
  });
  else if (pfState.sort === 'newest') arr.sort(function(a,b){ return b.id - a.id; });
  else if (pfState.sort === 'featured') arr = pfRoundRobinByCat(arr);
  /* 'best-selling' keeps PRODUCTS order */

  return arr;
}

/* ── Render helpers ───────────────────────────────────────── */
function pfRenderBatch() {
  var slice = _pfVisible.slice(_pfRendered, _pfRendered + PF_BATCH);
  var frag  = document.createDocumentFragment();
  var cards = [];
  slice.forEach(function(p) {
    var card = buildCard(p);
    frag.appendChild(card);
    cards.push(card);
  });
  grid.appendChild(frag);
  cards.forEach(function(c, i) {
    setTimeout(function() { c.classList.add('visible'); }, 30 + i * 30);
  });
  _pfRendered += slice.length;
  pfUpdateLoadMore();
}

function pfUpdateLoadMore() {
  var wrap = document.getElementById('prodLoadMoreWrap');
  var btn  = document.getElementById('prodLoadMore');
  if (!wrap) return;
  wrap.style.display = (_pfRendered < _pfVisible.length) ? '' : 'none';
  if (btn) btn.textContent = t('Load More Products', 'عرض المزيد من المنتجات');
}

function pfRenderAll() {
  _pfVisible  = pfGetFiltered();
  _pfRendered = 0;
  grid.innerHTML = '';

  /* Replace Load More listener to use the filtered batch system */
  var oldBtn = document.getElementById('prodLoadMore');
  if (oldBtn) {
    var newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', pfRenderBatch);
  }

  if (_pfVisible.length === 0) {
    pfRenderEmpty();
  } else {
    pfRenderBatch();
  }
  pfUpdateCount();
  pfUpdateChips();
  pfUpdateFilterBadge();
}

function pfRenderEmpty() {
  var el = document.createElement('div');
  el.className = 'pf-empty';
  el.innerHTML =
    '<div class="pf-empty-ico">' +
      '<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="11" cy="11" r="8"/>' +
        '<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
        '<line x1="8" y1="11" x2="14" y2="11"/>' +
      '</svg>' +
    '</div>' +
    '<div class="pf-empty-title">' + t('No products found', 'لا توجد منتجات') + '</div>' +
    '<div class="pf-empty-sub">' + t('Try adjusting your search or filters', 'جرّب تعديل البحث أو المرشحات') + '</div>' +
    '<button class="pf-reset-btn" id="pfEmptyReset">' + t('Reset Filters', 'إعادة ضبط المرشحات') + '</button>';
  grid.appendChild(el);
  el.querySelector('#pfEmptyReset').addEventListener('click', pfReset);
}

/* ── Count & chips ────────────────────────────────────────── */
function pfUpdateCount() {
  var el = document.getElementById('pfCount');
  if (!el) return;
  var total = _pfVisible.length;
  if (total === 0) {
    el.textContent = t('No products found', 'لا توجد منتجات');
  } else if (_pfRendered >= total) {
    el.textContent = t('Showing all ' + total + (total === 1 ? ' product' : ' products'),
                       'عرض جميع ' + total + ' منتج');
  } else {
    el.textContent = t('Showing ' + _pfRendered + ' of ' + total + ' products',
                       'عرض ' + _pfRendered + ' من ' + total + ' منتج');
  }
}

function pfUpdateChips() {
  var el = document.getElementById('pfChips');
  if (!el) return;
  el.innerHTML = '';
  var chips = [];
  if (pfState.query)              chips.push({ key: 'query',    label: '"' + pfState.query + '"' });
  if (pfState.category !== 'all') chips.push({ key: 'category', label: pfCapitalize(pfState.category) });
  if (pfState.material !== 'all') chips.push({ key: 'material', label: pfState.material });
  if (pfState.priceMin > 0 || pfState.priceMax < 20000) {
    chips.push({ key: 'price', label: 'SAR ' + pfState.priceMin.toLocaleString('en-US') + '–' + pfState.priceMax.toLocaleString('en-US') });
  }
  chips.forEach(function(c) {
    var chip = document.createElement('button');
    chip.className = 'pf-chip';
    chip.setAttribute('type', 'button');
    chip.innerHTML = '<span>' + c.label + '</span><span class="pf-chip-x">&#215;</span>';
    chip.addEventListener('click', function() {
      if (c.key === 'query')      { pfState.query = ''; pfSyncSearchInput(); }
      else if (c.key === 'price') { pfState.priceMin = 0; pfState.priceMax = 20000; }
      else                          pfState[c.key] = 'all';
      pfSyncUI();
      pfRenderAll();
    });
    el.appendChild(chip);
  });
}

/* ── Filter badge — active filter count on mobile button ──── */
function pfUpdateFilterBadge() {
  var badge = document.getElementById('pfFilterBadge');
  if (!badge) return;
  var count = 0;
  if (pfState.query)               count++;
  if (pfState.category !== 'all')  count++;
  if (pfState.material !== 'all')  count++;
  if (pfState.priceMin > 0 || pfState.priceMax < 20000) count++;
  if (pfState.sort !== 'featured') count++;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.add('visible');
  } else {
    badge.textContent = '';
    badge.classList.remove('visible');
  }
}

/* ── UI sync ──────────────────────────────────────────────── */
function pfSyncSearchInput() {
  var inp  = document.getElementById('pfSearchInput');
  var clr  = document.getElementById('pfSearchClear');
  if (inp) inp.value = pfState.query;
  if (clr) clr.style.display = pfState.query ? '' : 'none';
}

function pfSyncUI() {
  pfSyncSearchInput();
  pfSyncSelect('pfCatSelect',  pfState.category);
  pfSyncSelect('pfMatSelect',  pfState.material);
  pfSyncSelect('pfSortSelect', pfState.sort);
  pfSyncPriceInputs('pfPriceMin', 'pfPriceMax');
}

function pfSyncSelect(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val;
}

function pfSyncPriceInputs(minId, maxId) {
  var mn = document.getElementById(minId);
  var mx = document.getElementById(maxId);
  if (mn) mn.value = pfState.priceMin;
  if (mx) mx.value = pfState.priceMax;
}

/* ── Reset ────────────────────────────────────────────────── */
function pfReset() {
  pfState.query    = '';
  pfState.category = 'all';
  pfState.material = 'all';
  pfState.priceMin = 0;
  pfState.priceMax = 20000;
  pfState.sort     = 'featured';
  pfSyncUI();
  pfRenderAll();
}

/* ── Toolbar HTML builder — single horizontal glass bar ───── */
function pfBuildToolbar() {
  var categories = pfExtract('cat');
  var materials  = pfExtract('material');

  var catOpts = '<option value="all">' + t('All Categories', 'جميع الفئات') + '</option>' +
    categories.map(function(c) {
      return '<option value="' + c + '">' + pfCapitalize(c) + '</option>';
    }).join('');

  var matOpts = '<option value="all">' + t('All Materials', 'جميع المواد') + '</option>' +
    materials.map(function(m) {
      return '<option value="' + m + '">' + m + '</option>';
    }).join('');

  var sortOpts = [
    '<option value="featured">'    + t('Featured',           'مميز')           + '</option>',
    '<option value="newest">'      + t('Newest',             'الأحدث')         + '</option>',
    '<option value="price-asc">'   + t('Price: Low → High',  'السعر: الأقل')   + '</option>',
    '<option value="price-desc">'  + t('Price: High → Low',  'السعر: الأعلى')  + '</option>',
    '<option value="name-az">'     + t('Name: A → Z',        'الاسم: أ ← ي')   + '</option>',
    '<option value="name-za">'     + t('Name: Z → A',        'الاسم: ي ← أ')   + '</option>',
    '<option value="best-selling">'+ t('Best Selling',       'الأكثر مبيعاً')  + '</option>'
  ].join('');

  var icoSearch = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var icoReset  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>';
  var icoFilter = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';

  return [
    '<div class="pf-toolbar" id="pfToolbar">',

    /* Single horizontal control bar */
    '  <div class="pf-bar">',
    '    <div class="pf-search-wrap">',
    '      <span class="pf-search-icon">' + icoSearch + '</span>',
    '      <input type="text" id="pfSearchInput" class="pf-search-input" placeholder="' + t('Search products…', 'ابحث عن المنتجات…') + '" autocomplete="off" spellcheck="false">',
    '      <button class="pf-search-clear" id="pfSearchClear" type="button" aria-label="Clear search" style="display:none">&#215;</button>',
    '    </div>',

    /* Mobile-only: Filter button (hidden on desktop via CSS) */
    '    <button class="pf-mobile-filter-btn" id="pfFilterBtn" type="button" aria-label="' + t('Open Filters', 'فتح المرشحات') + '">',
    '      ' + icoFilter + '<span>' + t('Filters', 'المرشحات') + '</span>',
    '      <span class="pf-filter-badge" id="pfFilterBadge" aria-hidden="true"></span>',
    '    </button>',

    /* Desktop-only: inline filter controls (hidden on mobile via CSS) */
    '    <select class="pf-select" id="pfCatSelect" aria-label="' + t('Category', 'الفئة') + '">' + catOpts + '</select>',
    '    <select class="pf-select" id="pfMatSelect" aria-label="' + t('Material', 'المادة') + '">' + matOpts + '</select>',
    '    <div class="pf-price-row" aria-label="' + t('Price Range (SAR)', 'نطاق السعر') + '">',
    '      <input type="number" class="pf-price-input" id="pfPriceMin" value="0" min="0" max="20000" step="100" placeholder="' + t('Min', 'أدنى') + '">',
    '      <span class="pf-price-sep">—</span>',
    '      <input type="number" class="pf-price-input" id="pfPriceMax" value="20000" min="0" max="20000" step="100" placeholder="' + t('Max', 'أقصى') + '">',
    '    </div>',
    '    <select class="pf-select" id="pfSortSelect" aria-label="' + t('Sort By', 'الترتيب') + '">' + sortOpts + '</select>',
    '    <button class="pf-reset-btn" id="pfResetBtn" type="button">' + icoReset + ' <span>' + t('Reset', 'إعادة ضبط') + '</span></button>',
    '  </div>',

    /* Info line — result count + active chips */
    '  <div class="pf-row-meta">',
    '    <span class="pf-count" id="pfCount"></span>',
    '    <div class="pf-chips" id="pfChips"></div>',
    '  </div>',

    '</div>'
  ].join('\n');
}

/* ── Mobile bottom sheet builder (lazy — built on first open) */
function pfBuildSheet() {
  var categories = pfExtract('cat');
  var materials  = pfExtract('material');

  var catOpts = '<option value="all">' + t('All Categories', 'جميع الفئات') + '</option>' +
    categories.map(function(c) {
      return '<option value="' + c + '">' + pfCapitalize(c) + '</option>';
    }).join('');

  var matOpts = '<option value="all">' + t('All Materials', 'جميع المواد') + '</option>' +
    materials.map(function(m) {
      return '<option value="' + m + '">' + m + '</option>';
    }).join('');

  var sortOpts = [
    '<option value="featured">'    + t('Featured',           'مميز')           + '</option>',
    '<option value="newest">'      + t('Newest',             'الأحدث')         + '</option>',
    '<option value="price-asc">'   + t('Price: Low → High',  'السعر: الأقل')   + '</option>',
    '<option value="price-desc">'  + t('Price: High → Low',  'السعر: الأعلى')  + '</option>',
    '<option value="name-az">'     + t('Name: A → Z',        'الاسم: أ ← ي')   + '</option>',
    '<option value="name-za">'     + t('Name: Z → A',        'الاسم: ي ← أ')   + '</option>',
    '<option value="best-selling">'+ t('Best Selling',       'الأكثر مبيعاً')  + '</option>'
  ].join('');

  var icoReset = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>';

  var wrapper = document.createElement('div');
  wrapper.innerHTML =
    '<div class="pf-sheet-overlay" id="pfSheetOverlay" aria-hidden="true">' +
    '  <div class="pf-sheet" id="pfSheet" role="dialog" aria-modal="true" aria-label="' + t('Product Filters', 'مرشحات المنتجات') + '">' +
    '    <div class="pf-sheet-handle"></div>' +
    '    <div class="pf-sheet-header">' +
    '      <span class="pf-sheet-title">' + t('Filters', 'المرشحات') + '</span>' +
    '      <button class="pf-sheet-close" id="pfSheetClose" type="button" aria-label="' + t('Close filters', 'إغلاق المرشحات') + '">&#215;</button>' +
    '    </div>' +
    '    <div class="pf-sheet-body">' +
    '      <div class="pf-sheet-group">' +
    '        <label class="pf-sheet-label" for="pfMCatSelect">' + t('Category', 'الفئة') + '</label>' +
    '        <select class="pf-select pf-sheet-select" id="pfMCatSelect">' + catOpts + '</select>' +
    '      </div>' +
    '      <div class="pf-sheet-group">' +
    '        <label class="pf-sheet-label" for="pfMMatSelect">' + t('Material', 'المادة') + '</label>' +
    '        <select class="pf-select pf-sheet-select" id="pfMMatSelect">' + matOpts + '</select>' +
    '      </div>' +
    '      <div class="pf-sheet-group">' +
    '        <label class="pf-sheet-label">' + t('Price Range (SAR)', 'نطاق السعر (ريال)') + '</label>' +
    '        <div class="pf-price-row pf-sheet-price-row">' +
    '          <input type="number" class="pf-price-input" id="pfMPriceMin" value="0" min="0" max="20000" step="100" placeholder="' + t('Min', 'أدنى') + '">' +
    '          <span class="pf-price-sep">—</span>' +
    '          <input type="number" class="pf-price-input" id="pfMPriceMax" value="20000" min="0" max="20000" step="100" placeholder="' + t('Max', 'أقصى') + '">' +
    '        </div>' +
    '      </div>' +
    '      <div class="pf-sheet-group">' +
    '        <label class="pf-sheet-label" for="pfMSortSelect">' + t('Sort By', 'الترتيب') + '</label>' +
    '        <select class="pf-select pf-sheet-select" id="pfMSortSelect">' + sortOpts + '</select>' +
    '      </div>' +
    '    </div>' +
    '    <div class="pf-sheet-footer">' +
    '      <button class="pf-sheet-reset" id="pfSheetResetBtn" type="button">' + icoReset + ' <span>' + t('Reset', 'إعادة ضبط') + '</span></button>' +
    '      <button class="pf-sheet-apply" id="pfSheetApplyBtn" type="button">' + t('Apply Filters', 'تطبيق المرشحات') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  document.body.appendChild(wrapper.firstElementChild);
  _pfSheetBuilt = true;
  pfWireSheetEvents();
}

/* ── Sheet: open ──────────────────────────────────────────── */
function pfOpenSheet() {
  if (!_pfSheetBuilt) pfBuildSheet();
  _pfScrollY = window.scrollY || window.pageYOffset;
  pfSyncMobileSheet();
  var overlay = document.getElementById('pfSheetOverlay');
  if (!overlay) return;
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('pf-sheet-open');
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top      = '-' + _pfScrollY + 'px';
  document.body.style.width    = '100%';
}

/* ── Sheet: close ─────────────────────────────────────────── */
function pfCloseSheet() {
  var overlay = document.getElementById('pfSheetOverlay');
  if (!overlay) return;
  overlay.classList.remove('pf-sheet-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top      = '';
  document.body.style.width    = '';
  window.scrollTo(0, _pfScrollY);
}

/* ── Sync sheet inputs from current pfState ───────────────── */
function pfSyncMobileSheet() {
  var catSel   = document.getElementById('pfMCatSelect');
  var matSel   = document.getElementById('pfMMatSelect');
  var sortSel  = document.getElementById('pfMSortSelect');
  var priceMin = document.getElementById('pfMPriceMin');
  var priceMax = document.getElementById('pfMPriceMax');
  if (catSel)   catSel.value   = pfState.category;
  if (matSel)   matSel.value   = pfState.material;
  if (sortSel)  sortSel.value  = pfState.sort;
  if (priceMin) priceMin.value = pfState.priceMin;
  if (priceMax) priceMax.value = pfState.priceMax;
}

/* ── Apply sheet selections → pfState, render, close ─────── */
function pfApplyFromSheet() {
  var catSel   = document.getElementById('pfMCatSelect');
  var matSel   = document.getElementById('pfMMatSelect');
  var sortSel  = document.getElementById('pfMSortSelect');
  var priceMin = document.getElementById('pfMPriceMin');
  var priceMax = document.getElementById('pfMPriceMax');

  if (catSel)  pfState.category = catSel.value;
  if (matSel)  pfState.material = matSel.value;
  if (sortSel) pfState.sort     = sortSel.value;

  var lo = parseInt((priceMin && priceMin.value) || '0', 10);
  var hi = parseInt((priceMax && priceMax.value) || '20000', 10);
  if (isNaN(lo) || lo < 0)     lo = 0;
  if (isNaN(hi) || hi > 20000) hi = 20000;
  if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
  pfState.priceMin = lo;
  pfState.priceMax = hi;

  pfSyncUI();
  pfRenderAll();
  pfCloseSheet();
}

/* ── Wire sheet-specific events (called after sheet is built) */
function pfWireSheetEvents() {
  var overlay  = document.getElementById('pfSheetOverlay');
  var sheet    = document.getElementById('pfSheet');
  var closeBtn = document.getElementById('pfSheetClose');
  var applyBtn = document.getElementById('pfSheetApplyBtn');
  var resetBtn = document.getElementById('pfSheetResetBtn');

  if (closeBtn) closeBtn.addEventListener('click', pfCloseSheet);

  if (applyBtn) applyBtn.addEventListener('click', pfApplyFromSheet);

  if (resetBtn) resetBtn.addEventListener('click', function() {
    pfReset();
    pfSyncMobileSheet();
    pfCloseSheet();
  });

  /* Tap outside (on the semi-transparent backdrop) to close */
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) pfCloseSheet();
    });
  }

  /* ESC key closes the sheet */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var o = document.getElementById('pfSheetOverlay');
      if (o && o.classList.contains('pf-sheet-open')) pfCloseSheet();
    }
  });

  /* Swipe-down gesture closes the sheet */
  if (sheet) {
    var _touchStartY = 0;
    sheet.addEventListener('touchstart', function(e) {
      _touchStartY = e.touches[0].clientY;
    }, { passive: true });
    sheet.addEventListener('touchend', function(e) {
      var delta = e.changedTouches[0].clientY - _touchStartY;
      if (delta > 80) pfCloseSheet();
    }, { passive: true });
  }
}

/* ── Wire all events ──────────────────────────────────────── */
function pfWireEvents() {
  /* Search input — debounced */
  var inp = document.getElementById('pfSearchInput');
  var clr = document.getElementById('pfSearchClear');
  if (inp) {
    inp.addEventListener('input', function() {
      clearTimeout(_pfSearchTimer);
      _pfSearchTimer = setTimeout(function() {
        pfState.query = inp.value;
        if (clr) clr.style.display = pfState.query ? '' : 'none';
        pfRenderAll();
      }, 250);
    });
  }
  if (clr) {
    clr.addEventListener('click', function() {
      pfState.query = '';
      pfSyncSearchInput();
      pfRenderAll();
      if (inp) inp.focus();
    });
  }

  /* Mobile filter button → open bottom sheet */
  var filterBtn = document.getElementById('pfFilterBtn');
  if (filterBtn) filterBtn.addEventListener('click', pfOpenSheet);

  /* Desktop selects */
  function wireSelect(id, key) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', function() {
      pfState[key] = el.value;
      pfRenderAll();
    });
  }
  wireSelect('pfCatSelect',  'category');
  wireSelect('pfMatSelect',  'material');
  wireSelect('pfSortSelect', 'sort');

  /* Desktop price inputs */
  function wirePriceInputs(minId, maxId) {
    var mn = document.getElementById(minId);
    var mx = document.getElementById(maxId);
    function onPriceChange() {
      var lo = parseInt((mn && mn.value) || '0', 10);
      var hi = parseInt((mx && mx.value) || '20000', 10);
      if (isNaN(lo) || lo < 0)     lo = 0;
      if (isNaN(hi) || hi > 20000) hi = 20000;
      if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
      pfState.priceMin = lo;
      pfState.priceMax = hi;
      pfRenderAll();
    }
    if (mn) mn.addEventListener('change', onPriceChange);
    if (mx) mx.addEventListener('change', onPriceChange);
  }
  wirePriceInputs('pfPriceMin', 'pfPriceMax');

  /* Desktop reset */
  var resetBtn = document.getElementById('pfResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', pfReset);
}

/* ── Init — runs after products.js DOMContentLoaded ──────── */
document.addEventListener('DOMContentLoaded', function() {
  var section = document.getElementById('products');
  if (!section || !grid) return;

  var toolbarDiv = document.createElement('div');
  toolbarDiv.innerHTML = pfBuildToolbar();
  var toolbar = toolbarDiv.firstElementChild;

  /* Mount the search + filters INSIDE the navigation header so the
     nav, search and filters read as one single header component. */
  var nav = document.querySelector('.nav');
  if (nav) {
    document.body.classList.add('products-page');
    nav.appendChild(toolbar);
  } else {
    /* Fallback: above the section header */
    var header = section.querySelector('.prod-section-header');
    if (header) header.insertAdjacentElement('beforebegin', toolbar);
  }

  /* Wire events */
  pfWireEvents();

  /* Initial render — replaces the one from products.js */
  pfRenderAll();
});
