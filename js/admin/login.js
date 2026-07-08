'use strict';

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var currentEmail = '';
  var resendTimer = null;

  /* ── i18n (presentation only) ──────────────────────────────────────
     Same localStorage key ("language") as the site's language switcher.
     The nav's EN/ع pill (injected by /js/language-switcher.js) normally
     redirects to a "-ar" counterpart page, which doesn't exist for the
     admin login — a capture-phase listener below intercepts it and
     translates this page in place instead. */
  var I18N = {
    en: {
      title: 'Admin Sign In',
      sub: 'AL FAROOQUE Manufacturing — Enterprise Admin Portal',
      otp_title: 'Enter Verification Code',
      otp_sub: 'We sent a 6-digit code to ',
      al_email: 'Email', al_password: 'Password', al_continue: 'Continue',
      al_otp_label: '6-Digit Code', al_verify: 'Verify & Sign In',
      al_resend: 'Resend code', al_back: '← Back to email & password',
      resend_in: function (s) { return 'Resend code (' + s + 's)'; },
      wait: 'Please wait…', signing: 'Signing in…', verifying: 'Verifying…',
      code_sent: 'A code has been sent to your email.',
      code_sent_6: 'A 6-digit code has been sent to your email.',
      new_code: 'A new code has been sent.',
      success: 'Success — redirecting…',
      generic_error: 'Something went wrong.',
    },
    ar: {
      title: 'تسجيل دخول الإدارة',
      sub: 'مصنع الفاروق — بوابة الإدارة',
      otp_title: 'أدخل رمز التحقق',
      otp_sub: 'أرسلنا رمزاً من 6 أرقام إلى ',
      al_email: 'البريد الإلكتروني', al_password: 'كلمة المرور', al_continue: 'متابعة',
      al_otp_label: 'رمز من 6 أرقام', al_verify: 'تحقق وسجّل الدخول',
      al_resend: 'إعادة إرسال الرمز', al_back: '→ الرجوع إلى البريد وكلمة المرور',
      resend_in: function (s) { return 'إعادة إرسال الرمز (' + s + ' ث)'; },
      wait: 'يرجى الانتظار…', signing: 'جارٍ تسجيل الدخول…', verifying: 'جارٍ التحقق…',
      code_sent: 'تم إرسال رمز إلى بريدك الإلكتروني.',
      code_sent_6: 'تم إرسال رمز من 6 أرقام إلى بريدك الإلكتروني.',
      new_code: 'تم إرسال رمز جديد.',
      success: 'تم بنجاح — جارٍ التحويل…',
      generic_error: 'حدث خطأ ما.',
    },
  };
  var LANG = 'en';
  try { LANG = localStorage.getItem('language') === 'ar' ? 'ar' : 'en'; } catch (e) {}
  function t(k) { var d = I18N[LANG] || I18N.en; return k in d ? d[k] : I18N.en[k]; }

  var onOtpStep = false;
  function applyLang() {
    document.documentElement.lang = LANG;
    document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
    /* rtl.css carries unscoped `body{direction:rtl}` rules (Arabic-page-only
       stylesheet) — attach it only while Arabic is active. */
    var sheet = document.getElementById('rtlSheet');
    if (LANG === 'ar' && !sheet) {
      sheet = document.createElement('link');
      sheet.rel = 'stylesheet'; sheet.href = '/css/rtl.css'; sheet.id = 'rtlSheet';
      document.head.appendChild(sheet);
    } else if (LANG !== 'ar' && sheet) {
      sheet.remove();
    }
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-i18n'));
    $('stepTitle').textContent = t(onOtpStep ? 'otp_title' : 'title');
    $('stepSub').textContent = onOtpStep ? (t('otp_sub') + currentEmail) : t('sub');
  }
  /* Intercept the site nav's language pill (capture phase runs before the
     pill's own redirect handler) and switch this page in place. */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.lang-btn') : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var l = btn.getAttribute('data-lang') === 'ar' ? 'ar' : 'en';
    if (l !== LANG) {
      LANG = l;
      try { localStorage.setItem('language', l); } catch (err) {}
      applyLang();
    }
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      var on = b.getAttribute('data-lang') === l;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLang);
  else applyLang();

  /* ── Deep-link handoff ──────────────────────────────────────────────
     Two independent query params can arrive here:
       ?openOrder=<uuid> / ?openQuote=<uuid>  — from the "View Order"
         button in an admin notification email. Carried through to the
         dashboard so it opens that exact record after auth.
       ?otp=1&email=<addr>                    — set when the customer
         login page detected the admin's own credentials, verified the
         password server-side, and already triggered the OTP email.
         Skips straight to the OTP step instead of asking for the
         password again.
       ?email=<addr>  (without otp=1)        — set when a Google sign-in
         resolved to the admin's account. Google never hands us a
         password to verify, so we can't skip ahead — just pre-fill the
         email so the admin only has to type the password. */
  var params = new URLSearchParams(location.search);
  var pendingOrder = params.get('openOrder');
  var pendingQuote = params.get('openQuote');
  var skipToOtpEmail = params.get('otp') === '1' ? params.get('email') : null;
  var prefillEmail = !skipToOtpEmail ? params.get('email') : null;
  if (prefillEmail) $('email').value = prefillEmail;

  function dashboardUrl() {
    var qs = new URLSearchParams();
    if (pendingOrder) qs.set('openOrder', pendingOrder);
    if (pendingQuote) qs.set('openQuote', pendingQuote);
    var s = qs.toString();
    return '/pages/admin/dashboard.html' + (s ? '?' + s : '');
  }

  function showMsg(text, kind) {
    var box = $('msgBox');
    box.textContent = text;
    box.className = 'ad-msg ad-msg--' + (kind || 'error');
    box.classList.remove('ad-hidden');
  }
  function hideMsg() { $('msgBox').classList.add('ad-hidden'); }

  function setLoading(btn, on, label) {
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || t('wait'); }
    else if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }

  async function call(action, extra) {
    var res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
      credentials: 'same-origin',
      body: JSON.stringify(Object.assign({ action: action }, extra)),
    });
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var err = new Error(data.error || t('generic_error'));
      if (data.retryAfter) err.retryAfter = data.retryAfter;
      throw err;
    }
    return data;
  }

  function showOtpStep() {
    onOtpStep = true;
    $('loginForm').classList.add('ad-hidden');
    $('otpForm').classList.remove('ad-hidden');
    $('stepTitle').textContent = t('otp_title');
    $('stepSub').textContent = t('otp_sub') + currentEmail;
    $('otpCode').value = '';
    setTimeout(function () { $('otpCode').focus(); }, 50);
    startResendCooldown(60);
  }
  function showLoginStep() {
    onOtpStep = false;
    $('otpForm').classList.add('ad-hidden');
    $('loginForm').classList.remove('ad-hidden');
    $('stepTitle').textContent = t('title');
    $('stepSub').textContent = t('sub');
    hideMsg();
  }

  function startResendCooldown(seconds) {
    clearInterval(resendTimer);
    var remaining = seconds;
    var btn = $('resendBtn');
    btn.disabled = true;
    btn.textContent = t('resend_in')(remaining);
    resendTimer = setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        clearInterval(resendTimer);
        btn.disabled = false;
        btn.textContent = t('al_resend');
      } else {
        btn.textContent = t('resend_in')(remaining);
      }
    }, 1000);
  }

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    hideMsg();
    var email = $('email').value.trim();
    var password = $('password').value;
    var btn = $('loginBtn');
    setLoading(btn, true, t('signing'));
    try {
      var data = await call('login', { email: email, password: password });
      currentEmail = data.email || email;
      showMsg(data.message || t('code_sent'), 'success');
      showOtpStep();
    } catch (err) {
      showMsg(err.message);
    } finally {
      setLoading(btn, false);
    }
  });

  $('otpForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    hideMsg();
    var code = $('otpCode').value.trim();
    var btn = $('verifyBtn');
    setLoading(btn, true, t('verifying'));
    try {
      await call('verify-otp', { email: currentEmail, code: code });
      showMsg(t('success'), 'success');
      setTimeout(function () { location.href = dashboardUrl(); }, 500);
    } catch (err) {
      showMsg(err.message);
      setLoading(btn, false);
    }
  });

  $('resendBtn').addEventListener('click', async function () {
    hideMsg();
    try {
      var data = await call('resend-otp', { email: currentEmail });
      showMsg(data.message || t('new_code'), 'success');
      startResendCooldown(60);
    } catch (err) {
      showMsg(err.message);
      if (err.retryAfter) startResendCooldown(err.retryAfter);
    }
  });

  $('backBtn').addEventListener('click', function () {
    clearInterval(resendTimer);
    showLoginStep();
  });

  /* If already signed in, skip straight to the dashboard (carrying any
     pending deep-link through) — no need to log in again. */
  fetch('/api/admin/auth', { headers: { 'X-Admin-Request': '1' }, credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (data && data.admin) { location.href = dashboardUrl(); return; }
      /* Not signed in — if we arrived with a verified-password handoff
         from the customer login page, an OTP has already been sent;
         jump straight to entering it instead of asking for the
         password again. */
      if (skipToOtpEmail) {
        currentEmail = skipToOtpEmail;
        showMsg(t('code_sent_6'), 'success');
        showOtpStep();
      }
    })
    .catch(function () {});
})();
