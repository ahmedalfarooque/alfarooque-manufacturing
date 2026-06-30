/* ════════════════════════════════════════════════════════════
   AL FAROOQUE — Product Search & Filter System
   One horizontal glass toolbar: Search | Category | Material |
   Price | Sort | Reset — mounted inside the navigation header.
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

var PF_BATCH    = 12;
var _pfVisible  = [];   /* filtered + sorted product list */
var _pfRendered = 0;    /* how many from _pfVisible are in the DOM */
var _pfSearchTimer = null;

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
  /* 'featured' and 'best-selling' keep PRODUCTS order */

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
  if (pfState.query)              chips.push({ key: 'query',    label: '“' + pfState.query + '”' });
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
      if (c.key === 'query')    { pfState.query = ''; pfSyncSearchInput(); }
      else if (c.key === 'price') { pfState.priceMin = 0; pfState.priceMax = 20000; }
      else pfState[c.key] = 'all';
      pfSyncUI();
      pfRenderAll();
    });
    el.appendChild(chip);
  });
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
    '<option value="featured">'   + t('Featured',           'مميز')                     + '</option>',
    '<option value="newest">'     + t('Newest',             'الأحدث')          + '</option>',
    '<option value="price-asc">'  + t('Price: Low → High',  'السعر: الأقل') + '</option>',
    '<option value="price-desc">' + t('Price: High → Low',  'السعر: الأعلى') + '</option>',
    '<option value="name-az">'    + t('Name: A → Z',   'الاسم: أ ← ي') + '</option>',
    '<option value="name-za">'    + t('Name: Z → A',   'الاسم: ي ← أ') + '</option>',
    '<option value="best-selling">'+ t('Best Selling',      'الأكثر مبيعاً') + '</option>'
  ].join('');

  var icoSearch = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var icoReset  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>';

  return [
    '<div class="pf-toolbar" id="pfToolbar">',

    /* Single horizontal control bar */
    '  <div class="pf-bar">',
    '    <div class="pf-search-wrap">',
    '      <span class="pf-search-icon">' + icoSearch + '</span>',
    '      <input type="text" id="pfSearchInput" class="pf-search-input" placeholder="' + t('Search products…', 'ابحث عن المنتجات…') + '" autocomplete="off" spellcheck="false">',
    '      <button class="pf-search-clear" id="pfSearchClear" type="button" aria-label="Clear search" style="display:none">&#215;</button>',
    '    </div>',
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

  /* Selects */
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

  /* Price inputs */
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

  /* Reset */
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
