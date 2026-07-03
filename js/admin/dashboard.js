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
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn) { location.hash = '#' + pageBtn.getAttribute('data-page'); return; }
    const soonBtn = e.target.closest('[data-soon]');
    if (soonBtn) { renderComingSoon(soonBtn.getAttribute('data-soon')); return; }
    /* Dashboard Home: Recent Orders / Recent Customers rows open the
       exact same detail modal as their "View" button — same delegated
       listener, so this keeps working no matter how many times Home
       re-renders (auto-refresh included). */
    const orderRow = e.target.closest('[data-order-row]');
    if (orderRow) { openOrderDetail(orderRow.getAttribute('data-order-row')); return; }
    const custRow = e.target.closest('[data-customer-row]');
    if (custRow) { openCustomerDetail(custRow.getAttribute('data-customer-row')); }
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
    location.href = '/pages/admin/login.html';
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
      '<td><button class="ad-btn-sm ad-btn-sm--primary" data-view="' + o.id + '">View</button></td></tr>';
    }).join('') + '</tbody></table></div>' +
    pagination(ordersPage, data.total, 15, p => { ordersPage = p; loadOrdersTable(); });
  $$('[data-view]', wrap).forEach(b => b.addEventListener('click', () => openOrderDetail(b.getAttribute('data-view'))));
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

async function openOrderDetail(id) {
  const data = await api('/api/admin/orders?id=' + id);
  const o = data.order;
  openModal(
    '<h3 class="ad-modal-title">Order ' + esc(o.order_no || o.id.slice(0, 8)) + '</h3>' +
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
      '<div class="ad-field"><label class="ad-label">Status</label><select class="ad-input ad-select" id="ordStatus">' +
        ORDER_STATUSES.map(s => '<option value="' + s + '"' + (s === o.status ? ' selected' : '') + '>' + label(s) + '</option>').join('') + '</select></div>' +
      '<div class="ad-field"><label class="ad-label">Payment Status</label><select class="ad-input ad-select" id="ordPayment">' +
        ['pending','paid','failed','refunded'].map(s => '<option value="' + s + '"' + (s === (o.payment_status || 'pending') ? ' selected' : '') + '>' + label(s) + '</option>').join('') + '</select></div>' +
      '<div class="ad-field"><label class="ad-label">Tracking %</label><input class="ad-input" id="ordPct" type="number" min="0" max="100" value="' + (o.tracking_pct || 0) + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Current Stage</label><input class="ad-input" id="ordStage" value="' + esc(o.current_stage || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Est. Completion</label><input class="ad-input" id="ordEstComplete" type="date" value="' + (o.estimated_completion || '') + '"></div>' +
      '<div class="ad-field"><label class="ad-label">Est. Delivery</label><input class="ad-input" id="ordEstDeliver" type="date" value="' + (o.estimated_delivery || '') + '"></div>' +
    '</div>' +
    '<div class="ad-field"><label class="ad-label">Admin Notes</label><textarea class="ad-input ad-textarea" id="ordNotes">' + esc(o.admin_notes || '') + '</textarea></div>' +
    '<div class="ad-card-title" style="margin-top:14px">Items</div>' +
    (o.items && o.items.length ? o.items.map(it => rowLine(it.name, '×' + it.qty, money(it.price * it.qty))).join('') : '<p class="ad-empty">No item details.</p>') +
    '<div style="text-align:end;font-size:15px;margin-top:10px">Total: <strong>' + money(o.grand_total) + '</strong></div>' +
    '<div class="ad-form-actions"><button class="ad-btn-sm ad-btn-sm--primary" id="ordSaveBtn">Save Changes</button></div>',
    true
  );
  $('#ordSaveBtn').addEventListener('click', async () => {
    const btn = $('#ordSaveBtn'); btn.disabled = true;
    try {
      await api('/api/admin/orders?id=' + o.id, { method: 'PATCH', body: {
        status: $('#ordStatus').value, payment_status: $('#ordPayment').value,
        tracking_pct: Number($('#ordPct').value) || 0, current_stage: $('#ordStage').value,
        estimated_completion: $('#ordEstComplete').value || null, estimated_delivery: $('#ordEstDeliver').value || null,
        admin_notes: $('#ordNotes').value,
      }});
      toast('Order updated — synced to the customer dashboard.');
      closeModal();
      loadOrdersTable();
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
    '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>' +
    data.customers.map(c => (
      '<tr><td>' + esc(c.name) + (c.company ? '<br><span style="color:var(--ad-text-35);font-size:11px">' + esc(c.company) + '</span>' : '') + '</td>' +
      '<td>' + esc(c.email) + '</td><td>' + esc(c.phone || '—') + '</td><td>' + c.orders_count + '</td>' +
      '<td><span class="ad-badge ad-badge--' + (c.is_banned ? 'suspended' : 'active') + '">' + (c.is_banned ? 'Disabled' : 'Active') + '</span></td>' +
      '<td>' + new Date(c.created_at).toLocaleDateString() + '</td>' +
      '<td class="ad-actions-row"><button class="ad-btn-sm ad-btn-sm--primary" data-view="' + c.id + '">View</button></td></tr>'
    )).join('') + '</tbody></table></div>' +
    pagination(customersPage, data.total, 15, p => { customersPage = p; loadCustomersTable(); });
  $$('[data-view]', wrap).forEach(b => b.addEventListener('click', () => openCustomerDetail(b.getAttribute('data-view'))));
}
async function openCustomerDetail(id) {
  const data = await api('/api/admin/customers?id=' + id);
  const c = data.customer;
  openModal(
    '<h3 class="ad-modal-title">' + esc(c.full_name || c.email) + '</h3>' +
    '<div class="ad-form-grid" style="font-size:13px;margin-bottom:16px">' +
      '<div><strong>Email:</strong> ' + esc(c.email) + (c.email_verified ? ' ✓' : ' (unverified)') + '</div>' +
      '<div><strong>Phone:</strong> ' + esc(c.mobile || '—') + '</div>' +
      '<div><strong>Company:</strong> ' + esc(c.company || '—') + '</div>' +
      '<div><strong>Country:</strong> ' + esc(c.country || '—') + '</div>' +
      '<div><strong>Joined:</strong> ' + new Date(c.created_at).toLocaleDateString() + '</div>' +
      '<div><strong>Last login:</strong> ' + (c.last_login ? new Date(c.last_login).toLocaleString() : '—') + '</div>' +
    '</div>' +
    '<div class="ad-card-title">Orders (' + data.orders.length + ')</div>' +
    (data.orders.length ? data.orders.slice(0, 5).map(o => (
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--ad-border);font-size:13px">' +
        '<div><div style="font-weight:600">' + esc(o.order_no || o.id.slice(0, 8)) + '</div><div style="color:var(--ad-text-50);font-size:12px">' + new Date(o.created_at).toLocaleDateString() + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<span class="ad-badge ad-badge--' + esc(o.status) + '">' + label(o.status) + '</span>' +
          '<span>' + money(o.grand_total) + '</span>' +
          '<button class="ad-btn-sm ad-btn-sm--primary" data-view-order="' + o.id + '">View Order</button>' +
        '</div>' +
      '</div>'
    )).join('') : '<p class="ad-empty">No orders.</p>') +
    '<div class="ad-card-title" style="margin-top:12px">Addresses (' + data.addresses.length + ')</div>' +
    (data.addresses.length ? data.addresses.map(a => rowLine(a.label || 'Address', [a.line1, a.city, a.country].filter(Boolean).join(', '), '')).join('') : '<p class="ad-empty">No saved addresses.</p>') +
    '<div class="ad-form-actions" style="margin-top:16px;flex-wrap:wrap">' +
      '<button class="ad-btn-sm" id="custResetPw">Reset Password</button>' +
      '<button class="ad-btn-sm" id="custEmail">Email Customer</button>' +
      '<button class="ad-btn-sm' + (c.is_banned ? ' ad-btn-sm--primary' : ' ad-btn-sm--danger') + '" id="custToggle">' + (c.is_banned ? 'Enable Account' : 'Disable Account') + '</button>' +
      '<button class="ad-btn-sm ad-btn-sm--danger" id="custDelete">Delete Account</button>' +
    '</div>',
    true
  );
  $$('[data-view-order]').forEach(b => b.addEventListener('click', () => openOrderDetail(b.getAttribute('data-view-order'))));
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
  $('#custToggle').addEventListener('click', async () => {
    try { await api('/api/admin/customers?id=' + c.id, { method: 'PATCH', body: { disabled: !c.is_banned } }); toast('Updated.'); closeModal(); loadCustomersTable(); }
    catch (err) { toast(err.message); }
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
