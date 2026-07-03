'use strict';

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var currentEmail = '';
  var resendTimer = null;

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
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Please wait…'; }
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
      var err = new Error(data.error || 'Something went wrong.');
      if (data.retryAfter) err.retryAfter = data.retryAfter;
      throw err;
    }
    return data;
  }

  function showOtpStep() {
    $('loginForm').classList.add('ad-hidden');
    $('otpForm').classList.remove('ad-hidden');
    $('stepTitle').textContent = 'Enter Verification Code';
    $('stepSub').textContent = 'We sent a 6-digit code to ' + currentEmail;
    $('otpCode').value = '';
    setTimeout(function () { $('otpCode').focus(); }, 50);
    startResendCooldown(60);
  }
  function showLoginStep() {
    $('otpForm').classList.add('ad-hidden');
    $('loginForm').classList.remove('ad-hidden');
    $('stepTitle').textContent = 'Admin Sign In';
    $('stepSub').textContent = 'AL FAROOQUE Manufacturing — Enterprise Admin Portal';
    hideMsg();
  }

  function startResendCooldown(seconds) {
    clearInterval(resendTimer);
    var remaining = seconds;
    var btn = $('resendBtn');
    btn.disabled = true;
    btn.textContent = 'Resend code (' + remaining + 's)';
    resendTimer = setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        clearInterval(resendTimer);
        btn.disabled = false;
        btn.textContent = 'Resend code';
      } else {
        btn.textContent = 'Resend code (' + remaining + 's)';
      }
    }, 1000);
  }

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    hideMsg();
    var email = $('email').value.trim();
    var password = $('password').value;
    var btn = $('loginBtn');
    setLoading(btn, true, 'Signing in…');
    try {
      var data = await call('login', { email: email, password: password });
      currentEmail = data.email || email;
      showMsg(data.message || 'A code has been sent to your email.', 'success');
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
    setLoading(btn, true, 'Verifying…');
    try {
      await call('verify-otp', { email: currentEmail, code: code });
      showMsg('Success — redirecting…', 'success');
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
      showMsg(data.message || 'A new code has been sent.', 'success');
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
        showMsg('A 6-digit code has been sent to your email.', 'success');
        showOtpStep();
      }
    })
    .catch(function () {});
})();
