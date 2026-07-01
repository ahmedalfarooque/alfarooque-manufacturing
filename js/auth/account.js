/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Account dashboard controller
   Guards the page (login required), hash-routes sections, loads/saves
   the profile, change password, wishlist, orders & addresses.
   Bilingual via stored language. Depends on window.AFAuth.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';
import AFAuth from './auth.js';

const IS_AR = document.documentElement.lang === 'ar';
const t = (en, ar) => (IS_AR ? ar : en);
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

/* ── i18n strings for [data-i18n] ── */
const I18N = {
  brand:['AL FAROOQUE','الفاروقي'], gateTitle:['Please log in','يرجى تسجيل الدخول'],
  gateMsg:['Sign in to view your account, orders and wishlist.','سجّل الدخول لعرض حسابك وطلباتك ومفضلتك.'],
  gateBtn:['Login','تسجيل الدخول'],
  mProfile:['My Profile','ملفي الشخصي'], mOrders:['My Orders','طلباتي'], mWishlist:['Wishlist','المفضلة'],
  mSaved:['Saved Products','المنتجات المحفوظة'], mAddresses:['Saved Addresses','العناوين المحفوظة'],
  mNotif:['Notifications','الإشعارات'],
  mSettings:['Account Settings','إعدادات الحساب'], mPassword:['Change Password','تغيير كلمة المرور'], mLogout:['Logout','تسجيل الخروج'],
  pProfile:['My Profile','ملفي الشخصي'], pOrders:['My Orders','طلباتي'], pWishlist:['Wishlist','المفضلة'],
  pSaved:['Saved Products','المنتجات المحفوظة'], pAddresses:['Saved Addresses','العناوين المحفوظة'],
  pNotif:['Notifications','الإشعارات'],
  pSettings:['Account Settings','إعدادات الحساب'], pPassword:['Change Password','تغيير كلمة المرور'],
  changePhoto:['Change Photo','تغيير الصورة'], firstName:['First Name','الاسم الأول'], lastName:['Last Name','اسم العائلة'],
  email:['Email','البريد الإلكتروني'], mobile:['Mobile','الجوال'], country:['Country','الدولة'], city:['City','المدينة'],
  address:['Address','العنوان'], saveChanges:['Save Changes','حفظ التغييرات'],
  newPassword:['New Password','كلمة المرور الجديدة'], confirmPassword:['Confirm Password','تأكيد كلمة المرور'],
  updatePassword:['Update Password','تحديث كلمة المرور'],
  setTheme:['Theme','المظهر'], setLang:['Language','اللغة'], setMember:['Member since','عضو منذ'], setVerified:['Email verified','تأكيد البريد'],
};
function applyI18n() {
  $$('[data-i18n]').forEach(function (el) {
    const k = el.getAttribute('data-i18n');
    if (I18N[k]) el.textContent = I18N[k][IS_AR ? 1 : 0];
  });
  document.title = t('My Account — AL FAROOQUE','حسابي — الفاروقي');
}

/* ── Gate ── */
function showGate(loggedIn) {
  $('#acctGate').hidden = loggedIn;
  $('#acctShell').hidden = !loggedIn;
}

/* ── Section routing ── */
function showSection(sec) {
  const valid = ['profile','orders','wishlist','saved','addresses','notifications','settings','password'];
  if (valid.indexOf(sec) === -1) sec = 'profile';
  $$('.acct-panel').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== sec; });
  $$('#acctMenu a').forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-sec') === sec); });
}

/* ── Helpers ── */
function initials(user, prof) {
  const fn = (prof && prof.first_name) || (user.user_metadata && user.user_metadata.first_name) || '';
  const ln = (prof && prof.last_name)  || (user.user_metadata && user.user_metadata.last_name)  || '';
  if (fn || ln) return ((fn[0]||'') + (ln[0]||'')).toUpperCase();
  return (user.email || '?').slice(0,2).toUpperCase();
}
function msg(el, text, kind) { el.textContent = text; el.hidden = false; el.className = 'af-msg af-msg--' + (kind||'error'); }

/* ── Load everything for the signed-in user ── */
async function hydrate(user) {
  const headName = (user.user_metadata && user.user_metadata.full_name) || user.email;
  $('#acctName').textContent = headName;
  $('#acctEmail').textContent = user.email || '';
  const ini = initials(user);
  $('#acctAvatar').textContent = ini;
  $('#profAvatar').textContent = ini;

  /* Settings */
  $('#setTheme').textContent = document.documentElement.classList.contains('light') ? t('Light','فاتح') : t('Dark','داكن');
  $('#setLang').textContent = IS_AR ? 'العربية' : 'English';
  $('#setSince').textContent = user.created_at ? new Date(user.created_at).toLocaleDateString(IS_AR ? 'ar-SA' : 'en-GB') : '—';
  $('#setVerified').textContent = user.email_confirmed_at ? t('Yes ✓','نعم ✓') : t('No','لا');

  /* Profile form */
  const m = user.user_metadata || {};
  const form = $('#profForm');
  form.first_name.value = m.first_name || '';
  form.last_name.value  = m.last_name || '';
  form.email.value      = user.email || '';
  form.mobile.value     = m.mobile || '';

  const pr = await AFAuth.getProfile();
  if (pr && pr.data) {
    const d = pr.data;
    form.first_name.value = d.first_name || form.first_name.value;
    form.last_name.value  = d.last_name  || form.last_name.value;
    form.mobile.value     = d.mobile     || form.mobile.value;
    form.country.value    = d.country    || '';
    form.city.value       = d.city       || '';
    form.address.value    = d.address    || '';
    if (d.avatar_url) {
      const img = '<img class="af-avatar af-avatar--xl" src="' + d.avatar_url + '" alt="" style="width:84px;height:84px;">';
      $('#profAvatar').outerHTML = img;
    }
  }

  loadWishlist();
  loadOrders();
  loadAddresses();
  loadNotifications();
}

/* ── Notifications (empty state for new accounts) ── */
function loadNotifications() {
  const el = $('#notifBody'); if (!el) return;
  el.innerHTML = '<div class="acct-empty">' +
    t("You're all caught up — no notifications yet.",'لا توجد إشعارات حتى الآن.') + '</div>';
}

/* ── Wishlist / Saved (same data source) ── */
async function loadWishlist() {
  const res = await AFAuth.getWishlist();
  const ids = (res && res.data ? res.data : []).map(function (r) { return r.product_id; });
  const empty = '<div class="acct-empty">' + t('No saved products yet.','لا توجد منتجات محفوظة بعد.') +
    ' <a href="/products">' + t('Browse products →','تصفّح المنتجات →') + '</a></div>';
  const render = ids.length
    ? ids.map(function (id) {
        return '<div class="acct-wish-item"><span>#' + id + '</span>' +
          '<button class="acct-wish-rm" data-rm="' + id + '">' + t('Remove','حذف') + '</button></div>';
      }).join('')
    : empty;
  $('#wishBody').innerHTML = render;
  $('#savedBody').innerHTML = render;
  $$('[data-rm]').forEach(function (b) {
    b.addEventListener('click', async function () {
      await AFAuth.toggleWishlist(b.getAttribute('data-rm'), false);
      loadWishlist();
    });
  });
}

/* ── Orders (placeholder structure + empty state) ── */
async function loadOrders() {
  /* Orders table exists in schema; none yet for new users → friendly empty state. */
  $('#ordersBody').innerHTML =
    '<div class="acct-orders-head">' +
      '<span>' + t('Order #','رقم الطلب') + '</span><span>' + t('Status','الحالة') + '</span>' +
      '<span>' + t('Items','العناصر') + '</span><span>' + t('Total','الإجمالي') + '</span>' +
      '<span>' + t('Date','التاريخ') + '</span><span>' + t('Invoice','الفاتورة') + '</span>' +
    '</div>' +
    '<div class="acct-empty">' + t('You have no orders yet.','ليس لديك طلبات بعد.') +
    ' <a href="/products">' + t('Start shopping →','ابدأ التسوق →') + '</a></div>';
}

/* ── Addresses (basic list + empty state) ── */
async function loadAddresses() {
  $('#addrBody').innerHTML =
    '<div class="acct-empty">' + t('No saved addresses yet. Add one at checkout.','لا توجد عناوين محفوظة بعد.') + '</div>';
}

/* ── Wire forms ── */
function wireForms() {
  /* Save profile */
  $('#profForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const f = e.currentTarget;
    const fields = {
      first_name: f.first_name.value.trim(),
      last_name:  f.last_name.value.trim(),
      full_name:  (f.first_name.value.trim() + ' ' + f.last_name.value.trim()).trim(),
      mobile:     f.mobile.value.trim(),
      country:    f.country.value.trim(),
      city:       f.city.value.trim(),
      address:    f.address.value.trim(),
    };
    const btn = f.querySelector('.af-submit'); btn.disabled = true;
    const res = await AFAuth.updateProfile(fields);
    btn.disabled = false;
    if (res && res.error) return msg($('#profMsg'), res.error.message, 'error');
    msg($('#profMsg'), t('Profile saved ✓','تم حفظ الملف الشخصي ✓'), 'success');
    $('#acctName').textContent = fields.full_name || $('#acctName').textContent;
  });

  /* Change password */
  $('#pwForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const pw = $('#pwNew').value, pw2 = $('#pwConf').value;
    if (!pw || pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw))
      return msg($('#pwMsg'), t('Password must be at least 8 characters and include a letter and a number.','يجب أن تكون كلمة المرور 8 أحرف على الأقل وتتضمن حرفاً ورقماً.'));
    if (pw !== pw2) return msg($('#pwMsg'), t('Passwords do not match.','كلمتا المرور غير متطابقتين.'));
    const btn = e.currentTarget.querySelector('.af-submit'); btn.disabled = true;
    const res = await AFAuth.updatePassword(pw);
    btn.disabled = false;
    if (res && res.error) return msg($('#pwMsg'), res.error.message, 'error');
    msg($('#pwMsg'), t('Password updated ✓','تم تحديث كلمة المرور ✓'), 'success');
    $('#pwForm').reset();
  });

  /* Avatar upload (stores to the public "avatars" bucket) */
  $('#profPhoto').addEventListener('change', async function () {
    const file = this.files && this.files[0];
    if (!file) return;
    msg($('#profMsg'), t('Uploading photo…','جارٍ رفع الصورة…'), 'success');
    /* Upload helper lives in auth.js via the raw client when configured */
    try {
      const ok = await AFAuth.uploadAvatar ? AFAuth.uploadAvatar(file) : null;
      if (!ok) msg($('#profMsg'), t('Photo upload will be available once storage is configured.','سيتوفر رفع الصورة بعد تهيئة التخزين.'), 'success');
    } catch (e) { msg($('#profMsg'), e.message); }
  });

  /* Logout buttons (also handled globally by auth-ui, but ensure redirect) */
  $$('[data-af-logout]').forEach(function (b) {
    b.addEventListener('click', async function () { await AFAuth.signOut(); location.href = '/products'; });
  });
}

/* ── Boot ── */
applyI18n();
wireForms();

window.addEventListener('hashchange', function () { showSection(location.hash.replace('#','')); });

AFAuth.onChange(function (user) {
  showGate(!!user);
  if (user) {
    hydrate(user);
    showSection(location.hash.replace('#','') || 'profile');
  }
});
