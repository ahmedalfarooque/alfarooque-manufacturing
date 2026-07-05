/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Authentication UI
   ───────────────────────────────────────────────────────────────────
   • Glassmorphism auth modal: Login / Sign Up / Forgot Password tabs
   • Google OAuth + (coming-soon) Microsoft / Apple / Facebook
   • Injects an account control into the nav; swaps Login → avatar+menu
   • Binds the existing products toolbar button (#pfLoginBtn)
   • Bilingual (EN / AR via <html lang>), theme-aware, RTL, a11y (focus
     trap, ESC, ARIA), fully responsive — all styling in css/auth.css.
   ES module; depends on window.AFAuth (auth.js).
   ═══════════════════════════════════════════════════════════════════ */
'use strict';
import AFAuth from './auth.js';
import { isAdminAccountEmail } from './admin-emails.js';

const IS_AR = document.documentElement.lang === 'ar';
const t = (en, ar) => (IS_AR ? ar : en);
/* Google is only "live" once enabled in Supabase + flagged in config.js.
   Until then it renders as "coming soon" (no OAuth attempt → no error). */
const GOOGLE_ENABLED = !!(window.__AF_SUPABASE__ && window.__AF_SUPABASE__.googleEnabled);

/* ── SVG icons (inline, no external requests) ── */
const ICON = {
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  caret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>',
  microsoft: '<svg viewBox="0 0 24 24"><path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/></svg>',
  apple: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.543 12.718c-.022-2.31 1.885-3.42 1.97-3.474-1.073-1.57-2.742-1.785-3.336-1.81-1.42-.144-2.77.836-3.49.836-.72 0-1.83-.815-3.01-.792-1.55.022-2.98.9-3.776 2.287-1.61 2.79-.412 6.92 1.155 9.19.766 1.11 1.68 2.357 2.877 2.313 1.155-.046 1.59-.746 2.985-.746 1.394 0 1.786.746 3.007.723 1.243-.022 2.03-1.132 2.79-2.246.88-1.287 1.242-2.534 1.264-2.598-.028-.013-2.424-.93-2.45-3.686zM15.07 5.32c.637-.772 1.066-1.846.95-2.915-.918.037-2.03.612-2.688 1.383-.59.684-1.106 1.777-.968 2.825 1.024.08 2.07-.52 2.706-1.293z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>',
};

let modalEl = null, dropdownEl = null, lastFocus = null, currentTrigger = null;

/* ════════════════════════════════════════════════════════════════
   MODAL
   ════════════════════════════════════════════════════════════════ */
function buildModal() {
  if (modalEl) return modalEl;
  const el = document.createElement('div');
  el.className = 'af-auth-overlay';
  el.id = 'afAuthOverlay';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'afAuthTitle');
  el.hidden = true;

  const socialRow =
    '<div class="af-social-row">' +
      (GOOGLE_ENABLED
        ? '<button type="button" class="af-social" data-af-oauth="google" aria-label="' + t('Continue with Google','المتابعة عبر Google') + '">' + ICON.google + '<span>Google</span></button>'
        : '<button type="button" class="af-social af-soon" disabled aria-label="Google (' + t('coming soon','قريباً') + ')" title="' + t('Coming soon','قريباً') + '">' + ICON.google + '<span>Google</span></button>') +
      '<button type="button" class="af-social af-soon" disabled aria-label="Microsoft (' + t('coming soon','قريباً') + ')" title="' + t('Coming soon','قريباً') + '">' + ICON.microsoft + '<span>Microsoft</span></button>' +
      '<button type="button" class="af-social af-soon" disabled aria-label="Apple (' + t('coming soon','قريباً') + ')" title="' + t('Coming soon','قريباً') + '">' + ICON.apple + '<span>Apple</span></button>' +
      '<button type="button" class="af-social af-soon" disabled aria-label="Facebook (' + t('coming soon','قريباً') + ')" title="' + t('Coming soon','قريباً') + '">' + ICON.facebook + '<span>Facebook</span></button>' +
    '</div>';

  const divider = '<div class="af-divider"><span>' + t('OR CONTINUE WITH','أو تابع عبر') + '</span></div>';

  el.innerHTML =
    '<div class="af-auth-backdrop" data-af-close></div>' +
    '<div class="af-auth-card" role="document">' +
      '<button type="button" class="af-auth-close" data-af-close aria-label="' + t('Close','إغلاق') + '">' + ICON.close + '</button>' +
      '<div class="af-auth-head">' +
        '<div class="af-auth-logo"><img src="/assets/images/logo/IAA_LOGO.png" alt="AL FAROOQUE" width="40" height="40"></div>' +
        '<h2 class="af-auth-title" id="afAuthTitle">' + t('Welcome','مرحباً') + '</h2>' +
        '<p class="af-auth-sub" id="afAuthSub">' + t('Sign in to your AL FAROOQUE account','سجّل الدخول إلى حساب الفاروقي') + '</p>' +
      '</div>' +
      '<div class="af-tabs" role="tablist">' +
        '<button class="af-tab is-active" role="tab" data-af-tab="login" aria-selected="true">' + t('Login','تسجيل الدخول') + '</button>' +
        '<button class="af-tab" role="tab" data-af-tab="signup" aria-selected="false">' + t('Sign Up','إنشاء حساب') + '</button>' +
        '<span class="af-tab-ind" aria-hidden="true"></span>' +
      '</div>' +

      /* LOGIN PANEL */
      '<form class="af-panel is-active" data-af-panel="login" novalidate>' +
        '<div class="af-msg" data-af-msg hidden></div>' +
        field('email', 'email', t('Email Address','البريد الإلكتروني'), 'name@example.com', 'email', true) +
        passwordField('password', t('Password','كلمة المرور')) +
        '<div class="af-row-between">' +
          '<label class="af-check"><input type="checkbox" name="remember" checked><span>' + t('Remember me','تذكرني') + '</span></label>' +
          '<button type="button" class="af-link" data-af-tab="forgot">' + t('Forgot password?','نسيت كلمة المرور؟') + '</button>' +
        '</div>' +
        '<button type="submit" class="af-submit">' + t('Login','تسجيل الدخول') + '</button>' +
        divider + socialRow +
      '</form>' +

      /* SIGNUP PANEL */
      '<form class="af-panel" data-af-panel="signup" novalidate>' +
        '<div class="af-msg" data-af-msg hidden></div>' +
        '<div class="af-grid2">' +
          field('first_name', 'text', t('First Name','الاسم الأول'), 'Ahmed', 'given-name', true) +
          field('last_name', 'text', t('Last Name','اسم العائلة'), 'Al-Faris', 'family-name', true) +
        '</div>' +
        field('email', 'email', t('Email Address','البريد الإلكتروني'), 'name@example.com', 'email', true) +
        field('mobile', 'tel', t('Mobile Number (optional)','رقم الجوال (اختياري)'), '+966 5X XXX XXXX', 'tel', false) +
        passwordField('password', t('Password','كلمة المرور')) +
        passwordField('confirm', t('Confirm Password','تأكيد كلمة المرور')) +
        '<label class="af-check af-terms"><input type="checkbox" name="terms"><span>' + t('I agree to the ','أوافق على ') +
          '<a href="/pages/contact.html" target="_blank" rel="noopener">' + t('Terms & Privacy Policy','الشروط وسياسة الخصوصية') + '</a></span></label>' +
        '<button type="submit" class="af-submit">' + t('Create Account','إنشاء حساب') + '</button>' +
        divider + socialRow +
      '</form>' +

      /* FORGOT PANEL */
      '<form class="af-panel" data-af-panel="forgot" novalidate>' +
        '<div class="af-msg" data-af-msg hidden></div>' +
        '<p class="af-forgot-hint">' + t('Enter your email and we will send you a password reset link.','أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور.') + '</p>' +
        field('email', 'email', t('Email Address','البريد الإلكتروني'), 'name@example.com', 'email', true) +
        '<button type="submit" class="af-submit">' + t('Send Reset Link','إرسال رابط إعادة التعيين') + '</button>' +
        '<button type="button" class="af-link af-back" data-af-tab="login">← ' + t('Back to login','العودة لتسجيل الدخول') + '</button>' +
      '</form>' +
    '</div>';

  document.body.appendChild(el);
  modalEl = el;
  wireModal(el);
  return el;
}

function field(name, type, label, ph, autocomplete, required) {
  const id = 'af_' + name + '_' + (type === 'email' ? 'e' : 'f');
  return '<div class="af-field">' +
    '<label class="af-label" for="' + id + '">' + label + (required ? ' <span class="af-req">*</span>' : '') + '</label>' +
    '<input class="af-input" id="' + id + '" name="' + name + '" type="' + type + '" placeholder="' + ph + '"' +
      ' autocomplete="' + autocomplete + '"' + (required ? ' required' : '') + '>' +
    '</div>';
}

function passwordField(name, label) {
  const id = 'af_' + name;
  return '<div class="af-field">' +
    '<label class="af-label" for="' + id + '">' + label + ' <span class="af-req">*</span></label>' +
    '<div class="af-pass-wrap">' +
      '<input class="af-input" id="' + id + '" name="' + name + '" type="password" placeholder="••••••••"' +
        ' autocomplete="' + (name === 'password' ? 'current-password' : 'new-password') + '" required>' +
      '<button type="button" class="af-pass-toggle" data-af-toggle aria-label="' + t('Show password','إظهار كلمة المرور') + '">' + ICON.eye + '</button>' +
    '</div></div>';
}

function wireModal(el) {
  /* Close handlers */
  el.querySelectorAll('[data-af-close]').forEach(function (b) {
    b.addEventListener('click', closeModal);
  });
  /* Tab + sub-tab switches */
  el.querySelectorAll('[data-af-tab]').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.getAttribute('data-af-tab')); });
  });
  /* Password visibility toggles */
  el.querySelectorAll('[data-af-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      const input = b.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.innerHTML = show ? ICON.eyeOff : ICON.eye;
    });
  });
  /* Google OAuth */
  el.querySelectorAll('[data-af-oauth="google"]').forEach(function (b) {
    b.addEventListener('click', handleGoogle);
  });
  /* Form submits */
  el.querySelector('[data-af-panel="login"]').addEventListener('submit', handleLogin);
  el.querySelector('[data-af-panel="signup"]').addEventListener('submit', handleSignup);
  el.querySelector('[data-af-panel="forgot"]').addEventListener('submit', handleForgot);
  /* Focus trap (Tab) while the modal is open */
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') trapFocus(e);
  });
}

function switchTab(tab) {
  const el = modalEl; if (!el) return;
  const titles = {
    login:  [t('Welcome','مرحباً'), t('Sign in to your AL FAROOQUE account','سجّل الدخول إلى حساب الفاروقي')],
    signup: [t('Create Account','إنشاء حساب'), t('Join AL FAROOQUE — it only takes a minute','انضم إلى الفاروقي — يستغرق دقيقة واحدة')],
    forgot: [t('Reset Password','إعادة تعيين كلمة المرور'), t('We will email you a secure reset link','سنرسل لك رابط إعادة تعيين آمن')],
  };
  el.querySelector('#afAuthTitle').textContent = titles[tab][0];
  el.querySelector('#afAuthSub').textContent = titles[tab][1];

  el.querySelectorAll('.af-panel').forEach(function (p) {
    p.classList.toggle('is-active', p.getAttribute('data-af-panel') === tab);
  });
  /* Tab bar reflects login/signup; 'forgot' keeps login tab visually active */
  const barTab = tab === 'forgot' ? 'login' : tab;
  el.querySelectorAll('.af-tab').forEach(function (b) {
    const on = b.getAttribute('data-af-tab') === barTab;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  el.querySelector('.af-tabs').classList.toggle('tab-signup', barTab === 'signup');
  clearMsgs();
  const firstInput = el.querySelector('.af-panel.is-active .af-input');
  if (firstInput) setTimeout(function () { firstInput.focus(); }, 60);
}

function openModal(tab) {
  AFAuth.preload(); // start loading the Supabase SDK now, not on submit click
  buildModal();
  lastFocus = document.activeElement;
  modalEl.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(function () { modalEl.classList.add('is-open'); });
  switchTab(tab || 'login');
}

function closeModal() {
  if (!modalEl) return;
  modalEl.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(function () { if (modalEl) modalEl.hidden = true; }, 260);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function trapFocus(e) {
  const f = modalEl.querySelectorAll('button:not([disabled]), input, a[href]');
  const visible = Array.prototype.filter.call(f, function (n) { return n.offsetParent !== null; });
  if (!visible.length) return;
  const first = visible[0], last = visible[visible.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ── Messages ── */
function panelMsg(tab) { return modalEl.querySelector('[data-af-panel="' + tab + '"] [data-af-msg]'); }
function showMsg(tab, text, kind) {
  const m = panelMsg(tab); if (!m) return;
  m.textContent = text; m.hidden = false;
  m.className = 'af-msg af-msg--' + (kind || 'error');
}
function clearMsgs() {
  if (!modalEl) return;
  modalEl.querySelectorAll('[data-af-msg]').forEach(function (m) { m.hidden = true; m.textContent = ''; });
}
function setLoading(form, on, label) {
  const btn = form.querySelector('.af-submit');
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.classList.add('is-loading'); btn.textContent = label || t('Please wait…','يرجى الانتظار…'); }
  else { btn.disabled = false; btn.classList.remove('is-loading'); if (btn.dataset.label) btn.textContent = btn.dataset.label; }
}

/* ── Validation ── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function strongPassword(pw) {
  return pw && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

/* ── Admin-account detection ────────────────────────────────────────
   Administrator accounts (see js/auth/admin-emails.js) must never sign
   in as a customer. This only ever activates for those exact emails —
   every other address takes the normal customer path below with zero
   added latency or behavior change. The password itself is verified
   server-side (bcrypt, via the real admin login endpoint) — nothing here
   is a hardcoded credential, and nothing about admin status is revealed
   unless the password is ALSO correct, matching the same "no login"
   wording the admin endpoint already returns for anyone else. On success
   the admin endpoint has already sent the OTP email, so we hand off
   straight into that flow on the admin login page instead of asking for
   the password again. */
async function tryAdminHandoff(email, password) {
  if (!isAdminAccountEmail(email)) return null; // not an admin account — normal customer path
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'login', email, password }),
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, message: data.error || null };
  } catch (_) {
    /* Network hiccup talking to our own API — this is still an admin
       account, so we must NOT fall back to a customer sign-in attempt
       (that's guaranteed to fail with a misleading "wrong password").
       Ask the admin to retry instead. */
    return { ok: false, message: t('Could not reach the server. Please try again.','تعذر الوصول إلى الخادم. يرجى المحاولة مرة أخرى.') };
  }
}

/* ── Handlers ── */
async function handleLogin(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const email = form.email.value.trim();
  const pw = form.password.value;
  if (!EMAIL_RE.test(email)) return showMsg('login', t('Please enter a valid email address.','يرجى إدخال بريد إلكتروني صحيح.'));
  if (!pw) return showMsg('login', t('Please enter your password.','يرجى إدخال كلمة المرور.'));

  setLoading(form, true);
  const adminAttempt = await tryAdminHandoff(email, pw);
  if (adminAttempt) {
    /* This IS an admin account (arshad@/ahmed@) — never fall through to a
       customer sign-in attempt below, even if this admin attempt failed.
       An admin email has no customer account, so that fallback would
       always fail with a misleading "Incorrect email or password", no
       matter how the admin's real error occurred (wrong password, a
       transient email-send hiccup, a momentary rate limit, etc). Show the
       real reason instead so the admin can retry correctly. */
    setLoading(form, false);
    if (adminAttempt.ok) {
      showMsg('login', t('Verified — continuing to admin sign-in…','تم التحقق — جارٍ المتابعة إلى دخول المشرف…'), 'success');
      setTimeout(function () { location.href = '/admin?otp=1&email=' + encodeURIComponent(email); }, 500);
    } else {
      showMsg('login', adminAttempt.message || t('Login failed. Please try again.','فشل تسجيل الدخول. حاول مرة أخرى.'));
    }
    return;
  }
  setLoading(form, false);

  setLoading(form, true);
  const res = await AFAuth.signIn(email, pw);
  setLoading(form, false);
  if (res.error) {
    let msg = res.error.message || t('Login failed.','فشل تسجيل الدخول.');
    if (/email not confirmed/i.test(msg)) msg = t('Please verify your email first. Check your inbox for the verification link.','يرجى تأكيد بريدك الإلكتروني أولاً. تحقق من صندوق الوارد.');
    else if (/invalid login/i.test(msg)) msg = t('Incorrect email or password.','البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    return showMsg('login', msg);
  }
  await AFAuth.mergeGuestCart();
  showMsg('login', t('Welcome back! Signing you in…','مرحباً بعودتك! جارٍ تسجيل الدخول…'), 'success');
  setTimeout(function () {
    /* Mid-checkout interruption takes priority — resume it, stay put (checkout no longer even requires login, but keep this path intact for safety). */
    try {
      if (sessionStorage.getItem('af-pending-checkout') === '1') {
        sessionStorage.removeItem('af-pending-checkout');
        closeModal();
        setTimeout(function () {
          var btn = document.getElementById('cartProceed');
          if (btn) btn.click();
        }, 1400);
        return;
      }
    } catch (_) {}
    /* Otherwise: land on the Dashboard after login, never leave the user on Products. */
    closeModal();
    if (!/\/pages\/account\.html$/.test(location.pathname)) {
      location.href = '/pages/account.html?lang=' + (IS_AR ? 'ar' : 'en') + '#overview';
    }
  }, 900);
}

async function handleSignup(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const d = {
    firstName: form.first_name.value.trim(),
    lastName:  form.last_name.value.trim(),
    email:     form.email.value.trim(),
    mobile:    form.mobile.value.trim(),
    password:  form.password.value,
  };
  if (!d.firstName || !d.lastName) return showMsg('signup', t('Please enter your first and last name.','يرجى إدخال الاسم الأول واسم العائلة.'));
  if (!EMAIL_RE.test(d.email)) return showMsg('signup', t('Please enter a valid email address.','يرجى إدخال بريد إلكتروني صحيح.'));
  if (!strongPassword(d.password)) return showMsg('signup', t('Password must be at least 8 characters and include a letter and a number.','يجب أن تكون كلمة المرور 8 أحرف على الأقل وتتضمن حرفاً ورقماً.'));
  if (d.password !== form.confirm.value) return showMsg('signup', t('Passwords do not match.','كلمتا المرور غير متطابقتين.'));
  if (!form.terms.checked) return showMsg('signup', t('Please accept the Terms & Privacy Policy.','يرجى الموافقة على الشروط وسياسة الخصوصية.'));
  setLoading(form, true);
  const res = await AFAuth.signUp(d);
  setLoading(form, false);
  if (res.error) return showMsg('signup', res.error.message || t('Sign up failed.','فشل إنشاء الحساب.'));
  showMsg('signup', t('Account created! Check your email to verify your address before logging in.','تم إنشاء الحساب! تحقق من بريدك لتأكيد عنوانك قبل تسجيل الدخول.'), 'success');
  form.reset();
}

async function handleForgot(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const email = form.email.value.trim();
  if (!EMAIL_RE.test(email)) return showMsg('forgot', t('Please enter a valid email address.','يرجى إدخال بريد إلكتروني صحيح.'));
  setLoading(form, true);
  const res = await AFAuth.sendPasswordReset(email);
  setLoading(form, false);
  if (res.error) return showMsg('forgot', res.error.message);
  showMsg('forgot', t('If an account exists for that email, a reset link is on its way.','إذا كان هناك حساب بهذا البريد، فسيصلك رابط إعادة التعيين.'), 'success');
}

async function handleGoogle(e) {
  e.preventDefault();
  const tabPanel = e.currentTarget.closest('.af-panel');
  const tab = tabPanel ? tabPanel.getAttribute('data-af-panel') : 'login';
  const res = await AFAuth.signInWithGoogle();
  if (res && res.error) {
    var m = res.error.message || '';
    /* Provider not turned on in Supabase yet → friendly guidance */
    if (/provider is not enabled|unsupported provider/i.test(m)) {
      m = t('Google sign-in is not available yet — please sign in with your email and password.',
            'تسجيل الدخول عبر Google غير متاح حالياً — يرجى استخدام البريد الإلكتروني وكلمة المرور.');
    }
    showMsg(tab, m);
  }
  /* On success Supabase redirects the browser to Google. */
}

/* ════════════════════════════════════════════════════════════════
   ACCOUNT CONTROL (nav) + DROPDOWN
   ════════════════════════════════════════════════════════════════ */
const MENU = [
  ['overview',      t('My Profile','ملفي الشخصي')],
  ['orders',        t('My Orders','طلباتي')],
  ['wishlist',      t('Wishlist','المفضلة')],
  ['addresses',     t('Saved Addresses','العناوين المحفوظة')],
  ['notifications', t('Notifications','الإشعارات')],
  ['settings',      t('Account Settings','إعدادات الحساب')],
];
function acctHref(section) { return '/pages/account.html?lang=' + (IS_AR ? 'ar' : 'en') + '#' + section; }

function initials(user) {
  const m = user && user.user_metadata ? user.user_metadata : {};
  const fn = (m.first_name || '').trim(), ln = (m.last_name || '').trim();
  if (fn || ln) return ((fn[0] || '') + (ln[0] || '')).toUpperCase();
  const e = (user && user.email) || '?';
  return e.slice(0, 2).toUpperCase();
}
function displayName(user) {
  const m = user && user.user_metadata ? user.user_metadata : {};
  if (m.full_name) return m.full_name;
  if (m.first_name) return m.first_name;
  return (user && user.email) ? user.email.split('@')[0] : t('Account','الحساب');
}

/* Build the login button OR avatar control inside every [data-af-account] host */
function renderAccountControls(user) {
  const hosts = document.querySelectorAll('[data-af-account]');
  hosts.forEach(function (host) {
    host.innerHTML = '';
    if (!user) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'af-login-btn';
      btn.setAttribute('data-af-login', '');
      btn.innerHTML = '<span class="af-login-ico">' + ICON.user + '</span><span class="af-login-text">' + t('Login','تسجيل الدخول') + '</span>';
      host.appendChild(btn);
    } else {
      const wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'af-acct-btn';
      wrap.setAttribute('data-af-acct', '');
      wrap.setAttribute('aria-haspopup', 'true');
      wrap.setAttribute('aria-expanded', 'false');
      const m = user.user_metadata || {};
      const avatar = m.avatar_url
        ? '<img class="af-avatar" src="' + m.avatar_url + '" alt="" width="30" height="30">'
        : '<span class="af-avatar af-avatar--initials">' + initials(user) + '</span>';
      wrap.innerHTML = avatar + '<span class="af-acct-name">' + displayName(user) + '</span><span class="af-acct-caret">' + ICON.caret + '</span>';
      host.appendChild(wrap);
    }
  });
  /* Products toolbar button = the ONLY login entry point. It becomes the
     e-commerce user menu (avatar/initial + name) once logged in. */
  const pf = document.getElementById('pfLoginBtn');
  if (pf) {
    if (user) {
      pf.classList.add('is-authed');
      pf.setAttribute('aria-haspopup', 'true');
      const m = user.user_metadata || {};
      const av = m.avatar_url
        ? '<img class="af-avatar" src="' + m.avatar_url + '" alt="" width="22" height="22">'
        : '<span class="af-avatar af-avatar--initials" style="width:22px;height:22px;font-size:10px;">' + initials(user) + '</span>';
      pf.innerHTML = av + '<span class="pf-login-text">' + displayName(user) + '</span>';
    } else {
      pf.classList.remove('is-authed');
      pf.removeAttribute('aria-haspopup');
      pf.innerHTML = '<span class="af-login-ico" style="display:inline-flex;width:16px;height:16px;">' + ICON.user +
        '</span><span class="pf-login-text">' + t('Login','تسجيل الدخول') + '</span>';
    }
  }
}

function buildDropdown() {
  if (dropdownEl) return dropdownEl;
  const el = document.createElement('div');
  el.className = 'af-dropdown';
  el.id = 'afDropdown';
  el.setAttribute('role', 'menu');
  el.hidden = true;
  document.body.appendChild(el);
  dropdownEl = el;
  document.addEventListener('click', function (e) {
    if (!dropdownEl || dropdownEl.hidden) return;
    if (!dropdownEl.contains(e.target) && !e.target.closest('[data-af-acct], #pfLoginBtn.is-authed')) closeDropdown();
  });
  window.addEventListener('resize', closeDropdown);
  return el;
}

function openDropdown(trigger, user) {
  buildDropdown();
  const m = user.user_metadata || {};
  dropdownEl.innerHTML =
    '<div class="af-dd-head">' +
      (m.avatar_url ? '<img class="af-avatar" src="' + m.avatar_url + '" alt="" width="40" height="40">'
                    : '<span class="af-avatar af-avatar--initials af-avatar--lg">' + initials(user) + '</span>') +
      '<div class="af-dd-id"><div class="af-dd-name">' + displayName(user) + '</div><div class="af-dd-email">' + (user.email || '') + '</div></div>' +
    '</div>' +
    '<nav class="af-dd-menu">' +
      MENU.map(function (it) {
        return '<a class="af-dd-item" role="menuitem" href="' + acctHref(it[0]) + '">' + it[1] + '</a>';
      }).join('') +
      '<button type="button" class="af-dd-item af-dd-logout" role="menuitem" data-af-logout>' + t('Logout','تسجيل الخروج') + '</button>' +
    '</nav>';
  dropdownEl.querySelector('[data-af-logout]').addEventListener('click', async function () {
    closeDropdown();
    await AFAuth.signOut();
    location.href = '/products';
  });
  /* Position under trigger (RTL-aware) */
  const r = trigger.getBoundingClientRect();
  dropdownEl.hidden = false;
  const w = dropdownEl.offsetWidth || 240;
  let left = IS_AR ? r.left : r.right - w;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  dropdownEl.style.top = (r.bottom + 10) + 'px';
  dropdownEl.style.left = left + 'px';
  requestAnimationFrame(function () { dropdownEl.classList.add('is-open'); });
  trigger.setAttribute('aria-expanded', 'true');
}

function closeDropdown() {
  if (!dropdownEl || dropdownEl.hidden) return;
  dropdownEl.classList.remove('is-open');
  setTimeout(function () { if (dropdownEl) dropdownEl.hidden = true; }, 200);
  document.querySelectorAll('[data-af-acct]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
}

/* ════════════════════════════════════════════════════════════════
   NAV INJECTION + GLOBAL EVENT DELEGATION
   ════════════════════════════════════════════════════════════════ */
/* The main site stays fully public — the ONLY login entry point is the
   Products toolbar button (#pfLoginBtn). We do NOT inject any account
   control into the main navigation. (Pages that genuinely need an inline
   account control, e.g. account.html, carry their own [data-af-account]
   host in markup; renderAccountControls() still populates those.) */

/* ── Route protection: gate commerce actions behind login ──────────────
   Capture phase runs before products.js's bubble handlers, so stopping
   propagation here cleanly cancels the action and opens the login modal.
   Guests keep full browse/search/filter/details/checkout access — only
   wishlist requires an account. Cart checkout (#cartProceed) must behave
   exactly like single-product ordering: no login required. ── */
const PROTECTED_ACTIONS = '.btn-wishlist';
document.addEventListener('click', function (e) {
  const hit = e.target.closest(PROTECTED_ACTIONS);
  if (!hit) return;
  if (AFAuth.currentUser()) return;        // logged in → let the app handle it
  e.preventDefault();
  e.stopImmediatePropagation();            // block products.js handlers
  openModal('login');
}, true);

/* Global ESC — close the modal regardless of where focus currently is
   (a handler bound only to the overlay misses ESC when focus is on body). */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeModal();
});

/* One delegated click listener handles every trigger regardless of when
   it was rendered (toolbar button is created by product-filter.js later). */
document.addEventListener('click', function (e) {
  const loginTrigger = e.target.closest('[data-af-login], #pfLoginBtn');
  if (loginTrigger) {
    const user = AFAuth.currentUser();
    if (user) {
      /* logged in → toggle dropdown */
      if (dropdownEl && !dropdownEl.hidden) { closeDropdown(); }
      else { openDropdown(loginTrigger, user); }
    } else {
      openModal('login');
    }
    return;
  }
  const acct = e.target.closest('[data-af-acct]');
  if (acct) {
    const user = AFAuth.currentUser();
    if (user) {
      if (dropdownEl && !dropdownEl.hidden) closeDropdown();
      else openDropdown(acct, user);
    }
  }
});

/* React to auth state */
AFAuth.onChange(function (user) {
  renderAccountControls(user);
  if (!user) closeDropdown();
});

/* Boot */
function boot() {
  renderAccountControls(AFAuth.currentUser());
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* Expose openers for programmatic use */
AFAuth.openModal = openModal;
AFAuth.closeModal = closeModal;
