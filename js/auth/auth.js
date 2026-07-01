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

const SUPABASE_ESM = 'https://esm.sh/@supabase/supabase-js@2.45.4';

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
const URLS = {
  oauthCallback: () => redirect('/pages/auth/callback.html'),
  resetPassword: () => redirect('/pages/auth/reset-password.html'),
  verifyEmail:   () => redirect('/pages/auth/callback.html?verified=1'),
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

  /* Current user (sync cache) + a promise variant that hydrates session */
  currentUser: function () { return _cachedUser; },

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

  /* ── Merge the guest localStorage cart into the user's saved cart ──
     Called after a successful login. Best-effort; never throws. ── */
  mergeGuestCart: async function () {
    if (!CONFIGURED || !_cachedUser) return;
    try {
      const raw = localStorage.getItem('afq-products-cart');
      const items = raw ? JSON.parse(raw) : [];
      if (!items.length) return;
      const sb = await getClient();
      await sb.from('carts').upsert(
        { user_id: _cachedUser.id, items: items, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    } catch (e) { /* non-fatal */ }
  },
};

window.AFAuth = AFAuth;

/* Hydrate session on load (no-op + logged-out state when unconfigured). */
AFAuth.init();

export default AFAuth;
