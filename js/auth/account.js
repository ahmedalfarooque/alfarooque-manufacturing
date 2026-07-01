/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Account dashboard controller (e-commerce)
   Overview stats · profile (photo + extended fields) · orders · wishlist
   · addresses CRUD · notifications · settings · change password.
   Guards the page (login required), hash-routes, bilingual. Uses AFAuth.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';
import AFAuth from './auth.js';

const IS_AR = document.documentElement.lang === 'ar';
const t = (en, ar) => (IS_AR ? ar : en);
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* ── i18n ── */
const I18N = {
  brand:['AL FAROOQUE','الفاروقي'], continueShopping:['Continue Shopping','متابعة التسوق'],
  gateTitle:['Please log in','يرجى تسجيل الدخول'], gateMsg:['Sign in to view your account, orders and wishlist.','سجّل الدخول لعرض حسابك وطلباتك ومفضلتك.'], gateBtn:['Login','تسجيل الدخول'],
  mOverview:['Dashboard','الرئيسية'], mProfile:['My Profile','ملفي الشخصي'], mOrders:['My Orders','طلباتي'], mWishlist:['Wishlist','المفضلة'],
  mAddresses:['Saved Addresses','العناوين المحفوظة'], mNotif:['Notifications','الإشعارات'], mSettings:['Account Settings','إعدادات الحساب'],
  mPassword:['Change Password','تغيير كلمة المرور'], mLogout:['Logout','تسجيل الخروج'],
  welcomeBack:['Welcome back','مرحباً بعودتك'], welcomeSub:["Here's what's happening with your account.",'إليك آخر مستجدات حسابك.'],
  browseProducts:['Browse Products','تصفّح المنتجات'],
  statOrders:['Orders','الطلبات'], statWish:['Wishlist','المفضلة'], statAddr:['Addresses','العناوين'], statVerify:['Email status','حالة البريد'],
  completeTitle:['Complete your profile','أكمل ملفك الشخصي'], completeCta:['Add your details →','أضف بياناتك →'],
  pProfile:['My Profile','ملفي الشخصي'], pOrders:['My Orders','طلباتي'], pWishlist:['Wishlist','المفضلة'],
  pAddresses:['Saved Addresses','العناوين المحفوظة'], pNotif:['Notifications','الإشعارات'], pSettings:['Account Settings','إعدادات الحساب'], pPassword:['Change Password','تغيير كلمة المرور'],
  changePhoto:['Change Photo','تغيير الصورة'], removePhoto:['Remove','إزالة'], photoHint:['JPG or PNG, up to ~2 MB.','JPG أو PNG، حتى ~2 ميغابايت.'],
  firstName:['First Name','الاسم الأول'], lastName:['Last Name','اسم العائلة'], email:['Email','البريد الإلكتروني'], mobile:['Mobile','الجوال'],
  gender:['Gender','الجنس'], genderNone:['Prefer not to say','أفضل عدم الذكر'], genderMale:['Male','ذكر'], genderFemale:['Female','أنثى'],
  birthdate:['Date of Birth','تاريخ الميلاد'], company:['Company (optional)','الشركة (اختياري)'], country:['Country','الدولة'], city:['City','المدينة'],
  postal:['Postal Code','الرمز البريدي'], address:['Address','العنوان'], saveChanges:['Save Changes','حفظ التغييرات'],
  addAddress:['+ Add Address','+ إضافة عنوان'], addrLabel:['Label','التسمية'], addrPhone:['Phone','الهاتف'], addrLine:['Address','العنوان'],
  saveAddress:['Save Address','حفظ العنوان'], cancel:['Cancel','إلغاء'],
  newPassword:['New Password','كلمة المرور الجديدة'], confirmPassword:['Confirm Password','تأكيد كلمة المرور'], updatePassword:['Update Password','تحديث كلمة المرور'],
  setTheme:['Theme','المظهر'], setLang:['Language','اللغة'], setMember:['Member since','عضو منذ'], setVerified:['Email verified','تأكيد البريد'], setRole:['Account type','نوع الحساب'],
  signOutTitle:['Sign out','تسجيل الخروج'], signOutSub:['Sign out of your account on this device.','سجّل الخروج من حسابك على هذا الجهاز.'],
};
function applyI18n() {
  $$('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (I18N[k]) el.textContent = I18N[k][IS_AR ? 1 : 0]; });
  document.title = t('My Account — AL FAROOQUE','حسابي — الفاروقي');
}
const SEC_LABEL = { overview:'mOverview', profile:'mProfile', orders:'mOrders', wishlist:'mWishlist', addresses:'mAddresses', notifications:'mNotif', settings:'mSettings', password:'mPassword' };

/* ── Gate / routing ── */
function showGate(loggedIn) { $('#acctGate').hidden = loggedIn; $('#acctShell').hidden = !loggedIn; }
function showSection(sec) {
  const valid = ['overview','profile','orders','wishlist','addresses','notifications','settings','password'];
  if (valid.indexOf(sec) === -1) sec = 'overview';
  $$('.acct-panel').forEach(p => { p.hidden = p.getAttribute('data-panel') !== sec; });
  $$('#acctMenu a').forEach(a => a.classList.toggle('is-active', a.getAttribute('data-sec') === sec));
  const lbl = $('#acctCurrentLabel'); if (lbl && I18N[SEC_LABEL[sec]]) lbl.textContent = I18N[SEC_LABEL[sec]][IS_AR ? 1 : 0];
  const side = $('#acctSide'); if (side) side.classList.remove('is-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goTo(sec) { location.hash = '#' + sec; showSection(sec); }

/* ── Helpers ── */
function initials(user, prof) {
  const fn = (prof && prof.first_name) || (user.user_metadata && user.user_metadata.first_name) || '';
  const ln = (prof && prof.last_name)  || (user.user_metadata && user.user_metadata.last_name)  || '';
  if (fn || ln) return ((fn[0]||'') + (ln[0]||'')).toUpperCase();
  return (user.email || '?').slice(0,2).toUpperCase();
}
function msg(el, text, kind) { el.textContent = text; el.hidden = false; el.className = 'af-msg af-msg--' + (kind||'error'); }

function setAvatar(url, ini) {
  const img = $('#profAvatarImg'), sp = $('#profAvatar'), rm = $('#profPhotoRemove'), side = $('#acctAvatar');
  if (url) {
    img.src = url; img.hidden = false; sp.hidden = true; if (rm) rm.hidden = false;
    if (side) { side.style.backgroundImage = 'url(' + url + ')'; side.style.backgroundSize = 'cover'; side.style.backgroundPosition = 'center'; side.textContent = ''; }
  } else {
    img.hidden = true; img.removeAttribute('src'); sp.hidden = false; sp.textContent = ini; if (rm) rm.hidden = true;
    if (side) { side.style.backgroundImage = ''; side.textContent = ini; }
  }
}

/* ── Hydrate ── */
let CURRENT = { user: null, profile: null };
async function hydrate(user) {
  CURRENT.user = user;
  const ini = initials(user);
  const headName = (user.user_metadata && user.user_metadata.full_name) || (user.email || '').split('@')[0];
  $('#acctName').textContent = headName;
  $('#acctEmail').textContent = user.email || '';
  $('#acctAvatar').textContent = ini;
  $('#profAvatar').textContent = ini;
  $('#ovName').textContent = (user.user_metadata && user.user_metadata.first_name) || headName;

  /* Settings */
  $('#setTheme').textContent = document.documentElement.classList.contains('light') ? t('Light','فاتح') : t('Dark','داكن');
  $('#setLang').textContent = IS_AR ? 'العربية' : 'English';
  $('#setSince').textContent = user.created_at ? new Date(user.created_at).toLocaleDateString(IS_AR ? 'ar-SA' : 'en-GB') : '—';
  const verified = !!user.email_confirmed_at;
  $('#setVerified').textContent = verified ? t('Yes ✓','نعم ✓') : t('No','لا');
  $('#statVerify').textContent  = verified ? t('Verified','مُوثّق') : t('Unverified','غير مُوثّق');
  $('#statVerifyIco').textContent = verified ? '✓' : '!';

  /* Profile form from metadata first */
  const m = user.user_metadata || {};
  const f = $('#profForm');
  f.first_name.value = m.first_name || '';
  f.last_name.value  = m.last_name || '';
  f.email.value      = user.email || '';
  f.mobile.value     = m.mobile || '';

  /* Then overlay DB profile */
  const pr = await AFAuth.getProfile();
  const d = (pr && pr.data) || {};
  CURRENT.profile = d;
  if (d.first_name) f.first_name.value = d.first_name;
  if (d.last_name)  f.last_name.value  = d.last_name;
  if (d.mobile)     f.mobile.value     = d.mobile;
  f.country.value = d.country || '';
  f.city.value    = d.city || '';
  f.address.value = d.address || '';
  if (f.gender)      f.gender.value      = d.gender || '';
  if (f.birthdate)   f.birthdate.value   = d.birthdate || '';
  if (f.company)     f.company.value     = d.company || '';
  if (f.postal_code) f.postal_code.value = d.postal_code || '';
  setAvatar(d.avatar_url || '', ini);

  $('#setRole').textContent = ({ admin:t('Admin','مدير'), manager:t('Manager','مشرف') })[d.role] || t('Customer','عميل');

  computeCompleteness();
  loadStats();
  loadOrders();
  loadWishlist();
  loadAddresses();
  loadNotifications();
}

/* ── Profile completeness ── */
function computeCompleteness() {
  const f = $('#profForm');
  const fields = [f.first_name.value, f.last_name.value, f.mobile.value, f.city.value, f.country.value, f.address.value,
                  f.gender && f.gender.value, f.birthdate && f.birthdate.value, (CURRENT.profile || {}).avatar_url];
  const filled = fields.filter(v => v && String(v).trim()).length;
  const pct = Math.round((filled / fields.length) * 100);
  $('#completePct').textContent = pct + '%';
  $('#completeBar').style.width = pct + '%';
  $('#acctComplete').hidden = pct >= 100;
}

/* ── Stats ── */
async function loadStats() {
  const [ords, wish, addr] = await Promise.all([AFAuth.getOrders(), AFAuth.getWishlist(), AFAuth.getAddresses()]);
  $('#statOrders').textContent = (ords && ords.data ? ords.data.length : 0);
  $('#statWish').textContent   = (wish && wish.data ? wish.data.length : 0);
  $('#statAddr').textContent   = (addr && addr.data ? addr.data.length : 0);
}

/* ── Orders ── */
async function loadOrders() {
  const el = $('#ordersBody'); if (!el) return;
  const res = await AFAuth.getOrders();
  const rows = (res && res.data) || [];
  if (!rows.length) {
    el.innerHTML = '<div class="acct-empty"><span class="acct-empty-ico">📦</span>' +
      t('You have no orders yet.','ليس لديك طلبات بعد.') + '<br><a href="/products">' + t('Start shopping →','ابدأ التسوق →') + '</a></div>';
    return;
  }
  const money = n => 'SAR ' + Number(n || 0).toLocaleString('en-US');
  el.innerHTML =
    '<div style="overflow-x:auto"><table class="acct-table"><thead><tr>' +
    ['#','Status','Items','Total','Date'].map((h,i) => '<th>' + t(h, ['#','الحالة','العناصر','الإجمالي','التاريخ'][i]) + '</th>').join('') +
    '</tr></thead><tbody>' +
    rows.map(o => '<tr>' +
      '<td>' + esc(o.order_no || o.id.slice(0,8)) + '</td>' +
      '<td><span class="acct-order-status">' + esc(o.status || 'pending') + '</span></td>' +
      '<td>' + ((o.items && o.items.length) || 0) + '</td>' +
      '<td>' + money(o.grand_total) + '</td>' +
      '<td>' + new Date(o.created_at).toLocaleDateString(IS_AR ? 'ar-SA' : 'en-GB') + '</td>' +
    '</tr>').join('') + '</tbody></table></div>';
}

/* ── Wishlist ── */
async function loadWishlist() {
  const el = $('#wishBody'); if (!el) return;
  const res = await AFAuth.getWishlist();
  const ids = (res && res.data ? res.data : []).map(r => r.product_id);
  if (!ids.length) {
    el.innerHTML = '<div class="acct-empty"><span class="acct-empty-ico">♥</span>' +
      t('No saved products yet.','لا توجد منتجات محفوظة بعد.') + '<br><a href="/products">' + t('Browse products →','تصفّح المنتجات →') + '</a></div>';
    return;
  }
  el.innerHTML = ids.map(id => '<div class="acct-wish-item"><span>#' + esc(id) + '</span>' +
    '<button class="acct-wish-rm" data-rm="' + esc(id) + '">' + t('Remove','حذف') + '</button></div>').join('');
  $$('[data-rm]', el).forEach(b => b.addEventListener('click', async () => {
    await AFAuth.toggleWishlist(b.getAttribute('data-rm'), false); loadWishlist(); loadStats();
  }));
}

/* ── Addresses (CRUD) ── */
async function loadAddresses() {
  const el = $('#addrBody'); if (!el) return;
  const res = await AFAuth.getAddresses();
  const rows = (res && res.data) || [];
  if (!rows.length) {
    el.innerHTML = '<div class="acct-empty"><span class="acct-empty-ico">📍</span>' + t('No saved addresses yet.','لا توجد عناوين محفوظة بعد.') + '</div>';
    return;
  }
  el.innerHTML = '<div class="acct-addr-grid">' + rows.map(a =>
    '<div class="acct-addr-card">' +
      '<button class="acct-addr-del" data-del="' + a.id + '">' + t('Delete','حذف') + '</button>' +
      '<div class="acct-addr-label">' + esc(a.label || t('Address','عنوان')) + '</div>' +
      '<div class="acct-addr-text">' + [a.line1, a.city, a.country].filter(Boolean).map(esc).join(', ') +
        (a.phone ? '<br>' + esc(a.phone) : '') + '</div>' +
    '</div>').join('') + '</div>';
  $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => {
    await AFAuth.deleteAddress(b.getAttribute('data-del')); loadAddresses(); loadStats();
  }));
}

/* ── Notifications ── */
function loadNotifications() {
  const el = $('#notifBody'); if (!el) return;
  el.innerHTML = '<div class="acct-empty"><span class="acct-empty-ico">🔔</span>' +
    t("You're all caught up — no notifications yet.",'لا توجد إشعارات حتى الآن.') + '</div>';
}

/* ── Forms & actions ── */
function wire() {
  /* Save profile (resilient to missing extra columns) */
  $('#profForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget;
    const base = {
      first_name: f.first_name.value.trim(), last_name: f.last_name.value.trim(),
      full_name: (f.first_name.value.trim() + ' ' + f.last_name.value.trim()).trim(),
      mobile: f.mobile.value.trim(), country: f.country.value.trim(),
      city: f.city.value.trim(), address: f.address.value.trim(),
    };
    const extra = {
      gender: f.gender.value || null, birthdate: f.birthdate.value || null,
      company: f.company.value.trim() || null, postal_code: f.postal_code.value.trim() || null,
    };
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    let res = await AFAuth.updateProfile(Object.assign({}, base, extra));
    if (res && res.error) {
      /* Extra columns may not exist yet → save the core fields anyway */
      res = await AFAuth.updateProfile(base);
      btn.disabled = false;
      if (res && res.error) return msg($('#profMsg'), res.error.message, 'error');
      msg($('#profMsg'), t('Saved. To store gender/birth date/company, run the profile columns update in supabase/schema.sql.',
        'تم الحفظ. لتخزين الجنس/تاريخ الميلاد/الشركة، شغّل تحديث الأعمدة في supabase/schema.sql.'), 'success');
    } else {
      btn.disabled = false;
      msg($('#profMsg'), t('Profile saved ✓','تم حفظ الملف الشخصي ✓'), 'success');
    }
    CURRENT.profile = Object.assign(CURRENT.profile || {}, base, extra);
    $('#acctName').textContent = base.full_name || $('#acctName').textContent;
    $('#ovName').textContent = base.first_name || $('#ovName').textContent;
    computeCompleteness();
  });

  /* Avatar upload */
  $('#profPhoto').addEventListener('change', async function () {
    const file = this.files && this.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return msg($('#profMsg'), t('Image is too large (max ~3 MB).','الصورة كبيرة جداً (بحد أقصى ~3 ميغابايت).'), 'error');
    msg($('#profMsg'), t('Uploading photo…','جارٍ رفع الصورة…'), 'success');
    try {
      const url = AFAuth.uploadAvatar ? await AFAuth.uploadAvatar(file) : null;
      if (url) { CURRENT.profile = Object.assign(CURRENT.profile || {}, { avatar_url: url }); setAvatar(url, initials(CURRENT.user)); msg($('#profMsg'), t('Photo updated ✓','تم تحديث الصورة ✓'), 'success'); computeCompleteness(); }
      else msg($('#profMsg'), t('Could not upload the photo. Please try again.','تعذّر رفع الصورة. حاول مرة أخرى.'), 'error');
    } catch (err) { msg($('#profMsg'), err.message || String(err), 'error'); }
    this.value = '';
  });

  /* Remove photo */
  $('#profPhotoRemove').addEventListener('click', async () => {
    await AFAuth.updateProfile({ avatar_url: null });
    CURRENT.profile = Object.assign(CURRENT.profile || {}, { avatar_url: null });
    setAvatar('', initials(CURRENT.user));
    computeCompleteness();
  });

  /* Change password */
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#pwNew').value, pw2 = $('#pwConf').value;
    if (!pw || pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw))
      return msg($('#pwMsg'), t('Password must be at least 8 characters and include a letter and a number.','يجب أن تكون كلمة المرور 8 أحرف على الأقل وتتضمن حرفاً ورقماً.'));
    if (pw !== pw2) return msg($('#pwMsg'), t('Passwords do not match.','كلمتا المرور غير متطابقتين.'));
    const btn = e.currentTarget.querySelector('button[type=submit]'); btn.disabled = true;
    const res = await AFAuth.updatePassword(pw); btn.disabled = false;
    if (res && res.error) return msg($('#pwMsg'), res.error.message, 'error');
    msg($('#pwMsg'), t('Password updated ✓','تم تحديث كلمة المرور ✓'), 'success'); e.currentTarget.reset();
  });

  /* Address form show/hide + submit */
  $('#addrAddBtn').addEventListener('click', () => { $('#addrForm').hidden = !$('#addrForm').hidden; });
  $('#addrCancel').addEventListener('click', () => { $('#addrForm').hidden = true; });
  $('#addrForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget;
    const a = { label: f.label.value.trim(), phone: f.phone.value.trim(), city: f.city.value.trim(), country: f.country.value.trim(), line1: f.line1.value.trim() };
    if (!a.line1) return msg($('#addrMsg'), t('Please enter the address.','يرجى إدخال العنوان.'));
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    const res = await AFAuth.addAddress(a); btn.disabled = false;
    if (res && res.error) return msg($('#addrMsg'), res.error.message, 'error');
    f.reset(); $('#addrMsg').hidden = true; $('#addrForm').hidden = true; loadAddresses(); loadStats();
  });

  /* data-go navigation (stat cards + quick links) */
  $$('[data-go]').forEach(el => el.addEventListener('click', e => {
    if (el.tagName === 'A') e.preventDefault();
    goTo(el.getAttribute('data-go'));
  }));

  /* Mobile sidebar toggle */
  const tgl = $('#acctSideToggle'); if (tgl) tgl.addEventListener('click', () => $('#acctSide').classList.toggle('is-open'));
  $$('#acctMenu a').forEach(a => a.addEventListener('click', () => { const s = $('#acctSide'); if (s) s.classList.remove('is-open'); }));

  /* Logout */
  $$('[data-af-logout]').forEach(b => b.addEventListener('click', async () => { await AFAuth.signOut(); location.href = '/products'; }));
}

/* ── Boot ── */
applyI18n();
wire();
window.addEventListener('hashchange', () => showSection(location.hash.replace('#','')));
AFAuth.onChange(user => {
  showGate(!!user);
  if (user) { hydrate(user); showSection(location.hash.replace('#','') || 'overview'); }
});
