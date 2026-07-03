'use strict';

/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Admin Dashboard
   Session-guarded SPA-lite shell. Every module below reads/writes the
   real Supabase tables through /api/admin/* (service-role, server-side
   only) — no localStorage, no dummy data.
   ═══════════════════════════════════════════════════════════════════ */

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const money = n => 'SAR ' + Number(n || 0).toLocaleString('en-US');
const icons = () => { if (window.lucide) window.lucide.createIcons(); };

/* ── API helper: same-origin, CSRF header, auto-redirect to login on 401 ── */
async function api(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'X-Admin-Request': '1' }, opts.headers || {});
  if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { location.href = '/pages/admin/login.html'; throw new Error('Not authenticated'); }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ── Toast ── */
function toast(text) {
  let el = $('#adToast');
  if (!el) { el = document.createElement('div'); el.id = 'adToast'; el.className = 'ad-toast'; document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('is-visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

/* ── Generic modal (reused by every module) ── */
function ensureModal() {
  let el = $('#adModal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'adModal';
    el.className = 'ad-modal-overlay';
    el.innerHTML = '<div class="ad-modal" id="adModalInner"><button class="ad-modal-close" id="adModalClose">&times;</button><div id="adModalBody"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) closeModal(); });
    $('#adModalClose', el).addEventListener('click', closeModal);
  }
  return el;
}
function openModal(html, wide) {
  const el = ensureModal();
  $('#adModalInner', el).className = 'ad-modal' + (wide ? ' ad-modal--wide' : '');
  $('#adModalBody', el).innerHTML = html;
  el.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  icons();
  return el;
}
function closeModal() {
  const el = $('#adModal');
  if (el) el.classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ── Image lightbox (product previews) ─────────────────────────────
   One overlay reused for every gallery. Opened via delegated clicks on
   any element carrying data-lb (URI-encoded JSON array of image URLs) +
   data-lb-idx, so it works inside dynamically rendered modals with
   nothing to rebind. Click the image to zoom, arrows/keys to navigate,
   Esc / backdrop / × to close. */
let LB = null, LB_IMGS = [], LB_IDX = 0;
function ensureLightbox() {
  if (LB) return LB;
  LB = document.createElement('div');
  LB.id = 'adLightbox';
  LB.className = 'ad-lightbox';
  LB.innerHTML =
    '<button class="ad-lb-btn ad-lb-close" aria-label="Close">&times;</button>' +
    '<button class="ad-lb-btn ad-lb-prev" aria-label="Previous">&#10094;</button>' +
    '<img class="ad-lb-img" alt="">' +
    '<button class="ad-lb-btn ad-lb-next" aria-label="Next">&#10095;</button>' +
    '<div class="ad-lb-count"></div>';
  document.body.appendChild(LB);
  LB.addEventListener('click', e => { if (e.target === LB) closeLightbox(); });
  LB.querySelector('.ad-lb-close').addEventListener('click', closeLightbox);
  LB.querySelector('.ad-lb-prev').addEventListener('click', () => lbNav(-1));
  LB.querySelector('.ad-lb-next').addEventListener('click', () => lbNav(1));
  LB.querySelector('.ad-lb-img').addEventListener('click', function () { this.classList.toggle('is-zoomed'); });
  document.addEventListener('keydown', e => {
    if (!LB.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lbNav(-1);
    else if (e.key === 'ArrowRight') lbNav(1);
  });
  return LB;
}
function lbShow() {
  const img = LB.querySelector('.ad-lb-img');
  img.classList.remove('is-zoomed');
  img.src = LB_IMGS[LB_IDX];
  const multi = LB_IMGS.length > 1;
  LB.querySelector('.ad-lb-prev').style.visibility = multi ? 'visible' : 'hidden';
  LB.querySelector('.ad-lb-next').style.visibility = multi ? 'visible' : 'hidden';
  LB.querySelector('.ad-lb-count').textContent = multi ? (LB_IDX + 1) + ' / ' + LB_IMGS.length : '';
}
function lbNav(d) { if (!LB_IMGS.length) return; LB_IDX = (LB_IDX + d + LB_IMGS.length) % LB_IMGS.length; lbShow(); }
function openLightbox(images, idx) {
  if (!images || !images.length) return;
  ensureLightbox();
  LB_IMGS = images; LB_IDX = Math.min(Math.max(0, idx || 0), images.length - 1);
  lbShow();
  LB.classList.add('is-open');
}
function closeLightbox() { if (LB) LB.classList.remove('is-open'); }

/* ── Read-only view helpers ────────────────────────────────────────── */
/* Product images were migrated with repo-relative paths ("assets/…");
   admin pages live under /pages/admin/, so root-anchor them. */
function imgUrl(src) {
  if (!src) return '';
  if (/^(https?:)?\/\//.test(src) || src.charAt(0) === '/') return src;
  return '/' + src;
}
function lbAttrs(imgs, idx) {
  return ' data-lb="' + encodeURIComponent(JSON.stringify(imgs)) + '" data-lb-idx="' + idx + '"';
}
/* Label/value rows; values are pre-escaped by the caller (some contain
   badge HTML). Empty values render as "—". */
function infoGrid(pairs) {
  return '<div class="ad-view-grid">' + pairs.map(p =>
    '<div class="ad-view-row"><span class="ad-view-lbl">' + esc(p[0]) + '</span><span class="ad-view-val">' + (p[1] == null || p[1] === '' ? '—' : p[1]) + '</span></div>'
  ).join('') + '</div>';
}
/* One order line as a product card: thumbnail + gallery (lightbox-able),
   name, description and specs — all from the enriched product record the
   API joined in; items whose product was deleted/renamed fall back to
   the snapshot fields stored on the order itself. */
function orderItemCard(it) {
  const p = it.product || null;
  const imgs = (p && p.images.length ? p.images : []).map(imgUrl);
  const thumb = imgs.length
    ? '<img class="ad-oi-thumb" src="' + esc(imgs[0]) + '" alt="" loading="lazy"' + lbAttrs(imgs, 0) + '>'
    : '<div class="ad-oi-thumb ad-oi-thumb--empty"><i data-lucide="package"></i></div>';
  const gallery = imgs.length > 1
    ? '<div class="ad-oi-gallery">' + imgs.map((src, i) =>
        '<img src="' + esc(src) + '" alt="" loading="lazy"' + lbAttrs(imgs, i) + '>').join('') + '</div>'
    : '';
  const qty = Number(it.qty) || 1;
  const unit = it.price != null ? Number(it.price) : (it.lineTotal ? Number(it.lineTotal) / qty : 0);
  const total = it.lineTotal != null ? Number(it.lineTotal) : unit * qty;
  const spec = (lbl, val) => val ? '<div class="ad-oi-spec"><span>' + esc(lbl) + '</span>' + esc(val) + '</div>' : '';
  return '<div class="ad-oi-card">' +
    '<div class="ad-oi-media">' + thumb + gallery + '</div>' +
    '<div class="ad-oi-body">' +
      '<div class="ad-oi-name">' + esc(it.name || (p && p.name) || 'Item') + '</div>' +
      (p && p.description ? '<div class="ad-oi-desc">' + esc(p.description) + '</div>' : '') +
      '<div class="ad-oi-specs">' +
        spec('Category', p && p.category) +
        spec('SKU', p && p.sku) +
        spec('Material', it.material || (p && p.material)) +
        spec('Size', it.size || (p && p.sizes.length ? p.sizes.join(' / ') : null)) +
        spec('Color', it.color) +
        spec('Finish', it.finish || (p && p.finishes.length ? p.finishes.join(' / ') : null)) +
        spec('Quantity', '× ' + qty) +
        spec('Unit Price', money(unit)) +
      '</div>' +
    '</div>' +
    '<div class="ad-oi-total">' + money(total) + '</div>' +
  '</div>';
}

/* ── State ── */
let CURRENT_ADMIN = null;
let currentPage = 'home';

/* ════════════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════════════ */
async function boot() {
  try {
    const data = await api('/api/admin/auth');
    CURRENT_ADMIN = data.admin;
  } catch (e) { return; } // already redirected to login

  /* Profile-display is cosmetic — never let a hiccup here block wiring
     the actual navigation below. */
  try {
    $('#profileName').textContent = CURRENT_ADMIN.full_name || CURRENT_ADMIN.email;
    $('#profileAvatar').textContent = (CURRENT_ADMIN.full_name || CURRENT_ADMIN.email || '??').slice(0, 2).toUpperCase();
  } catch (e) { console.error('[admin] profile display failed (non-fatal):', e); }

  wireNav();
  wireTopbar();
  startClock();
  pollNotifBadge();
  setInterval(pollNotifBadge, 30000);

  /* Initial route: the URL hash is the source of truth (works with
     Back/Forward and survives a refresh) — ?page=<x> is accepted as an
     alternate entry-point format (e.g. a shared link) and is normalised
     into a hash immediately so the rest of the routing stays unified. */
  const initialParams = new URLSearchParams(location.search);
  const pageParam = initialParams.get('page');
  let startPage = location.hash.replace('#', '');
  if (!startPage && pageParam) {
    startPage = pageParam;
    history.replaceState(null, '', location.pathname + '#' + pageParam);
  }
  goTo(startPage || 'home');
  window.addEventListener('hashchange', () => goTo(location.hash.replace('#', '')));
  icons();

  /* Deep-link handoff from the "View Order" email button (via login.js) —
     jump straight to that exact order/quote once the dashboard is ready,
     then clean the query string off the URL. */
  const params = new URLSearchParams(location.search);
  const openOrderId = params.get('openOrder');
  const openQuoteId = params.get('openQuote');
  if (openOrderId || openQuoteId) {
    history.replaceState(null, '', location.pathname + location.hash);
    if (openOrderId) { location.hash = '#orders'; setTimeout(() => openOrderDetail(openOrderId), 200); }
    else { location.hash = '#quotes'; setTimeout(() => openQuoteDetail(openQuoteId), 200); }
  }
}

/* Navigation uses ONE delegated listener on document instead of binding
   a handler to each button individually. This is deliberate: it can
   never "miss" a button (nothing to forget to (re)bind), it doesn't care
   whether the click lands on the <button>, the icon Lucide swaps in for
   the original <i data-lucide>, or the label <span> — e.target.closest()
   finds the right ancestor regardless — and it keeps working even if a
   render function ever rebuilds part of the chrome. Sidebar AND topbar
   buttons (#notifBellBtn, #quickAddBtn, #profileBtn) all carry the same
   [data-page] attribute, so one handler covers both. */
function wireNav() {
  document.addEventListener('click', e => {
    if (!e.target || typeof e.target.closest !== 'function') return;
    /* Product image → lightbox (works inside any modal, nothing to rebind) */
    const lbEl = e.target.closest('[data-lb]');
    if (lbEl) {
      try { openLightbox(JSON.parse(decodeURIComponent(lbEl.getAttribute('data-lb'))), Number(lbEl.getAttribute('data-lb-idx')) || 0); } catch (_) {}
      return;
    }
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn) { location.hash = '#' + pageBtn.getAttribute('data-page'); return; }
    const soonBtn = e.target.closest('[data-soon]');
    if (soonBtn) { renderComingSoon(soonBtn.getAttribute('data-soon')); return; }
    /* Any other button (View / Edit / View Orders / Delete / …) has its
       own dedicated listener bound where it's rendered — never let that
       click also fall through to a containing clickable row below. */
    if (e.target.closest('button')) return;
    /* Dashboard Home rows + the Customers table row open the read-only
       preview (same as each table's View button) — same delegated
       listener, so this keeps working no matter how many times the
       page re-renders (auto-refresh included). */
    const orderRow = e.target.closest('[data-order-row]');
    if (orderRow) { openOrderView(orderRow.getAttribute('data-order-row')); return; }
    const custRow = e.target.closest('[data-customer-row]');
    if (custRow) { openCustomerView(custRow.getAttribute('data-customer-row')); }
  });
  /* Generic keyboard activation for every non-native clickable element
     (stat cards, table rows) marked up as role="button" — native
     <button>s already get this for free, this covers the rest. */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    /* e.target is the plain Document (no .closest()) when the key is
       pressed while nothing on the page has focus — guard against that
       instead of throwing on every such keypress. */
    if (!e.target || typeof e.target.closest !== 'function') return;
    const el = e.target.closest('[role="button"][tabindex]');
    if (!el) return;
    e.preventDefault();
    el.click();
  });
  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/admin/auth', { method: 'POST', body: { action: 'logout' } }); } catch (e) {}
    location.href = '/products';
  });
  $('#sideToggle').addEventListener('click', () => $('#adSide').classList.toggle('is-open'));
}
function wireTopbar() {
  /* #notifBellBtn / #profileBtn already carry [data-page] and are handled
     by the delegated listener above — only their extra side-effects live here. */
  $('#quickAddBtn').addEventListener('click', () => { setTimeout(() => { const b = $('#productAddBtn'); if (b) b.click(); }, 150); });
  $('#globalSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const term = e.target.value.trim();
    if (!term) return;
    location.hash = '#orders';
    setTimeout(() => { const s = $('#orderSearchInput'); if (s) { s.value = term; s.dispatchEvent(new Event('input')); } }, 150);
  });
}
function startClock() {
  const el = $('#adClock');
  const tick = () => { el.textContent = new Date().toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  tick(); setInterval(tick, 1000);
}
async function pollNotifBadge() {
  try {
    const data = await api('/api/admin/notifications');
    const n = data.unread || 0;
    [$('#navNotifBadge'), $('#bellBadge')].forEach(b => { if (b) { b.hidden = n === 0; b.classList.toggle('ad-hidden', n === 0); b.textContent = n > 9 ? '9+' : String(n); } });
  } catch (e) {}
}

const ROUTES = ['home', 'orders', 'customers', 'products', 'categories', 'quotes', 'notifications', 'audit', 'account'];
let homeRefreshTimer = null;

/* A route can carry filters as a query string appended to the hash
   itself, e.g. "#orders?status=pending" or "#products?lowStock=1" —
   this is how the Dashboard Home stat cards deep-link into a filtered
   view of another page while staying on the same hash-routing system
   (works with Back/Forward and refresh exactly like a plain route). */
function goTo(rawPage) {
  const parts = String(rawPage || '').split('?');
  let page = parts[0];
  const filters = parts[1] ? Object.fromEntries(new URLSearchParams(parts[1])) : {};
  if (!ROUTES.includes(page)) page = 'home';

  if (homeRefreshTimer) { clearInterval(homeRefreshTimer); homeRefreshTimer = null; }

  currentPage = page;
  $$('.ad-nav-item[data-page]').forEach(b => b.classList.toggle('is-active', b.getAttribute('data-page') === page));
  $('#adSide').classList.remove('is-open');
  const content = $('#adContent');
  content.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const renderers = {
    home: renderHome, orders: renderOrders, customers: renderCustomers, products: renderProducts,
    categories: renderCategories, quotes: renderQuotes, notifications: renderNotifications,
    audit: renderAudit, account: renderAccount,
  };
  renderers[page](filters).catch(err => {
    content.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">⚠️</div><p>' + esc(err.message) + '</p></div>';
  });
}

function renderComingSoon(name) {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-coming-soon"><div class="ad-coming-soon-icon"><i data-lucide="hammer"></i></div>' +
    '<h3>' + esc(name) + ' — Coming Soon</h3>' +
    '<p>This module is planned for a follow-up phase and isn\'t live yet. No dummy data is shown here on purpose.</p></div></div>';
  icons();
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD HOME
   ════════════════════════════════════════════════════════════════ */
const HOME_REFRESH_MS = 20000; // auto-refresh while Home is the active page

async function renderHome() {
  await loadHomeStats();
  /* Keep the widgets current without a manual browser refresh — cleared
     in goTo() the moment the admin navigates away from Home. */
  homeRefreshTimer = setInterval(() => { if (currentPage === 'home') loadHomeStats(true); }, HOME_REFRESH_MS);
}

async function loadHomeStats(isBackgroundRefresh) {
  let s;
  try { s = await api('/api/admin/dashboard-stats'); }
  catch (err) {
    if (!isBackgroundRefresh) $('#adContent').innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">⚠️</div><p>' + esc(err.message) + '</p></div>';
    return;
  }

  /* Each card is clickable (mouse + Enter/Space) and deep-links into the
     related page with its filter pre-applied — data-page carries the
     same "page?query" format the router already understands; Revenue
     routes into the Reports placeholder like the sidebar item does. */
  const statCard = (icon, num, label, color, nav) => {
    const navAttr = nav.soon ? ' data-soon="' + esc(nav.soon) + '"' : ' data-page="' + esc(nav.page) + '"';
    return '<div class="ad-stat" role="button" tabindex="0" aria-label="' + esc(label) + ': ' + esc(String(num)) + '"' + navAttr + '>' +
      '<div class="ad-stat-icon" style="background:rgba(255,255,255,0.06);color:' + color + '"><i data-lucide="' + icon + '"></i></div>' +
      '<div class="ad-stat-num">' + num + '</div><div class="ad-stat-lbl">' + esc(label) + '</div></div>';
  };

  const content = $('#adContent');
  content.innerHTML =
    '<div class="ad-page">' +
      '<div class="ad-page-head"><div><h1 class="ad-page-title">Dashboard</h1><p class="ad-page-sub">Live overview — ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</p></div></div>' +
      '<div class="ad-stats-grid">' +
        statCard('shopping-cart', s.todayOrders, "Today's Orders", '#22c4de', { page: 'orders?today=1' }) +
        statCard('clock', s.pending, 'Pending Orders', '#fbbf24', { page: 'orders?status=pending' }) +
        statCard('loader', s.processing, 'Processing', '#a78bfa', { page: 'orders?status=processing' }) +
        statCard('check-circle', s.completed, 'Completed', '#4ade80', { page: 'orders?status=completed' }) +
        statCard('x-circle', s.cancelled, 'Cancelled', '#f87171', { page: 'orders?status=cancelled' }) +
        statCard('banknote', money(s.revenue), 'Revenue (Completed)', '#4ade80', { soon: 'Reports' }) +
        statCard('file-text', s.quotesTotal + ' (' + s.quotesNew + ' new)', 'Quotes', '#60a5fa', { page: 'quotes' }) +
        statCard('package', s.productsTotal, 'Products', '#22c4de', { page: 'products' }) +
        statCard('users', s.customersTotal, 'Customers', '#a78bfa', { page: 'customers' }) +
        statCard('alert-triangle', s.lowStockCount, 'Low Stock', '#f87171', { page: 'products?lowStock=1' }) +
      '</div>' +
      '<div class="ad-form-grid">' +
        '<div class="ad-card"><div class="ad-card-title">Recent Orders<a href="#orders" class="ad-btn-sm">View all</a></div>' +
          '<div id="homeRecentOrders"></div></div>' +
        '<div class="ad-card"><div class="ad-card-title">Recent Customers<a href="#customers" class="ad-btn-sm">View all</a></div>' +
          '<div id="homeRecentCustomers"></div></div>' +
      '</div>' +
      (s.lowStock.length ? '<div class="ad-card"><div class="ad-card-title">Low Stock Alerts</div><div id="homeLowStock"></div></div>' : '') +
    '</div>';

  $('#homeRecentOrders').innerHTML = s.recentOrders.length
    ? s.recentOrders.map(o => rowLine(o.order_no || o.id.slice(0, 8), o.customer, money(o.grand_total), o.status, { orderId: o.id })).join('')
    : '<p class="ad-empty">No orders yet.</p>';
  $('#homeRecentCustomers').innerHTML = s.recentCustomers.length
    ? s.recentCustomers.map(c => rowLine(c.name, c.email, new Date(c.created_at).toLocaleDateString(), null, { customerId: c.id })).join('')
    : '<p class="ad-empty">No customers yet.</p>';
  const lowStockEl = $('#homeLowStock');
  if (lowStockEl) lowStockEl.innerHTML = s.lowStock.map(p => rowLine(p.name, 'Stock: ' + p.stock, 'Threshold ' + p.low_stock_threshold, 'cancelled')).join('');
  icons();
}
/* `link` is optional: { orderId } or { customerId } makes the whole row
   clickable/keyboard-activatable, opening the exact same detail modal as
   the table's "View" button — handled by the delegated listener in
   wireNav(), so this keeps working across every re-render (including
   the Home auto-refresh) with nothing extra to rebind. */
function rowLine(a, b, c, status, link) {
  const interactive = link && (link.orderId || link.customerId);
  const attrs = !interactive ? '' :
    ' role="button" tabindex="0" class="ad-row-clickable" aria-label="Open details for ' + esc(a) + '"' +
    (link.orderId ? ' data-order-row="' + esc(link.orderId) + '"' : ' data-customer-row="' + esc(link.customerId) + '"');
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--ad-border);font-size:13px"' + attrs + '>' +
    '<div><div style="font-weight:600">' + esc(a) + '</div><div style="color:var(--ad-text-50);font-size:12px">' + esc(b) + '</div></div>' +
    '<div style="display:flex;align-items:center;gap:8px">' + (status ? '<span class="ad-badge ad-badge--' + esc(status) + '">' + esc(status) + '</span>' : '') + '<span>' + esc(c) + '</span></div>' +
  '</div>';
}

/* ════════════════════════════════════════════════════════════════
   ORDERS
   ════════════════════════════════════════════════════════════════ */
const ORDER_STATUSES = ['pending','confirmed','processing','manufacturing','quality_check','packed','ready','shipped','out_for_delivery','delivered','completed','cancelled','returned','rejected'];
let ordersPage = 1, ordersStatus = 'all', ordersSearch = '', ordersToday = false;

async function renderOrders(filters) {
  filters = filters || {};
  ordersStatus = ORDER_STATUSES.includes(filters.status) ? filters.status : 'all';
  ordersToday = filters.today === '1';
  ordersSearch = ''; ordersPage = 1;

  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">Orders' + (ordersToday ? ' — Today' : '') + '</h1></div>' +
    '<div class="ad-toolbar">' +
      '<input class="ad-input" id="orderSearchInput" type="search" placeholder="Search order # / customer…">' +
      '<select class="ad-select" id="orderStatusFilter"><option value="all">All statuses</option>' +
        ORDER_STATUSES.map(s => '<option value="' + s + '"' + (s === ordersStatus ? ' selected' : '') + '>' + label(s) + '</option>').join('') +
      '</select>' +
    '</div>' +
    '<div id="ordersTableWrap"></div></div>';

  $('#orderSearchInput').addEventListener('input', debounce(e => { ordersSearch = e.target.value; ordersPage = 1; loadOrdersTable(); }, 350));
  $('#orderStatusFilter').addEventListener('change', e => { ordersStatus = e.target.value; ordersPage = 1; loadOrdersTable(); });
  await loadOrdersTable();
}
function label(s) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function loadOrdersTable() {
  const wrap = $('#ordersTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: ordersPage, pageSize: 15, status: ordersStatus, search: ordersSearch });
  if (ordersToday) q.set('today', '1');
  const data = await api('/api/admin/orders?' + q.toString());
  if (!data.orders.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">📦</div>No orders found.</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Order #</th><th>Customer</th><th>Email</th><th>Items</th><th>Total</th><th>Status</th><th>Payment</th><th>Date</th><th>Actions</th></tr></thead><tbody>' +
    data.orders.map(o => {
      const name = o.guest_name || o.customer_name || (o.user_id ? 'Registered customer' : 'Guest');
      const email = o.guest_email || o.customer_email || '—';
      return '<tr><td>' + esc(o.order_no || o.id.slice(0, 8)) + '</td>' +
      '<td>' + esc(name) + '</td>' +
      '<td>' + esc(email) + '</td>' +
      '<td>' + (o.items ? o.items.length : 0) + '</td>' +
      '<td>' + money(o.grand_total) + '</td>' +
      '<td><span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span></td>' +
      '<td><span class="ad-badge ad-badge--' + esc(o.payment_status || 'pending') + '">' + label(o.payment_status || 'pending') + '</span></td>' +
      '<td>' + new Date(o.created_at).toLocaleDateString() + '</td>' +
      '<td class="ad-actions-row">' +
        '<button class="ad-btn-sm ad-btn-sm--primary" data-view="' + o.id + '">View</button>' +
        '<button class="ad-btn-sm" data-edit-order="' + o.id + '">Edit</button>' +
      '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    pagination(ordersPage, data.total, 15, p => { ordersPage = p; loadOrdersTable(); });
  $$('[data-view]', wrap).forEach(b => b.addEventListener('click', () => openOrderView(b.getAttribute('data-view'))));
  $$('[data-edit-order]', wrap).forEach(b => b.addEventListener('click', () => openOrderDetail(b.getAttribute('data-edit-order'))));
}

function pagination(page, total, pageSize, onChange) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return '';
  const id = 'pg-' + Math.random().toString(36).slice(2);
  setTimeout(() => {
    const prev = $('#' + id + '-prev'), next = $('#' + id + '-next');
    if (prev) prev.addEventListener('click', () => onChange(page - 1));
    if (next) next.addEventListener('click', () => onChange(page + 1));
  }, 0);
  return '<div class="ad-pagination">' +
    '<button class="ad-btn-sm" id="' + id + '-prev"' + (page <= 1 ? ' disabled' : '') + '>Previous</button>' +
    '<span>Page ' + page + ' of ' + totalPages + ' (' + total + ' total)</span>' +
    '<button class="ad-btn-sm" id="' + id + '-next"' + (page >= totalPages ? ' disabled' : '') + '>Next</button>' +
  '</div>';
}

/* Read-only order preview — everything below comes from the order row
   plus the product records the API joined onto each item. No inputs,
   no save; editing lives in openOrderDetail (the Edit button). */
async function openOrderView(id) {
  const data = await api('/api/admin/orders?id=' + id);
  const o = data.order;
  const custName = o.guest_name || o.customer_name || (o.user_id ? 'Registered customer' : 'Guest');
  const items = o.items || [];
  const statusIdx = ORDER_STATUSES.indexOf(o.status);
  const cancelled = ['cancelled', 'returned', 'rejected'].includes(o.status);
  const timeline = '<div class="ad-timeline">' + ORDER_STATUSES.slice(0, 11).map(s => {
    const done = ORDER_STATUSES.indexOf(s) <= statusIdx && statusIdx !== -1 && !cancelled;
    return '<div class="ad-timeline-step' + (done ? ' is-done' : '') + '"><div class="ad-timeline-dot">' + (done ? '✓' : '') + '</div><div class="ad-timeline-label">' + label(s) + '</div></div>';
  }).join('') + '</div>';

  openModal(
    '<h3 class="ad-modal-title">Order ' + esc(o.order_no || o.id.slice(0, 8)) + ' &nbsp;' +
      '<span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span> ' +
      '<span class="ad-badge ad-badge--' + esc(o.payment_status || 'pending') + '">' + label(o.payment_status || 'pending') + '</span></h3>' +

    '<div class="ad-card-title">Products (' + items.length + ')</div>' +
    (items.length ? items.map(orderItemCard).join('') : '<p class="ad-empty">No item details stored on this order.</p>') +

    '<div class="ad-card-title" style="margin-top:16px">Customer</div>' +
    infoGrid([
      ['Name', esc(custName)],
      ['Email', esc(o.guest_email || o.customer_email || '')],
      ['Phone', esc(o.guest_phone || '')],
      ['Company', esc(o.guest_company || '')],
      ['Delivery Address', esc(o.delivery_address || '')],
    ]) +

    '<div class="ad-card-title" style="margin-top:16px">Order Information</div>' +
    infoGrid([
      ['Order ID', esc(o.order_no || o.id)],
      ['Date', esc(new Date(o.created_at).toLocaleString())],
      ['Order Status', '<span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span>'],
      ['Payment Status', '<span class="ad-badge ad-badge--' + esc(o.payment_status || 'pending') + '">' + label(o.payment_status || 'pending') + '</span>'],
      ['Current Stage', esc(o.current_stage || '')],
      ['Tracking', (o.tracking_pct || 0) + '%'],
      ['Est. Completion', esc(o.estimated_completion || '')],
      ['Est. Delivery', esc(o.estimated_delivery || '')],
      ['Tracking Number', esc(o.tracking_number || '')],
      ['Courier', esc(o.courier || '')],
      ['Notes', esc(o.admin_notes || '')],
    ]) +
    timeline +

    '<div class="ad-card-title" style="margin-top:16px">Totals</div>' +
    infoGrid([
      ['Subtotal', money(o.subtotal)],
      ['VAT (15%)', money(o.vat)],
      ['Shipping', o.shipping_cost != null ? money(o.shipping_cost) : ''],
      ['Discount', o.discount != null ? money(o.discount) : ''],
      ['Grand Total', '<strong style="color:var(--ad-teal-2)">' + money(o.grand_total) + '</strong>'],
    ]),
    true
  );
  icons();
}

async function openOrderDetail(id) {
  const data = await api('/api/admin/orders?id=' + id);
  const o = data.order;
  const items = o.items || [];
  openModal(
    '<h3 class="ad-modal-title">Edit Order ' + esc(o.order_no || o.id.slice(0, 8)) + '</h3>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;font-size:13px;color:var(--ad-text-70)">' +
      '<div><strong>Customer:</strong> ' + esc(o.guest_name || o.customer_name || (o.user_id ? 'Registered customer' : 'Guest')) + '</div>' +
      '<div><strong>Email:</strong> ' + esc(o.guest_email || o.customer_email || '—') + '</div>' +
      (o.guest_phone ? '<div><strong>Phone:</strong> ' + esc(o.guest_phone) + '</div>' : '') +
    '</div>' +
    '<div class="ad-timeline">' + ORDER_STATUSES.slice(0, 11).map(s => {
      const idx = ORDER_STATUSES.indexOf(o.status);
      const done = ORDER_STATUSES.indexOf(s) <= idx && idx !== -1 && !['cancelled','returned','rejected'].includes(o.status);
      return '<div class="ad-timeline-step' + (done ? ' is-done' : '') + '"><div class="ad-timeline-dot">' + (done ? '✓' : '') + '</div><div class="ad-timeline-label">' + label(s) + '</div></div>';
    }).join('') + '</div>' +
    '<div class="ad-form-grid">' +
      '<div class="ad-field"><label class="ad-label">Order Status</label><select class="ad-input ad-select" id="ordStatus">' +
        ORDER_STATUSES.map(s => '<option value="' + s + '"' + (s === o.status ? ' selected' : '') + '>' + label(s) + '</option>').join('') + '</select></div>' +
      '<div class="ad-field"><label class="ad-label">Payment Status</label><select class="ad-input ad-select" id="ordPayment">' +
        ['pending','paid','failed','refunded'].map(s => '<option value="' + s + '"' + (s === (o.payment_status || 'pending') ? ' selected' : '') + '>' + label(s) + '</option>').join('') + '</select></div>' +
      '<div class="ad-field"><label class="ad-label">Tracking %</label><input class="ad-input" id="ordPct" type="number" min="0" max="100" value="' + (o.tracking_pct || 0) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Current Stage</label><input class="ad-input" id="ordStage" value="' + esc(o.current_stage || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Est. Completion</label><input class="ad-input" id="ordEstComplete" type="date" value="' + (o.estimated_completion || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Delivery Date</label><input class="ad-input" id="ordEstDeliver" type="date" value="' + (o.estimated_delivery || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Tracking Number</label><input class="ad-input" id="ordTracking" value="' + esc(o.tracking_number || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Courier</label><input class="ad-input" id="ordCourier" value="' + esc(o.courier || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Discount</label><input class="ad-input" id="ordDiscount" type="number" min="0" step="0.01" value="' + (o.discount || 0) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Shipping Cost</label><input class="ad-input" id="ordShipping" type="number" min="0" step="0.01" value="' + (o.shipping_cost || 0) + '"></div>' +
    '</div>' +
    '<div class="ad-field"><label class="ad-label">Customer / Delivery Address</label><textarea class="ad-input ad-textarea" id="ordAddress">' + esc(o.delivery_address || '') + '</textarea></div>' +
    '<div class="ad-field"><label class="ad-label">Admin Notes</label><textarea class="ad-input ad-textarea" id="ordNotes">' + esc(o.admin_notes || '') + '</textarea></div>' +
    '<div class="ad-card-title" style="margin-top:14px">Items</div>' +
    (items.length ? '<div class="ad-form-grid" id="ordItemsGrid">' + items.map((it, i) => (
      '<div class="ad-field" style="grid-column:1/-1;display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;border-bottom:1px solid var(--ad-border);padding-bottom:10px">' +
        '<div style="flex:1 1 200px"><label class="ad-label">' + esc(it.name) + '</label></div>' +
        '<div style="width:100px"><label class="ad-label">Qty</label><input class="ad-input ad-item-qty" type="number" min="1" value="' + (Number(it.qty) || 1) + '" data-idx="' + i + '"></div>' +
        '<div style="width:140px"><label class="ad-label">Unit Price</label><input class="ad-input ad-item-price" type="number" min="0" step="0.01" value="' + (Number(it.price) || 0) + '" data-idx="' + i + '"></div>' +
      '</div>'
    )).join('') + '</div>' : '<p class="ad-empty">No item details.</p>') +
    '<div style="text-align:end;font-size:15px;margin-top:10px">Current Total: <strong>' + money(o.grand_total) + '</strong></div>' +
    '<div class="ad-form-actions"><button class="ad-btn-sm ad-btn-sm--primary" id="ordSaveBtn">Save Changes</button></div>',
    true
  );
  $('#ordSaveBtn').addEventListener('click', async () => {
    const btn = $('#ordSaveBtn'); btn.disabled = true;
    try {
      const newItems = items.map((it, i) => {
        const qtyEl = $('.ad-item-qty[data-idx="' + i + '"]');
        const priceEl = $('.ad-item-price[data-idx="' + i + '"]');
        return { name: it.name, qty: qtyEl ? Number(qtyEl.value) || 1 : it.qty, price: priceEl ? Number(priceEl.value) || 0 : it.price };
      });
      await api('/api/admin/orders?id=' + o.id, { method: 'PATCH', body: {
        status: $('#ordStatus').value, payment_status: $('#ordPayment').value,
        tracking_pct: Number($('#ordPct').value) || 0, current_stage: $('#ordStage').value,
        estimated_completion: $('#ordEstComplete').value || null, estimated_delivery: $('#ordEstDeliver').value || null,
        tracking_number: $('#ordTracking').value, courier: $('#ordCourier').value,
        discount: Number($('#ordDiscount').value) || 0, shipping_cost: Number($('#ordShipping').value) || 0,
        delivery_address: $('#ordAddress').value, admin_notes: $('#ordNotes').value,
        items: items.length ? newItems : undefined,
      }});
      toast('Order updated — synced to the customer dashboard.');
      closeModal();
      /* This modal can be opened from the Orders page OR from a customer's
         order history — only refresh whichever table is actually on screen. */
      if ($('#ordersTableWrap')) loadOrdersTable();
      else if ($('#custTableWrap')) loadCustomersTable();
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  });
}

/* ════════════════════════════════════════════════════════════════
   CUSTOMERS
   ════════════════════════════════════════════════════════════════ */
let customersPage = 1, customersSearch = '';
async function renderCustomers() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">Customers</h1></div>' +
    '<div class="ad-toolbar"><input class="ad-input" id="custSearchInput" type="search" placeholder="Search name, company, email…"></div>' +
    '<div id="custTableWrap"></div></div>';
  $('#custSearchInput').addEventListener('input', debounce(e => { customersSearch = e.target.value; customersPage = 1; loadCustomersTable(); }, 350));
  await loadCustomersTable();
}
async function loadCustomersTable() {
  const wrap = $('#custTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: customersPage, pageSize: 15, search: customersSearch });
  const data = await api('/api/admin/customers?' + q.toString());
  if (!data.customers.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">👤</div>No customers found.</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Status</th><th>Joined</th><th>Order Details</th><th>Actions</th></tr></thead><tbody>' +
    data.customers.map(c => (
      '<tr data-customer-row="' + c.id + '" role="button" tabindex="0">' +
      '<td>' + esc(c.name) + (c.company ? '<br><span style="color:var(--ad-text-35);font-size:11px">' + esc(c.company) + '</span>' : '') + '</td>' +
      '<td>' + esc(c.email) + '</td><td>' + esc(c.phone || '—') + '</td>' +
      '<td>' + c.orders_count + ' Order' + (c.orders_count === 1 ? '' : 's') + '</td>' +
      '<td><span class="ad-badge ad-badge--' + (c.is_banned ? 'suspended' : 'active') + '">' + (c.is_banned ? 'Disabled' : 'Active') + '</span></td>' +
      '<td>' + new Date(c.created_at).toLocaleDateString() + '</td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm ad-btn-sm--primary" data-view-orders="' + c.id + '">View Orders</button></td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm" data-edit-cust="' + c.id + '">Edit</button></td>' +
      '</tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(customersPage, data.total, 15, p => { customersPage = p; loadCustomersTable(); });
  $$('[data-view-orders]', wrap).forEach(b => b.addEventListener('click', () => openCustomerOrders(b.getAttribute('data-view-orders'))));
  $$('[data-edit-cust]', wrap).forEach(b => b.addEventListener('click', () => openCustomerDetail(b.getAttribute('data-edit-cust'))));
}
/* One order as a card: head (order#, date, status/payment badges, total)
   + its items as product cards + a View/Edit button pair. Shared by the
   read-only Customer Details view and the "View Orders" page so the
   markup and wiring never drift apart. */
function orderHistoryBlock(o) {
  return '<div class="ad-ov-order">' +
    '<div class="ad-ov-order-head">' +
      '<strong>' + esc(o.order_no || o.id.slice(0, 8)) + '</strong>' +
      '<span style="color:var(--ad-text-50)">' + new Date(o.created_at).toLocaleDateString() + '</span>' +
      '<span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span>' +
      '<span class="ad-badge ad-badge--' + esc(o.payment_status || 'pending') + '">' + label(o.payment_status || 'pending') + '</span>' +
      '<span style="margin-inline-start:auto;font-weight:700">' + money(o.grand_total) + '</span>' +
    '</div>' +
    ((o.items || []).length ? o.items.map(orderItemCard).join('') : '<p class="ad-empty" style="padding:14px">No item details stored.</p>') +
    '<div class="ad-actions-row" style="padding:10px 0 0">' +
      '<button class="ad-btn-sm ad-btn-sm--primary" data-view="' + o.id + '">View</button>' +
      '<button class="ad-btn-sm" data-edit-order="' + o.id + '">Edit</button>' +
    '</div>' +
  '</div>';
}
function wireOrderHistoryButtons(scope) {
  $$('[data-view]', scope).forEach(b => b.addEventListener('click', () => openOrderView(b.getAttribute('data-view'))));
  $$('[data-edit-order]', scope).forEach(b => b.addEventListener('click', () => openOrderDetail(b.getAttribute('data-edit-order'))));
}

/* Read-only customer profile with full order history — each order shows
   its items as product cards (image/description/specs from the joined
   product records) plus View/Edit buttons. Editing customer info itself
   happens in openCustomerDetail (the Edit button). */
async function openCustomerView(id) {
  const data = await api('/api/admin/customers?id=' + id);
  const c = data.customer;
  openModal(
    '<h3 class="ad-modal-title">' + esc(c.full_name || c.email) + ' &nbsp;' +
      '<span class="ad-badge ad-badge--' + (c.is_banned ? 'suspended' : 'active') + '">' + (c.is_banned ? 'Disabled' : 'Active') + '</span></h3>' +

    '<div class="ad-card-title">Customer Information</div>' +
    infoGrid([
      ['Full Name', esc(c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' '))],
      ['Email', esc(c.email) + (c.email_verified ? ' <span class="ad-badge ad-badge--active">Verified</span>' : ' <span class="ad-badge ad-badge--pending">Unverified</span>')],
      ['Phone', esc(c.mobile || '')],
      ['Company', esc(c.company || '')],
      ['Country', esc(c.country || '')],
      ['Address', esc([c.address, c.city, c.postal_code].filter(Boolean).join(', '))],
      ['Registered', esc(new Date(c.created_at).toLocaleDateString())],
      ['Last Login', c.last_login ? esc(new Date(c.last_login).toLocaleString()) : ''],
      ['Status', '<span class="ad-badge ad-badge--' + (c.is_banned ? 'suspended' : 'active') + '">' + (c.is_banned ? 'Disabled' : 'Active') + '</span>'],
    ]) +

    '<div class="ad-card-title" style="margin-top:16px">Order History (' + data.orders.length + ')</div>' +
    (data.orders.length ? data.orders.map(orderHistoryBlock).join('') : '<p class="ad-empty">No orders yet.</p>'),
    true
  );
  icons();
  wireOrderHistoryButtons($('#adModalBody'));
}

/* "View Orders" page — lighter header (name/email/phone only) + the
   customer's full order history, each card with View/Edit buttons.
   Reached from the Customers table's "Order Details" column. */
async function openCustomerOrders(id) {
  const data = await api('/api/admin/customers?id=' + id);
  const c = data.customer;
  openModal(
    '<h3 class="ad-modal-title">Orders — ' + esc(c.full_name || c.email) + '</h3>' +
    infoGrid([
      ['Name', esc(c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' '))],
      ['Email', esc(c.email)],
      ['Phone', esc(c.mobile || '')],
    ]) +
    '<div class="ad-card-title" style="margin-top:16px">Orders (' + data.orders.length + ')</div>' +
    (data.orders.length ? data.orders.map(orderHistoryBlock).join('') : '<p class="ad-empty">No orders yet.</p>'),
    true
  );
  icons();
  wireOrderHistoryButtons($('#adModalBody'));
}

/* Edit ONLY the customer's own information — no orders/addresses shown
   here (those live in openCustomerOrders / the "View Orders" button). */
async function openCustomerDetail(id) {
  const data = await api('/api/admin/customers?id=' + id);
  const c = data.customer;
  openModal(
    '<h3 class="ad-modal-title">Edit Customer — ' + esc(c.full_name || c.email) + '</h3>' +
    '<div class="ad-form-grid">' +
      '<div class="ad-field"><label class="ad-label">First Name</label><input class="ad-input" id="custFirstName" value="' + esc(c.first_name || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Last Name</label><input class="ad-input" id="custLastName" value="' + esc(c.last_name || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Email</label><input class="ad-input" id="custEmailInput" type="email" value="' + esc(c.email || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Phone</label><input class="ad-input" id="custPhone" value="' + esc(c.mobile || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Company</label><input class="ad-input" id="custCompany" value="' + esc(c.company || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Country</label><input class="ad-input" id="custCountry" value="' + esc(c.country || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Status</label><select class="ad-input ad-select" id="custStatus">' +
        '<option value="active"' + (!c.is_banned ? ' selected' : '') + '>Active</option>' +
        '<option value="suspended"' + (c.is_banned ? ' selected' : '') + '>Disabled</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="ad-field"><label class="ad-label">Address</label><textarea class="ad-input ad-textarea" id="custAddress">' + esc(c.address || '') + '</textarea></div>' +
    '<div class="ad-field"><label class="ad-label">Notes</label><textarea class="ad-input ad-textarea" id="custNotes">' + esc(c.notes || '') + '</textarea></div>' +
    '<div class="ad-form-actions" style="margin-top:16px;flex-wrap:wrap">' +
      '<button class="ad-btn-sm ad-btn-sm--primary" id="custSaveBtn">Save Changes</button>' +
      '<button class="ad-btn-sm" id="custResetPw">Reset Password</button>' +
      '<button class="ad-btn-sm" id="custEmail">Email Customer</button>' +
      '<button class="ad-btn-sm ad-btn-sm--danger" id="custDelete">Delete Account</button>' +
    '</div>',
    true
  );
  $('#custSaveBtn').addEventListener('click', async () => {
    const btn = $('#custSaveBtn'); btn.disabled = true;
    try {
      const wasBanned = c.is_banned;
      const nowBanned = $('#custStatus').value === 'suspended';
      const body = {
        first_name: $('#custFirstName').value, last_name: $('#custLastName').value,
        company: $('#custCompany').value, mobile: $('#custPhone').value,
        country: $('#custCountry').value, address: $('#custAddress').value,
        email: $('#custEmailInput').value, notes: $('#custNotes').value,
      };
      if (nowBanned !== wasBanned) body.disabled = nowBanned;
      await api('/api/admin/customers?id=' + c.id, { method: 'PATCH', body });
      toast('Customer updated.');
      closeModal();
      loadCustomersTable();
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  });
  $('#custResetPw').addEventListener('click', async () => {
    try { await api('/api/admin/customers', { method: 'POST', body: { action: 'reset-password', id: c.id } }); toast('Password reset email sent.'); }
    catch (err) { toast(err.message); }
  });
  $('#custEmail').addEventListener('click', () => {
    openModal(
      '<h3 class="ad-modal-title">Email ' + esc(c.email) + '</h3>' +
      '<div class="ad-field"><label class="ad-label">Subject</label><input class="ad-input" id="emailSubject"></div>' +
      '<div class="ad-field"><label class="ad-label">Message</label><textarea class="ad-input ad-textarea" id="emailMessage"></textarea></div>' +
      '<div class="ad-form-actions"><button class="ad-btn-sm ad-btn-sm--primary" id="emailSendBtn">Send</button></div>'
    );
    $('#emailSendBtn').addEventListener('click', async () => {
      try {
        await api('/api/admin/customers', { method: 'POST', body: { action: 'email-customer', id: c.id, subject: $('#emailSubject').value, message: $('#emailMessage').value } });
        toast('Email sent.'); closeModal();
      } catch (err) { toast(err.message); }
    });
  });
  $('#custDelete').addEventListener('click', async () => {
    if (!confirm('Permanently delete this customer account? This cannot be undone.')) return;
    try { await api('/api/admin/customers?id=' + c.id, { method: 'DELETE' }); toast('Customer deleted.'); closeModal(); loadCustomersTable(); }
    catch (err) { toast(err.message); }
  });
}

/* ════════════════════════════════════════════════════════════════
   PRODUCTS
   ════════════════════════════════════════════════════════════════ */
let productsPage = 1, productsSearch = '', productsLowStock = false, CATEGORY_CACHE = [];
async function renderProducts(filters) {
  filters = filters || {};
  productsLowStock = filters.lowStock === '1';
  productsSearch = ''; productsPage = 1;

  const catData = await api('/api/admin/categories');
  CATEGORY_CACHE = catData.categories;
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">Products' + (productsLowStock ? ' — Low Stock' : '') + '</h1>' +
      '<button class="ad-btn-sm ad-btn-sm--primary" id="productAddBtn"><i data-lucide="plus"></i> Add Product</button></div>' +
    '<div class="ad-toolbar"><input class="ad-input" id="prodSearchInput" type="search" placeholder="Search products…"></div>' +
    '<div id="prodTableWrap"></div></div>';
  icons();
  $('#prodSearchInput').addEventListener('input', debounce(e => { productsSearch = e.target.value; productsPage = 1; loadProductsTable(); }, 350));
  $('#productAddBtn').addEventListener('click', () => openProductEditor(null));
  await loadProductsTable();
}
async function loadProductsTable() {
  const wrap = $('#prodTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: productsPage, pageSize: 15, search: productsSearch });
  if (productsLowStock) q.set('lowStock', '1');
  const data = await api('/api/admin/products?' + q.toString());
  if (!data.products.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">📦</div>No products found.</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
    data.products.map(p => (
      '<tr><td>' + esc(p.name) + (p.is_featured ? ' ⭐' : '') + '</td>' +
      '<td>' + esc(catName(p.category_slug)) + '</td><td>' + money(p.price) + '</td>' +
      '<td>' + p.stock + (p.stock <= (p.low_stock_threshold || 5) ? ' ⚠️' : '') + '</td>' +
      '<td><span class="ad-badge ad-badge--' + (p.is_active ? 'active' : 'suspended') + '">' + (p.is_active ? 'Active' : 'Hidden') + '</span></td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm" data-edit="' + p.id + '">Edit</button><button class="ad-btn-sm ad-btn-sm--danger" data-del="' + p.id + '">Delete</button></td></tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(productsPage, data.total, 15, p => { productsPage = p; loadProductsTable(); });
  $$('[data-edit]', wrap).forEach(b => b.addEventListener('click', async () => {
    const d = await api('/api/admin/products?id=' + b.getAttribute('data-edit'));
    openProductEditor(d.product);
  }));
  $$('[data-del]', wrap).forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this product?')) return;
    try { await api('/api/admin/products?id=' + b.getAttribute('data-del'), { method: 'DELETE' }); toast('Product deleted.'); loadProductsTable(); }
    catch (err) { toast(err.message); }
  }));
}
function catName(slug) { const c = CATEGORY_CACHE.find(x => x.slug === slug); return c ? c.name : (slug || '—'); }

function openProductEditor(p) {
  const isEdit = !!p;
  p = p || { id: '', category_slug: '', name: '', name_ar: '', description: '', price: 0, stock: 0, is_featured: false, is_active: true, images: [] };
  openModal(
    '<h3 class="ad-modal-title">' + (isEdit ? 'Edit Product' : 'Add Product') + '</h3>' +
    '<div class="ad-form-grid">' +
      (isEdit ? '' : '<div class="ad-field"><label class="ad-label">ID (numeric)</label><input class="ad-input" id="pfId" type="number" value="' + esc(p.id) + '"></div>') +
      '<div class="ad-field"><label class="ad-label">Category</label><select class="ad-input ad-select" id="pfCat"><option value="">—</option>' +
        CATEGORY_CACHE.map(c => '<option value="' + c.slug + '"' + (c.slug === p.category_slug ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' +
      '<div class="ad-field"><label class="ad-label">Name (EN)</label><input class="ad-input" id="pfName" value="' + esc(p.name) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Name (AR)</label><input class="ad-input" id="pfNameAr" value="' + esc(p.name_ar || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Price (SAR)</label><input class="ad-input" id="pfPrice" type="number" step="0.01" value="' + esc(p.price) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Stock</label><input class="ad-input" id="pfStock" type="number" value="' + esc(p.stock) + '"></div>' +
    '</div>' +
    '<div class="ad-field"><label class="ad-label">Description (EN)</label><textarea class="ad-input ad-textarea" id="pfDesc">' + esc(p.description || '') + '</textarea></div>' +
    '<div class="ad-field"><label class="ad-label">Image URLs (one per line)</label><textarea class="ad-input ad-textarea" id="pfImages">' + esc((p.images || []).join('\n')) + '</textarea></div>' +
    '<label class="ad-check"><input type="checkbox" id="pfFeatured"' + (p.is_featured ? ' checked' : '') + '> Featured</label>' +
    '&nbsp;&nbsp;<label class="ad-check"><input type="checkbox" id="pfActive"' + (p.is_active !== false ? ' checked' : '') + '> Active (visible)</label>' +
    '<div class="ad-form-actions" style="margin-top:14px"><button class="ad-btn-sm ad-btn-sm--primary" id="pfSaveBtn">Save</button></div>',
    true
  );
  $('#pfSaveBtn').addEventListener('click', async () => {
    const fields = {
      category_slug: $('#pfCat').value || null,
      name: $('#pfName').value.trim(),
      name_ar: $('#pfNameAr').value.trim() || null,
      price: Number($('#pfPrice').value) || 0,
      stock: Number($('#pfStock').value) || 0,
      description: $('#pfDesc').value.trim() || null,
      images: $('#pfImages').value.split('\n').map(s => s.trim()).filter(Boolean),
      is_featured: $('#pfFeatured').checked,
      is_active: $('#pfActive').checked,
    };
    if (!fields.name) return toast('Name is required.');
    try {
      if (isEdit) await api('/api/admin/products?id=' + p.id, { method: 'PATCH', body: fields });
      else {
        const id = Number($('#pfId').value);
        if (!id) return toast('A numeric ID is required for new products.');
        await api('/api/admin/products', { method: 'POST', body: Object.assign({ id }, fields) });
      }
      toast('Product saved.'); closeModal(); loadProductsTable();
    } catch (err) { toast(err.message); }
  });
}

/* ════════════════════════════════════════════════════════════════
   CATEGORIES
   ════════════════════════════════════════════════════════════════ */
async function renderCategories() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">Categories</h1>' +
    '<button class="ad-btn-sm ad-btn-sm--primary" id="catAddBtn"><i data-lucide="plus"></i> Add Category</button></div>' +
    '<div id="catTableWrap"></div></div>';
  icons();
  $('#catAddBtn').addEventListener('click', () => openCategoryEditor(null));
  await loadCategoriesTable();
}
async function loadCategoriesTable() {
  const data = await api('/api/admin/categories');
  CATEGORY_CACHE = data.categories;
  const wrap = $('#catTableWrap');
  if (!data.categories.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">🗂️</div>No categories yet.</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Name</th><th>Slug</th><th>Sort</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
    data.categories.map(c => (
      '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.slug) + '</td><td>' + c.sort_order + '</td>' +
      '<td><span class="ad-badge ad-badge--' + (c.is_active ? 'active' : 'suspended') + '">' + (c.is_active ? 'Active' : 'Hidden') + '</span></td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm" data-edit="' + c.id + '">Edit</button><button class="ad-btn-sm ad-btn-sm--danger" data-del="' + c.id + '">Delete</button></td></tr>'
    )).join('') + '</tbody></table></div>';
  $$('[data-edit]', wrap).forEach(b => b.addEventListener('click', () => openCategoryEditor(data.categories.find(c => c.id === b.getAttribute('data-edit')))));
  $$('[data-del]', wrap).forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this category?')) return;
    try { await api('/api/admin/categories?id=' + b.getAttribute('data-del'), { method: 'DELETE' }); toast('Deleted.'); loadCategoriesTable(); }
    catch (err) { toast(err.message); }
  }));
}
function openCategoryEditor(c) {
  const isEdit = !!c;
  c = c || { slug: '', name: '', name_ar: '', sort_order: 0, is_active: true };
  openModal(
    '<h3 class="ad-modal-title">' + (isEdit ? 'Edit Category' : 'Add Category') + '</h3>' +
    '<div class="ad-form-grid">' +
      '<div class="ad-field"><label class="ad-label">Slug</label><input class="ad-input" id="cfSlug" value="' + esc(c.slug) + '"' + (isEdit ? ' disabled' : '') + '></div>' +
      '<div class="ad-field"><label class="ad-label">Sort Order</label><input class="ad-input" id="cfSort" type="number" value="' + esc(c.sort_order) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Name (EN)</label><input class="ad-input" id="cfName" value="' + esc(c.name) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Name (AR)</label><input class="ad-input" id="cfNameAr" value="' + esc(c.name_ar || '') + '"></div>' +
    '</div>' +
    '<label class="ad-check"><input type="checkbox" id="cfActive"' + (c.is_active !== false ? ' checked' : '') + '> Active</label>' +
    '<div class="ad-form-actions" style="margin-top:14px"><button class="ad-btn-sm ad-btn-sm--primary" id="cfSaveBtn">Save</button></div>'
  );
  $('#cfSaveBtn').addEventListener('click', async () => {
    const fields = { name: $('#cfName').value.trim(), name_ar: $('#cfNameAr').value.trim() || null, sort_order: Number($('#cfSort').value) || 0, is_active: $('#cfActive').checked };
    if (!isEdit) fields.slug = $('#cfSlug').value.trim();
    if (!fields.name || (!isEdit && !fields.slug)) return toast('Name and slug are required.');
    try {
      if (isEdit) await api('/api/admin/categories?id=' + c.id, { method: 'PATCH', body: fields });
      else await api('/api/admin/categories', { method: 'POST', body: fields });
      toast('Category saved.'); closeModal(); loadCategoriesTable();
    } catch (err) { toast(err.message); }
  });
}

/* ════════════════════════════════════════════════════════════════
   QUOTES
   ════════════════════════════════════════════════════════════════ */
let quotesPage = 1, quotesStatus = 'all';
async function renderQuotes() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">Quotes</h1></div>' +
    '<div class="ad-toolbar"><select class="ad-select" id="quoteStatusFilter"><option value="all">All</option>' +
      ['new','contacted','quoted','converted','closed'].map(s => '<option value="' + s + '">' + label(s) + '</option>').join('') + '</select></div>' +
    '<div id="quoteTableWrap"></div></div>';
  $('#quoteStatusFilter').addEventListener('change', e => { quotesStatus = e.target.value; quotesPage = 1; loadQuotesTable(); });
  await loadQuotesTable();
}
async function loadQuotesTable() {
  const wrap = $('#quoteTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const q = new URLSearchParams({ page: quotesPage, pageSize: 15, status: quotesStatus });
  const data = await api('/api/admin/quotes?' + q.toString());
  if (!data.quotes.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">📝</div>No quotes yet.</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Name</th><th>Contact</th><th>Product/Service</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>' +
    data.quotes.map(q => (
      '<tr><td>' + esc(q.name || '—') + '</td><td>' + esc(q.email || q.phone || '—') + '</td><td>' + esc(q.product || '—') + '</td>' +
      '<td><span class="ad-badge ad-badge--' + esc(q.status) + '">' + label(q.status) + '</span></td>' +
      '<td>' + new Date(q.created_at).toLocaleDateString() + '</td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm" data-view="' + q.id + '">View</button></td></tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(quotesPage, data.total, 15, p => { quotesPage = p; loadQuotesTable(); });
  $$('[data-view]', wrap).forEach(b => b.addEventListener('click', () => openQuoteDetail(b.getAttribute('data-view'))));
}
async function openQuoteDetail(id) {
  const data = await api('/api/admin/quotes?id=' + id);
  const q = data.quote;
  openModal(
    '<h3 class="ad-modal-title">Quote from ' + esc(q.name || q.email || 'Unknown') + '</h3>' +
    '<div style="font-size:13px;color:var(--ad-text-70);margin-bottom:14px">' +
      '<div><strong>Email:</strong> ' + esc(q.email || '—') + '</div><div><strong>Phone:</strong> ' + esc(q.phone || '—') + '</div>' +
      '<div><strong>Product/Service:</strong> ' + esc(q.product || '—') + '</div>' +
      '<div style="margin-top:8px"><strong>Message:</strong><br>' + esc(q.message || '—') + '</div>' +
    '</div>' +
    '<div class="ad-field"><label class="ad-label">Status</label><select class="ad-input ad-select" id="qStatus">' +
      ['new','contacted','quoted','converted','closed'].map(s => '<option value="' + s + '"' + (s === q.status ? ' selected' : '') + '>' + label(s) + '</option>').join('') + '</select></div>' +
    '<div class="ad-field"><label class="ad-label">Admin Notes</label><textarea class="ad-input ad-textarea" id="qNotes">' + esc(q.admin_notes || '') + '</textarea></div>' +
    '<div class="ad-form-actions">' +
      '<button class="ad-btn-sm ad-btn-sm--primary" id="qSaveBtn">Save</button>' +
      (q.order_id ? '' : '<button class="ad-btn-sm" id="qConvertBtn">Convert to Order</button>') +
    '</div>'
  );
  $('#qSaveBtn').addEventListener('click', async () => {
    try { await api('/api/admin/quotes?id=' + q.id, { method: 'PATCH', body: { status: $('#qStatus').value, admin_notes: $('#qNotes').value } }); toast('Saved.'); closeModal(); loadQuotesTable(); }
    catch (err) { toast(err.message); }
  });
  const convertBtn = $('#qConvertBtn');
  if (convertBtn) convertBtn.addEventListener('click', async () => {
    try { await api('/api/admin/quotes', { method: 'POST', body: { action: 'convert-to-order', id: q.id } }); toast('Converted to order.'); closeModal(); loadQuotesTable(); }
    catch (err) { toast(err.message); }
  });
}

/* ════════════════════════════════════════════════════════════════
   NOTIFICATIONS
   ════════════════════════════════════════════════════════════════ */
async function renderNotifications() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">Notifications</h1>' +
    '<button class="ad-btn-sm" id="notifMarkAllBtn">Mark all as read</button></div><div id="notifList"></div></div>';
  $('#notifMarkAllBtn').addEventListener('click', async () => {
    await api('/api/admin/notifications', { method: 'PATCH', body: { action: 'mark-all-read' } });
    pollNotifBadge(); loadNotifList();
  });
  await loadNotifList();
}
async function loadNotifList() {
  const data = await api('/api/admin/notifications');
  const el = $('#notifList');
  if (!data.notifications.length) { el.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">🔔</div>No notifications.</div>'; return; }
  el.innerHTML = data.notifications.map(n => (
    '<div class="ad-card" style="margin-bottom:8px;' + (n.is_read ? 'opacity:0.6' : '') + '">' +
      '<div style="display:flex;justify-content:space-between;gap:10px"><div><strong>' + esc(n.title) + '</strong><div style="color:var(--ad-text-50);font-size:12px;margin-top:3px">' + esc(n.body || '') + '</div></div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0">' +
        (n.is_read ? '' : '<button class="ad-btn-sm" data-read="' + n.id + '">Mark read</button>') +
        '<button class="ad-btn-sm ad-btn-sm--danger" data-del="' + n.id + '">Delete</button></div></div>' +
      '<div style="color:var(--ad-text-35);font-size:11px;margin-top:6px">' + new Date(n.created_at).toLocaleString() + '</div>' +
    '</div>'
  )).join('');
  $$('[data-read]', el).forEach(b => b.addEventListener('click', async () => { await api('/api/admin/notifications', { method: 'PATCH', body: { action: 'mark-read', id: b.getAttribute('data-read') } }); pollNotifBadge(); loadNotifList(); }));
  $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => { await api('/api/admin/notifications?id=' + b.getAttribute('data-del'), { method: 'DELETE' }); loadNotifList(); }));
}

/* ════════════════════════════════════════════════════════════════
   AUDIT LOGS
   ════════════════════════════════════════════════════════════════ */
let auditPage = 1;
async function renderAudit() {
  $('#adContent').innerHTML = '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">Audit Logs</h1></div><div id="auditTableWrap"></div></div>';
  await loadAuditTable();
}
async function loadAuditTable() {
  const wrap = $('#auditTableWrap');
  wrap.innerHTML = '<div class="ad-loading"><div class="ad-spinner"></div></div>';
  const data = await api('/api/admin/audit-logs?page=' + auditPage + '&pageSize=25');
  if (!data.logs.length) { wrap.innerHTML = '<div class="ad-empty"><div class="ad-empty-icon">📜</div>No activity recorded yet.</div>'; return; }
  wrap.innerHTML =
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>IP</th></tr></thead><tbody>' +
    data.logs.map(l => (
      '<tr><td>' + new Date(l.created_at).toLocaleString() + '</td><td>' + esc(l.admin_email || '—') + '</td>' +
      '<td>' + esc(l.action) + '</td><td>' + esc(l.entity_type || '') + (l.entity_id ? ' #' + esc(String(l.entity_id).slice(0, 8)) : '') + '</td>' +
      '<td>' + esc(l.ip || '—') + '</td></tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(auditPage, data.total, 25, p => { auditPage = p; loadAuditTable(); });
}

/* ════════════════════════════════════════════════════════════════
   MY ACCOUNT (change password / logout everywhere)
   ════════════════════════════════════════════════════════════════ */
async function renderAccount() {
  $('#adContent').innerHTML =
    '<div class="ad-page"><div class="ad-page-head"><h1 class="ad-page-title">My Account</h1></div>' +
    '<div class="ad-card"><div class="ad-card-title">Signed in as</div>' +
      '<p>' + esc(CURRENT_ADMIN.email) + ' — <span class="ad-badge ad-badge--active">' + esc(CURRENT_ADMIN.role) + '</span></p>' +
      (CURRENT_ADMIN.must_change_password ? '<div class="ad-msg ad-msg--error">You are using the temporary password — please change it below.</div>' : '') +
    '</div>' +
    '<div class="ad-card"><div class="ad-card-title">Change Password</div>' +
      '<div class="ad-field"><label class="ad-label">Current Password</label><input class="ad-input" id="curPw" type="password"></div>' +
      '<div class="ad-field"><label class="ad-label">New Password</label><input class="ad-input" id="newPw" type="password"></div>' +
      '<button class="ad-btn-sm ad-btn-sm--primary" id="changePwBtn">Update Password</button>' +
    '</div>' +
    '<div class="ad-card"><div class="ad-card-title">Security</div>' +
      '<button class="ad-btn-sm ad-btn-sm--danger" id="logoutAllBtn">Logout from all devices</button>' +
    '</div></div>';

  $('#changePwBtn').addEventListener('click', async () => {
    try {
      await api('/api/admin/auth', { method: 'POST', body: { action: 'change-password', current_password: $('#curPw').value, new_password: $('#newPw').value } });
      toast('Password updated.'); $('#curPw').value = ''; $('#newPw').value = '';
      CURRENT_ADMIN.must_change_password = false; renderAccount();
    } catch (err) { toast(err.message); }
  });
  $('#logoutAllBtn').addEventListener('click', async () => {
    if (!confirm('This will sign you out on every device. Continue?')) return;
    await api('/api/admin/auth', { method: 'POST', body: { action: 'logout-all' } });
    location.href = '/pages/admin/login.html';
  });
}

boot();
