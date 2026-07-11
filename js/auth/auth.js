/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Authentication core (Supabase)
   ───────────────────────────────────────────────────────────────────
   ES module. Exposes a small, framework-free API on window.AFAuth so the
   non-module scripts (product-filter.js, main.js, page inline) can call it.

   • supabase-js is lazy-loaded from CDN only when first needed, so the
     auth UI renders instantly and works offline (logged-out) without it.
   • When config.js still holds placeholders, isConfigured() === false and
     every action returns a friendly "not configured" error instead of
     throwing — the UI stays usable for design/QA.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const SUPABASE_ESM = 'https://esm.sh/@supabase/supabase-js@2';

const cfg = (window.__AF_SUPABASE__ || {});
const CONFIGURED =
  !!cfg.url && !!cfg.anonKey &&
  !/YOUR-PROJECT-REF|YOUR-SUPABASE/i.test(cfg.url + cfg.anonKey);

let _client = null;       // cached Supabase client
let _clientPromise = null;
const _listeners = [];    // auth-state change subscribers
let _cachedUser = null;   // last known user (null = logged out)

/* ── Origin-aware redirect URLs (work on localhost + production) ── */
function redirect(path) {
  return window.location.origin + path;
}
/* Language of the page the user is acting from — carried through the
   OAuth/verification redirect so they return to the SAME language. */
function curLang() { return document.documentElement.lang === 'ar' ? 'ar' : 'en'; }
const URLS = {
  oauthCallback: () => redirect('/pages/auth/callback.html?lang=' + curLang()),
  resetPassword: () => redirect('/pages/auth/reset-password.html?lang=' + curLang()),
  verifyEmail:   () => redirect('/pages/auth/callback.html?verified=1&lang=' + curLang()),
};

/* ── Lazy client init ─────────────────────────────────────────────── */
async function getClient() {
  if (!CONFIGURED) return null;
  if (_client) return _client;
  if (!_clientPromise) {
    _clientPromise = import(/* @vite-ignore */ SUPABASE_ESM).then(function (mod) {
      _client = mod.createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,        // survive page navigations (static site)
          autoRefreshToken: true,
          detectSessionInUrl: true,    // handle OAuth / magic-link redirects
          storageKey: 'af-auth',
          flowType: 'pkce',            // secure OAuth flow for SPAs/static
        },
      });
      _client.auth.onAuthStateChange(function (_event, session) {
        _cachedUser = session ? session.user : null;
        _emit();
      });
      return _client;
    });
  }
  return _clientPromise;
}

function _emit() {
  _listeners.forEach(function (fn) { try { fn(_cachedUser); } catch (e) {} });
}

function notConfigured() {
  return {
    error: {
      message: 'Authentication is not configured yet. Add your Supabase URL and anon key in js/auth/config.js (see AUTH_SETUP.md).',
      code: 'NOT_CONFIGURED',
    },
  };
}

/* ── Public API ───────────────────────────────────────────────────── */
const AFAuth = {
  isConfigured: function () { return CONFIGURED; },

  /* Start loading the Supabase SDK (a sizeable multi-module bundle) ahead
     of time, e.g. the moment the login modal opens — rather than the
     first time it's actually needed, which used to be the Login button's
     own click handler, and showed up as a ~300ms INP hit on that click
     (module evaluation is synchronous main-thread work once it lands).
     getClient() already caches/memoizes, so calling this more than once,
     or on a page that never ends up needing auth, is a safe no-op. */
  preload: function () {
    if (!CONFIGURED) return;
    getClient().catch(function () {});
  },

  /* Current user (sync cache) + a promise variant that hydrates session */
  currentUser: function () { return _cachedUser; },

  /* Current session's JWT — sent to server endpoints (e.g. /api/quote) so
     they can securely resolve the real signed-in user server-side instead
     of trusting a client-supplied id. Returns null when logged out. */
  getAccessToken: async function () {
    if (!CONFIGURED) return null;
    try {
      const sb = await getClient();
      const res = await sb.auth.getSession();
      return res.data.session ? res.data.session.access_token : null;
    } catch (e) { return null; }
  },

  init: async function () {
    if (!CONFIGURED) { _emit(); return null; }
    const sb = await getClient();
    const res = await sb.auth.getSession();
    _cachedUser = res.data.session ? res.data.session.user : null;
    _emit();
    return _cachedUser;
  },

  onChange: function (fn) {
    if (typeof fn === 'function') {
      _listeners.push(fn);
      fn(_cachedUser); // fire immediately with current state
    }
    return function off() {
      const i = _listeners.indexOf(fn);
      if (i > -1) _listeners.splice(i, 1);
    };
  },

  /* ── Sign up (email/password) — sends verification email ── */
  signUp: async function (data) {
    if (!CONFIGURED) return notConfigured();
    const sb = await getClient();
    return sb.auth.signUp({
      email: (data.email || '').trim(),
      password: data.password,
      options: {
        emailRedirectTo: URLS.verifyEmail(),
        data: {
          first_name: (data.firstName || '').trim(),
          last_name:  (data.lastName || '').trim(),
          mobile:     (data.mobile || '').trim(),
          full_name:  ((data.firstName || '') + ' ' + (data.lastName || '')).trim(),
        },
      },
    });
  },

  /* ── Sign in (email/password) ── */
  signIn: async function (email, password) {
    if (!CONFIGURED) return notConfigured();
    const sb = await getClient();
    return sb.auth.signInWithPassword({ email: (email || '').trim(), password: password });
  },

  /* ── Google OAuth ── */
  signInWithGoogle: async function () {
    if (!CONFIGURED) return notConfigured();
    const sb = await getClient();
    return sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: URLS.oauthCallback() },
    });
  },

  signOut: async function () {
    /* Clear user-specific local data before signing out */
    try { localStorage.removeItem('afq-products-cart'); } catch(e){}
    try { localStorage.removeItem('afq-wishlist'); } catch(e){}
    try { localStorage.removeItem('afq-cart-meta'); } catch(e){}
    if (!CONFIGURED) { _cachedUser = null; _emit(); return {}; }
    const sb = await getClient();
    const res = await sb.auth.signOut();
    _cachedUser = null; _emit();
    return res;
  },

  /* ── Password reset ── */
  sendPasswordReset: async function (email) {
    if (!CONFIGURED) return notConfigured();
    const sb = await getClient();
    return sb.auth.resetPasswordForEmail((email || '').trim(), { redirectTo: URLS.resetPassword() });
  },

  updatePassword: async function (newPassword) {
    if (!CONFIGURED) return notConfigured();
    const sb = await getClient();
    return sb.auth.updateUser({ password: newPassword });
  },

  resendVerification: async function (email) {
    if (!CONFIGURED) return notConfigured();
    const sb = await getClient();
    return sb.auth.resend({ type: 'signup', email: (email || '').trim(),
      options: { emailRedirectTo: URLS.verifyEmail() } });
  },

  /* ── Profile (row in public.profiles, 1:1 with auth user) ── */
  getProfile: async function () {
    if (!CONFIGURED || !_cachedUser) return { data: null, error: null };
    const sb = await getClient();
    return sb.from('profiles').select('*').eq('id', _cachedUser.id).single();
  },

  updateProfile: async function (fields) {
    if (!CONFIGURED || !_cachedUser) return notConfigured();
    const sb = await getClient();
    fields.updated_at = new Date().toISOString();
    return sb.from('profiles').update(fields).eq('id', _cachedUser.id);
  },

  /* ── Avatar upload → public "avatars" bucket, then save URL on profile ── */
  uploadAvatar: async function (file) {
    if (!CONFIGURED || !_cachedUser || !file) return null;
    const sb = await getClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = _cachedUser.id + '/avatar.' + ext;
    const up = await sb.storage.from('avatars').upload(path, file, { upsert: true });
    if (up.error) throw up.error;
    const pub = sb.storage.from('avatars').getPublicUrl(path);
    const url = pub.data.publicUrl + '?t=' + Date.now();
    await sb.from('profiles').update({ avatar_url: url, updated_at: new Date().toISOString() }).eq('id', _cachedUser.id);
    return url;
  },

  /* ── Wishlist (public.wishlist) ── */
  getWishlist: async function () {
    if (!CONFIGURED || !_cachedUser) return { data: [], error: null };
    const sb = await getClient();
    return sb.from('wishlist').select('product_id').eq('user_id', _cachedUser.id);
  },

  toggleWishlist: async function (productId, on) {
    if (!CONFIGURED || !_cachedUser) return notConfigured();
    const sb = await getClient();
    if (on === false) {
      return sb.from('wishlist').delete().match({ user_id: _cachedUser.id, product_id: productId });
    }
    return sb.from('wishlist').upsert(
      { user_id: _cachedUser.id, product_id: productId },
      { onConflict: 'user_id,product_id' }
    );
  },

  /* ── Bidirectional cart sync: merge guest localStorage cart with the
     user's saved Supabase cart, then persist both ways. Best-effort. ── */
  mergeGuestCart: async function () {
    if (!CONFIGURED || !_cachedUser) return;
    try {
      const CART_KEY = 'afq-products-cart';
      const raw = localStorage.getItem(CART_KEY);
      const guestItems = raw ? JSON.parse(raw) : [];
      const sb = await getClient();
      /* Load user's existing server cart */
      const existing = await sb.from('carts').select('items').eq('user_id', _cachedUser.id).maybeSingle();
      const serverItems = (existing && existing.data && Array.isArray(existing.data.items))
        ? existing.data.items : [];
      /* Merge: server cart is the base, guest items are added/combined */
      const merged = [...serverItems];
      guestItems.forEach(function(gi) {
        const found = merged.find(function(m) { return m.id === gi.id; });
        if (found) { found.qty = (Number(found.qty) || 0) + (Number(gi.qty) || 0); }
        else { merged.push(gi); }
      });
      /* Persist merged cart back to Supabase */
      await sb.from('carts').upsert(
        { user_id: _cachedUser.id, items: merged, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      /* Restore merged cart to localStorage so the products page reflects it */
      localStorage.setItem(CART_KEY, JSON.stringify(merged));
    } catch (e) { /* non-fatal */ }
  },

  /* ── Save the current items array directly to the user's Supabase cart ── */
  saveCartToServer: async function (items) {
    if (!CONFIGURED || !_cachedUser) return;
    try {
      const sb = await getClient();
      await sb.from('carts').upsert(
        { user_id: _cachedUser.id, items: items || [], updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    } catch(e) { /* non-fatal */ }
  },

  /* ── Load the user's Supabase wishlist into localStorage ──
     Converts product_id to a number when possible, to match the integer
     IDs used in wishlist.has() on the products page. ── */
  syncWishlistToLocal: async function () {
    if (!CONFIGURED || !_cachedUser) return;
    try {
      const sb = await getClient();
      const res = await sb.from('wishlist').select('product_id').eq('user_id', _cachedUser.id);
      const ids = (res && res.data) ? res.data.map(function(r) {
        const n = parseInt(r.product_id, 10);
        return isNaN(n) ? r.product_id : n;
      }) : [];
      localStorage.setItem('afq-wishlist', JSON.stringify(ids));
    } catch(e) { /* non-fatal */ }
  },

  /* ── Create an order record in public.orders ── */
  createOrder: async function (data) {
    if (!CONFIGURED || !_cachedUser) return { data: null, error: { message: 'Not logged in' } };
    try {
      const sb = await getClient();
      const payload = {
        user_id:     _cachedUser.id,
        order_no:    data.order_no   || null,
        status:      data.status     || 'pending',
        items:       data.items      || [],
        subtotal:    Number(data.subtotal)   || 0,
        vat:         Number(data.vat)        || 0,
        grand_total: Number(data.grand_total) || 0,
      };
      return sb.from('orders').insert(payload).select().single();
    } catch(e) { return { data: null, error: e }; }
  },

  /* ── Orders (read-only history) — soft-deleted orders (admin "Delete"
     action) are excluded here so they vanish from My Orders / Order
     History / invoices / the account dashboard; a later Recover makes
     them reappear automatically since this is a live query, not a cache. ── */
  getOrders: async function () {
    if (!CONFIGURED || !_cachedUser) return { data: [], error: null };
    const sb = await getClient();
    return sb.from('orders').select('*').eq('user_id', _cachedUser.id).eq('is_deleted', false).order('created_at', { ascending: false });
  },

  /* ── Customer-initiated cancel / delete — restricted to the caller's
     own orders via an explicit user_id match (defense in depth on top
     of the "own rows" RLS policy, matching addresses' delete/update
     pattern below). Cancel only makes sense before the order has moved
     past pending/processing; delete only for cancelled/completed — both
     are enforced in the UI (js/auth/account.js), not re-validated here,
     same division of responsibility as the rest of this file. ── */
  cancelOrder: async function (id) {
    if (!CONFIGURED || !_cachedUser) return notConfigured();
    const sb = await getClient();
    return sb.from('orders').update({ status: 'cancelled' }).match({ id: id, user_id: _cachedUser.id });
  },
  deleteOrder: async function (id) {
    if (!CONFIGURED || !_cachedUser) return notConfigured();
    const sb = await getClient();
    return sb.from('orders').delete().match({ id: id, user_id: _cachedUser.id });
  },

  /* ── Live order sync — admin status/tracking updates land in this same
     table, so subscribing here makes them appear in the dashboard the
     instant they're saved, with no page reload needed. Returns an
     unsubscribe function; safe no-op if Realtime is unavailable. ── */
  subscribeOrders: function (onChange) {
    if (!CONFIGURED || !_cachedUser) return function () {};
    let channel = null;
    getClient().then(function (sb) {
      if (!sb) return;
      channel = sb.channel('orders-' + _cachedUser.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: 'user_id=eq.' + _cachedUser.id }, onChange)
        .subscribe();
    }).catch(function () {});
    return function () { if (channel) channel.unsubscribe(); };
  },

  /* ── Addresses (CRUD) ── */
  getAddresses: async function () {
    if (!CONFIGURED || !_cachedUser) return { data: [], error: null };
    const sb = await getClient();
    return sb.from('addresses').select('*').eq('user_id', _cachedUser.id).order('created_at', { ascending: false });
  },
  addAddress: async function (a) {
    if (!CONFIGURED || !_cachedUser) return notConfigured();
    const sb = await getClient();
    return sb.from('addresses').insert(Object.assign({ user_id: _cachedUser.id }, a)).select().single();
  },
  deleteAddress: async function (id) {
    if (!CONFIGURED || !_cachedUser) return notConfigured();
    const sb = await getClient();
    return sb.from('addresses').delete().match({ id: id, user_id: _cachedUser.id });
  },
  updateAddress: async function (id, a) {
    if (!CONFIGURED || !_cachedUser) return notConfigured();
    const sb = await getClient();
    return sb.from('addresses').update(a).match({ id: id, user_id: _cachedUser.id });
  },
};

window.AFAuth = AFAuth;

/* Hydrate session on load (no-op + logged-out state when unconfigured). */
AFAuth.init();

export default AFAuth;
