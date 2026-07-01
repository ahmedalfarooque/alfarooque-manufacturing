/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Account dashboard v2.0 (Premium redesign)
   Overview stats · profile · orders · wishlist · addresses ·
   notifications · settings · change password. Guards page (login
   required), hash-routes, bilingual. Uses AFAuth.
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
  gateTitle:['Please log in','يرجى تسجيل الدخول'],
  gateMsg:['Sign in to view your account, orders and wishlist.','سجّل الدخول لعرض حسابك وطلباتك ومفضلتك.'],
  gateBtn:['Login','تسجيل الدخول'],
  mOverview:['Dashboard','الرئيسية'], mProfile:['My Profile','ملفي الشخصي'],
  mOrders:['My Orders','طلباتي'], mWishlist:['Wishlist','المفضلة'],
  mAddresses:['Saved Addresses','العناوين المحفوظة'], mNotif:['Notifications','الإشعارات'],
  mSettings:['Account Settings','إعدادات الحساب'], mPassword:['Change Password','تغيير كلمة المرور'],
  mLogout:['Logout','تسجيل الخروج'],
  editProfile:['Edit','تعديل'],
  verified:['Verified','مُوثّق'], unverified:['Unverified','غير مُوثّق'],
  customerRole:['Customer','عميل'], adminRole:['Admin','مدير'], managerRole:['Manager','مشرف'],
  welcomeBack:['Welcome back','مرحباً بعودتك'],
  welcomeSub:["Here's what's happening with your account.",'إليك آخر مستجدات حسابك.'],
  browseProducts:['Browse Products','تصفّح المنتجات'],
  statOrders:['Orders','الطلبات'], statOrdersDesc:['Total placed','إجمالي الطلبات'],
  statWish:['Wishlist','المفضلة'], statWishDesc:['Saved products','المنتجات المحفوظة'],
  statAddr:['Addresses','العناوين'], statAddrDesc:['Saved locations','المواقع المحفوظة'],
  statPending:['Pending','قيد الانتظار'], statPendingDesc:['Active orders','طلبات نشطة'],
  statCompleted:['Completed','مكتملة'], statCompletedDesc:['Finished orders','طلبات منتهية'],
  statTotal:['Purchased','المشتريات'], statTotalDesc:['SAR lifetime','القيمة الإجمالية'],
  activeStatus:['Active','نشط'],
  currentPassword:['Current Password','كلمة المرور الحالية'],
  completeTitle:['Complete your profile','أكمل ملفك الشخصي'],
  completeCta:['Add your details →','أضف بياناتك →'],
  recentOrders:['Recent Orders','الطلبات الأخيرة'], viewAll:['View All →','عرض الكل →'],
  cartSummary:['Your Cart','سلة التسوقك'], cartBrowse:['Browse Products →','تصفّح المنتجات →'],
  noRecentOrders:['No recent orders','لا توجد طلبات حديثة'],
  pProfile:['My Profile','ملفي الشخصي'], pOrders:['My Orders','طلباتي'],
  pWishlist:['Wishlist','المفضلة'], pAddresses:['Saved Addresses','العناوين المحفوظة'],
  pNotif:['Notifications','الإشعارات'], pSettings:['Account Settings','إعدادات الحساب'],
  pPassword:['Change Password','تغيير كلمة المرور'],
  changePhoto:['Change Photo','تغيير الصورة'], removePhoto:['Remove','إزالة'],
  photoHint:['JPG or PNG, up to ~2 MB.','JPG أو PNG، حتى ~2 ميغابايت.'],
  personalInfo:['Personal Information','المعلومات الشخصية'],
  companyInfo:['Company Information','معلومات الشركة'],
  firstName:['First Name','الاسم الأول'], lastName:['Last Name','اسم العائلة'],
  email:['Email','البريد الإلكتروني'], mobile:['Mobile','الجوال'],
  gender:['Gender','الجنس'], genderNone:['Prefer not to say','أفضل عدم الذكر'],
  genderMale:['Male','ذكر'], genderFemale:['Female','أنثى'],
  birthdate:['Date of Birth','تاريخ الميلاد'],
  company:['Company (optional)','الشركة (اختياري)'],
  country:['Country','الدولة'], city:['City','المدينة'],
  postal:['Postal Code','الرمز البريدي'], address:['Address','العنوان'],
  saveChanges:['Save Changes','حفظ التغييرات'],
  addAddress:['Add Address','إضافة عنوان'],
  addrLabel:['Label','التسمية'], addrPhone:['Phone','الهاتف'], addrLine:['Address','العنوان'],
  saveAddress:['Save Address','حفظ العنوان'], cancel:['Cancel','إلغاء'],
  filterAll:['All','الكل'], filterPending:['Pending','قيد الانتظار'],
  filterConfirmed:['Confirmed','مؤكد'], filterProcessing:['Processing','جاري المعالجة'],
  filterCompleted:['Completed','مكتمل'], filterCancelled:['Cancelled','ملغي'],
  orderView:['View','عرض'],
  markAllRead:['Mark all as read','تعليم الكل كمقروء'],
  preferenceSettings:['Preferences','التفضيلات'], accountInfo:['Account Information','معلومات الحساب'],
  notifSettings:['Notification Settings','إعدادات الإشعارات'], dangerZone:['Danger Zone','المنطقة الخطرة'],
  setTheme:['Theme','المظهر'], setLang:['Language','اللغة'],
  setMember:['Member since','عضو منذ'], setVerified:['Email verified','تأكيد البريد'],
  setRole:['Account type','نوع الحساب'],
  toggleTheme:['Toggle','تبديل'], switchLanguage:['Switch','تبديل'],
  setEmailNotif:['Email Notifications','إشعارات البريد'],
  setEmailNotifSub:['Order updates and confirmations','تحديثات الطلبات'],
  setWhatsapp:['WhatsApp Notifications','إشعارات واتساب'],
  setWhatsappSub:['Receive updates via WhatsApp','استقبل التحديثات عبر واتساب'],
  setMarketing:['Marketing Emails','رسائل تسويقية'],
  setMarketingSub:['Promotions and new arrivals','العروض والمنتجات الجديدة'],
  signOutTitle:['Sign out','تسجيل الخروج'],
  signOutSub:['Sign out of your account on this device.','سجّل الخروج من حسابك على هذا الجهاز.'],
  newPassword:['New Password','كلمة المرور الجديدة'],
  confirmPassword:['Confirm Password','تأكيد كلمة المرور'],
  updatePassword:['Update Password','تحديث كلمة المرور'],
  ruleLen:['At least 8 characters','على الأقل 8 أحرف'],
  ruleLetter:['Contains a letter','يحتوي على حرف'],
  ruleNumber:['Contains a number','يحتوي على رقم'],
  strengthWeak:['Weak','ضعيفة'], strengthFair:['Fair','متوسطة'],
  strengthGood:['Good','جيدة'], strengthStrong:['Strong','قوية'],
  memberSince:['Member since','عضو منذ'],
  noOrders:['No orders yet','لا توجد طلبات بعد'],
  noOrdersSub:['Start shopping to see your orders here.','ابدأ التسوق لعرض طلباتك هنا.'],
  startShopping:['Start Shopping →','ابدأ التسوق →'],
  noResults:['No results found','لا توجد نتائج'],
  noResultsSub:['Try a different filter or search term.','جرّب فلتراً أو كلمة بحث مختلفة.'],
  noWishlist:['No saved products yet','لا توجد منتجات محفوظة بعد'],
  noWishlistSub:['Browse products and tap the heart icon to save them.','تصفّح المنتجات واضغط على أيقونة القلب لحفظها.'],
  browseNow:['Browse Products →','تصفّح المنتجات →'],
  noAddresses:['No saved addresses','لا توجد عناوين محفوظة'],
  noAddressesSub:['Add a shipping address to speed up checkout.','أضف عنوان شحن لتسريع إتمام الطلب.'],
  allCaughtUp:["You're all caught up",'أنت على اطلاع بكل شيء'],
  noNotifSub:['No notifications yet. We'll notify you about orders and updates.','لا توجد إشعارات حتى الآن. سنُعلمك بالطلبات والتحديثات.'],
};

function applyI18n() {
  $$('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (I18N[k]) el.textContent = I18N[k][IS_AR ? 1 : 0];
  });
  document.title = t('My Account — AL FAROOQUE','حسابي — الفاروقي');
  /* placeholder for search input */
  const si = $('#orderSearch');
  if (si) si.placeholder = t('Search orders...','بحث في الطلبات...');
}

const SEC_LABEL = {
  overview:'mOverview', profile:'mProfile', orders:'mOrders', wishlist:'mWishlist',
  addresses:'mAddresses', notifications:'mNotif', settings:'mSettings', password:'mPassword'
};

/* ── Gate / routing ── */
function showGate(loggedIn) { $('#acctGate').hidden = loggedIn; $('#acctShell').hidden = !loggedIn; }

function showSection(sec) {
  const valid = ['overview','profile','orders','wishlist','addresses','notifications','settings','password'];
  if (valid.indexOf(sec) === -1) sec = 'overview';
  $$('.acct-panel').forEach(p => { p.hidden = p.getAttribute('data-panel') !== sec; });
  $$('#acctMenu a').forEach(a => a.classList.toggle('is-active', a.getAttribute('data-sec') === sec));
  const lbl = $('#acctCurrentLabel');
  if (lbl && I18N[SEC_LABEL[sec]]) lbl.textContent = I18N[SEC_LABEL[sec]][IS_AR ? 1 : 0];
  const side = $('#acctSide'); if (side) side.classList.remove('is-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goTo(sec) { location.hash = '#' + sec; showSection(sec); }

/* ── Utility helpers ── */
function initials(user, prof) {
  const fn = (prof && prof.first_name) || (user.user_metadata && user.user_metadata.first_name) || '';
  const ln = (prof && prof.last_name)  || (user.user_metadata && user.user_metadata.last_name)  || '';
  if (fn || ln) return ((fn[0]||'') + (ln[0]||'')).toUpperCase();
  return (user.email || '?').slice(0,2).toUpperCase();
}

function msg(el, text, kind) {
  el.textContent = text; el.hidden = false;
  el.className = 'af-msg af-msg--' + (kind || 'error');
}

function emptyState(icon, title, sub, href, cta) {
  return '<div class="acct-empty">' +
    '<div class="acct-empty-icon">' + icon + '</div>' +
    '<div class="acct-empty-title">' + esc(title) + '</div>' +
    '<div class="acct-empty-sub">' + esc(sub) + '</div>' +
    (href && cta ? '<div class="acct-empty-cta"><a href="' + href + '">' + esc(cta) + '</a></div>' : '') +
    '</div>';
}

function animateCounter(el, target) {
  if (!el || typeof target !== 'number') return;
  const dur = 700, start = Date.now();
  const step = () => {
    const p = Math.min(1, (Date.now() - start) / dur);
    el.textContent = Math.round(p * target);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

function getCartCount() {
  try {
    const data = JSON.parse(localStorage.getItem('afq-products-cart') || '[]');
    if (Array.isArray(data)) return data.reduce((s, i) => s + (Number(i.qty) || 1), 0);
  } catch(e) {}
  return 0;
}

/* ── Cart info for dashboard overview ── */
function loadCart() {
  const cartEl    = $('#ovCartCount');
  const cartValEl = $('#ovCartValue');
  const cartListEl= $('#ovCartItems');
  if (!cartEl && !cartValEl && !cartListEl) return;

  let meta = null;
  try { meta = JSON.parse(localStorage.getItem('afq-cart-meta') || 'null'); } catch(e){}

  /* Fallback: count from raw cart array */
  if (!meta) {
    try {
      const raw = JSON.parse(localStorage.getItem('afq-products-cart') || '[]');
      meta = { count: raw.reduce((s, i) => s + (Number(i.qty)||1), 0), grand: 0, items: [] };
    } catch(e) { meta = { count: 0, grand: 0, items: [] }; }
  }

  if (cartEl)     cartEl.textContent    = meta.count || 0;
  if (cartValEl)  cartValEl.textContent = meta.count ? ('SAR ' + Number(meta.grand || 0).toLocaleString('en-US', {maximumFractionDigits:0})) : '—';
  if (cartListEl) {
    if (!meta.count) {
      cartListEl.innerHTML = '<p style="color:var(--tx-3);font-size:13px">' + t('Your cart is empty','سلة التسوق فارغة') + '</p>';
    } else {
      const items = (meta.items || []).slice(0, 3);
      cartListEl.innerHTML = items.map(function(it) {
        const name = IS_AR ? (it.nameAr || it.nameEn) : (it.nameEn || it.nameAr);
        return '<div class="acct-cart-item">' +
          '<span class="acct-cart-item-name">' + esc(name) + '</span>' +
          '<span class="acct-cart-item-qty">×' + esc(it.qty) + '</span>' +
          '<span class="acct-cart-item-price">SAR ' + Number(it.lineTotal || 0).toLocaleString('en-US',{maximumFractionDigits:0}) + '</span>' +
        '</div>';
      }).join('') + (meta.items.length > 3 ? '<p style="color:var(--tx-3);font-size:12px;margin-top:6px">+' + (meta.items.length-3) + ' ' + t('more items','عناصر أخرى') + '</p>' : '');
    }
  }
}

/* ── Avatar display ── */
function setAvatar(url, ini) {
  const img = $('#profAvatarImg'), sp = $('#profAvatar'), rm = $('#profPhotoRemove'), side = $('#acctAvatar');
  const bannerImg = $('#profBannerImg'), bannerIni = $('#profBannerIni');
  if (url) {
    img.src = url; img.hidden = false; sp.hidden = true; if (rm) rm.hidden = false;
    if (side) { side.style.backgroundImage = 'url(' + url + ')'; side.style.backgroundSize = 'cover'; side.style.backgroundPosition = 'center'; side.textContent = ''; }
    if (bannerImg) { bannerImg.src = url; bannerImg.hidden = false; }
    if (bannerIni) bannerIni.hidden = true;
  } else {
    img.hidden = true; img.removeAttribute('src'); sp.hidden = false; sp.textContent = ini; if (rm) rm.hidden = true;
    if (side) { side.style.backgroundImage = ''; side.textContent = ini; }
    if (bannerImg) { bannerImg.hidden = true; bannerImg.removeAttribute('src'); }
    if (bannerIni) { bannerIni.hidden = false; bannerIni.textContent = ini; }
  }
}

/* ── State ── */
let CURRENT = { user: null, profile: null };
let ALL_ORDERS = [];
let currentFilter = 'all';

/* ── Hydrate ── */
async function hydrate(user) {
  CURRENT.user = user;
  const ini = initials(user);
  const headName = (user.user_metadata && user.user_metadata.full_name) || (user.email || '').split('@')[0];

  /* Sidebar user card */
  $('#acctName').textContent = headName;
  $('#acctEmail').textContent = user.email || '';
  $('#acctAvatar').textContent = ini;
  $('#profAvatar').textContent = ini;
  $('#ovName').textContent = (user.user_metadata && user.user_metadata.first_name) || headName;

  /* Verified badge */
  const verified = !!user.email_confirmed_at;
  const vBadge = $('#acctVerifiedBadge');
  if (vBadge) vBadge.hidden = !verified;

  /* Hero card */
  const heroAv = $('#heroAvatar');
  if (heroAv) heroAv.textContent = ini;
  const heroNm = $('#heroName');
  if (heroNm) heroNm.textContent = headName;
  const heroEm = $('#heroEmail');
  if (heroEm) heroEm.textContent = user.email || '';
  const heroVB = $('#heroVerifiedBadge');
  if (heroVB) heroVB.hidden = !verified;

  /* Profile banner (profile panel) */
  const profBannerIni = $('#profBannerIni');
  if (profBannerIni) profBannerIni.textContent = ini;
  const profBannerNm = $('#profBannerName');
  if (profBannerNm) profBannerNm.textContent = headName;
  const profBannerEm = $('#profBannerEmail');
  if (profBannerEm) profBannerEm.textContent = user.email || '';

  /* Member since */
  const since = user.created_at ? new Date(user.created_at).toLocaleDateString(IS_AR ? 'ar-SA' : 'en-GB', {year:'numeric',month:'short'}) : '—';
  const msEl = $('#acctMemberSince');
  if (msEl) msEl.textContent = t('Member since ','عضو منذ ') + since;
  const heroSince = $('#heroMemberSince');
  if (heroSince) heroSince.textContent = t('Member since ','عضو منذ ') + since;

  /* Settings panel */
  $('#setTheme').textContent   = document.documentElement.classList.contains('light') ? t('Light','فاتح') : t('Dark','داكن');
  $('#setLang').textContent    = IS_AR ? 'العربية' : 'English';
  $('#setSince').textContent   = since;
  $('#setVerified').textContent = verified ? t('Yes ✓','نعم ✓') : t('No','لا');

  /* Profile form from metadata first */
  const m = user.user_metadata || {};
  const f = $('#profForm');
  f.first_name.value = m.first_name || '';
  f.last_name.value  = m.last_name  || '';
  f.email.value      = user.email   || '';
  f.mobile.value     = m.mobile     || '';

  /* Overlay with DB profile */
  const pr = await AFAuth.getProfile();
  const d  = (pr && pr.data) || {};
  CURRENT.profile = d;
  if (d.first_name) f.first_name.value = d.first_name;
  if (d.last_name)  f.last_name.value  = d.last_name;
  if (d.mobile)     f.mobile.value     = d.mobile;
  f.country.value   = d.country    || '';
  f.city.value      = d.city       || '';
  f.address.value   = d.address    || '';
  if (f.gender)      f.gender.value      = d.gender      || '';
  if (f.birthdate)   f.birthdate.value   = d.birthdate   || '';
  if (f.company)     f.company.value     = d.company     || '';
  if (f.postal_code) f.postal_code.value = d.postal_code || '';
  setAvatar(d.avatar_url || '', ini);
  /* Profile banner phone */
  const profBannerPh = $('#profBannerPhone');
  if (profBannerPh) profBannerPh.textContent = d.mobile || '';
  /* Update profile banner name from full DB profile */
  const fullName = [d.first_name, d.last_name].filter(Boolean).join(' ') || headName;
  const profBannerNm2 = $('#profBannerName');
  if (profBannerNm2) profBannerNm2.textContent = fullName;

  /* Role badge */
  const roleMap = { admin:t('Admin','مدير'), manager:t('Manager','مشرف') };
  const roleText = roleMap[d.role] || t('Customer','عميل');
  $('#setRole').textContent = roleText;
  const roleBadge = $('#acctRoleBadge');
  if (roleBadge) roleBadge.textContent = roleText;
  const heroRoleBadge = $('#heroRoleBadge');
  if (heroRoleBadge) heroRoleBadge.textContent = roleText;

  computeCompleteness();
  loadCart();
  loadStats();
  loadOrders();
  loadWishlist();
  loadAddresses();
  loadNotifications();
}

/* ── Profile completeness ── */
function computeCompleteness() {
  const f = $('#profForm');
  const fields = [
    f.first_name.value, f.last_name.value, f.mobile.value,
    f.city.value, f.country.value, f.address.value,
    f.gender && f.gender.value, f.birthdate && f.birthdate.value,
    (CURRENT.profile || {}).avatar_url
  ];
  const filled = fields.filter(v => v && String(v).trim()).length;
  const pct = Math.round((filled / fields.length) * 100);
  $('#completePct').textContent = pct + '%';
  $('#completeBar').style.width = pct + '%';
  $('#acctComplete').hidden = pct >= 100;
}

/* ── Stats ── */
async function loadStats() {
  const [ords, wish, addr] = await Promise.all([
    AFAuth.getOrders(), AFAuth.getWishlist(), AFAuth.getAddresses()
  ]);
  const orders = (ords && ords.data) || [];
  const wishCt = (wish && wish.data ? wish.data.length : 0);
  const addrCt = (addr && addr.data ? addr.data.length : 0);

  animateCounter($('#statOrders'), orders.length);
  animateCounter($('#statWish'),   wishCt);
  animateCounter($('#statAddr'),   addrCt);

  /* Pending / completed breakdown */
  const ACTIVE_ST = ['pending','confirmed','processing'];
  const pendingCt   = orders.filter(o => ACTIVE_ST.includes((o.status||'').toLowerCase())).length;
  const completedCt = orders.filter(o => (o.status||'').toLowerCase() === 'completed').length;
  animateCounter($('#statPending'),   pendingCt);
  animateCounter($('#statCompleted'), completedCt);

  /* Hero quick stats */
  animateCounter($('#heroQOrders'), orders.length);
  animateCounter($('#heroQWish'),   wishCt);
  animateCounter($('#heroQAddr'),   addrCt);

  /* Profile banner quick stats */
  animateCounter($('#profBannerOrders'), orders.length);
  animateCounter($('#profBannerWish'),   wishCt);
  animateCounter($('#profBannerAddr'),   addrCt);

  /* Total purchased */
  const total = orders.reduce((s, o) => s + (Number(o.grand_total) || 0), 0);
  const totalEl = $('#statTotal');
  if (totalEl) totalEl.textContent = total.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/* ── Orders ── */
async function loadOrders() {
  const res = await AFAuth.getOrders();
  ALL_ORDERS = (res && res.data) || [];
  renderOrders();
  loadRecentOrders();
}

function renderOrders() {
  const el = $('#ordersBody'); if (!el) return;
  const search = ($('#orderSearch') ? $('#orderSearch').value : '').toLowerCase().trim();

  const rows = ALL_ORDERS.filter(o => {
    const st = (o.status || '').toLowerCase();
    const okFilter = currentFilter === 'all' || st === currentFilter;
    const term = (o.order_no || o.id || '') + ' ' + (o.status || '');
    const okSearch = !search || term.toLowerCase().includes(search);
    return okFilter && okSearch;
  });

  if (!ALL_ORDERS.length) {
    el.innerHTML = emptyState('📦', t('No orders yet','لا توجد طلبات بعد'),
      t('Start shopping to see your orders here.','ابدأ التسوق لعرض طلباتك هنا.'),
      '/products', t('Start Shopping →','ابدأ التسوق →'));
    return;
  }
  if (!rows.length) {
    el.innerHTML = emptyState('🔍', t('No results found','لا توجد نتائج'),
      t('Try a different filter or search term.','جرّب فلتراً أو كلمة بحث مختلفة.'));
    return;
  }

  const money = n => 'SAR ' + Number(n || 0).toLocaleString('en-US');
  const stClass = s => (['pending','confirmed','processing','completed','cancelled'].includes(s) ? s : 'pending');
  const ST_LABEL = {
    pending: t('Pending','قيد الانتظار'), confirmed: t('Confirmed','مؤكد'),
    processing: t('Processing','جاري المعالجة'), completed: t('Completed','مكتمل'),
    cancelled: t('Cancelled','ملغي')
  };

  el.innerHTML = '<div class="acct-orders-list">' +
    rows.map(o => {
      const st = (o.status || 'pending').toLowerCase();
      const num = esc(o.order_no || '#' + String(o.id || '').slice(0,8).toUpperCase());
      const date = new Date(o.created_at).toLocaleDateString(IS_AR ? 'ar-SA' : 'en-GB', {year:'numeric',month:'short',day:'numeric'});
      const items = (o.items && o.items.length) || 0;
      return '<div class="acct-order-card">' +
        '<div class="acct-order-card-head">' +
          '<span class="acct-order-card-num">' + num + '</span>' +
          '<span class="acct-order-status acct-order-status--' + esc(stClass(st)) + '">' + esc(ST_LABEL[st] || o.status || 'Pending') + '</span>' +
        '</div>' +
        '<div class="acct-order-card-body">' +
          '<span class="acct-order-card-date">📅 ' + esc(date) + '</span>' +
          '<span class="acct-order-card-items">📦 ' + items + ' ' + t('items','عناصر') + '</span>' +
          '<span class="acct-order-card-total">' + money(o.grand_total) + '</span>' +
        '</div>' +
        '<div class="acct-order-card-actions">' +
          '<button class="acct-order-btn">' + t('View Details','تفاصيل الطلب') + '</button>' +
          '<button class="acct-order-btn">' + t('Invoice','الفاتورة') + '</button>' +
          '<button class="acct-order-btn">' + t('Reorder','إعادة الطلب') + '</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
}

function loadRecentOrders() {
  const el = $('#ovRecentOrders'); if (!el) return;
  const recent = ALL_ORDERS.slice(0, 3);
  if (!recent.length) {
    el.innerHTML = '<p style="color:var(--tx-3);font-size:13px;text-align:center;padding:18px 0">' + t('No recent orders','لا توجد طلبات حديثة') + '</p>';
    return;
  }
  const money = n => 'SAR ' + Number(n || 0).toLocaleString('en-US');
  const stClass = s => (['pending','confirmed','processing','completed','cancelled'].includes(s) ? s : 'pending');
  el.innerHTML = '<div class="acct-recent-orders-list">' +
    recent.map(o => {
      const st = (o.status || 'pending').toLowerCase();
      const num = esc(o.order_no || '#' + String(o.id || '').slice(0,8).toUpperCase());
      const date = new Date(o.created_at).toLocaleDateString(IS_AR ? 'ar-SA' : 'en-GB', {month:'short', day:'numeric'});
      return '<div class="acct-recent-order-card">' +
        '<div class="acct-recent-order-left">' +
          '<div>' +
            '<div class="acct-recent-order-num">' + num + '</div>' +
            '<div class="acct-recent-order-date">' + esc(date) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="acct-recent-order-right">' +
          '<span class="acct-order-status acct-order-status--' + esc(stClass(st)) + '">' + esc(o.status || 'pending') + '</span>' +
          '<span class="acct-recent-order-total">' + money(o.grand_total) + '</span>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
}

/* ── Wishlist ── */
async function loadWishlist() {
  const el = $('#wishBody'); if (!el) return;
  const res = await AFAuth.getWishlist();
  const ids = (res && res.data ? res.data : []).map(r => r.product_id);
  if (!ids.length) {
    el.innerHTML = emptyState('♥',
      t('No saved products yet','لا توجد منتجات محفوظة بعد'),
      t('Browse products and tap the heart icon to save them.','تصفّح المنتجات واضغط على أيقونة القلب لحفظها.'),
      '/products', t('Browse Products →','تصفّح المنتجات →'));
    return;
  }
  el.innerHTML = ids.map(id =>
    '<div class="acct-wish-card">' +
      '<div class="acct-wish-img">📦</div>' +
      '<div class="acct-wish-body">' +
        '<div class="acct-wish-name">' + t('Product','منتج') + ' #' + esc(id) + '</div>' +
        '<div class="acct-wish-cat">' + t('Saved item','منتج محفوظ') + '</div>' +
        '<div class="acct-wish-actions">' +
          '<button class="acct-wish-rm" data-rm="' + esc(id) + '">' + t('Remove','حذف') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  ).join('');
  $$('[data-rm]', el).forEach(b => b.addEventListener('click', async () => {
    await AFAuth.toggleWishlist(b.getAttribute('data-rm'), false);
    loadWishlist(); loadStats();
  }));
}

/* ── Addresses ── */
async function loadAddresses() {
  const el = $('#addrBody'); if (!el) return;
  const res = await AFAuth.getAddresses();
  const rows = (res && res.data) || [];
  if (!rows.length) {
    el.innerHTML = emptyState('📍',
      t('No saved addresses','لا توجد عناوين محفوظة'),
      t('Add a shipping address to speed up checkout.','أضف عنوان شحن لتسريع إتمام الطلب.'));
    return;
  }
  el.innerHTML = '<div class="acct-addr-grid">' +
    rows.map((a, i) =>
      '<div class="acct-addr-card">' +
        '<div class="acct-addr-top">' +
          '<span class="acct-addr-label">' + esc(a.label || t('Address','عنوان')) + '</span>' +
          (i === 0 ? '<span class="acct-addr-default">' + t('Default','افتراضي') + '</span>' : '') +
        '</div>' +
        '<div class="acct-addr-text">' + [a.line1, a.city, a.country].filter(Boolean).map(esc).join(', ') + '</div>' +
        (a.phone ? '<div class="acct-addr-phone">' + esc(a.phone) + '</div>' : '') +
        '<div class="acct-addr-actions">' +
          '<button class="acct-addr-del" data-del="' + a.id + '">' + t('Delete','حذف') + '</button>' +
        '</div>' +
      '</div>'
    ).join('') + '</div>';
  $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => {
    await AFAuth.deleteAddress(b.getAttribute('data-del'));
    loadAddresses(); loadStats();
  }));
}

/* ── Notifications ── */
function loadNotifications() {
  const el = $('#notifBody'); if (!el) return;
  /* Show professional empty state — no live notifications table in schema */
  el.innerHTML = '<div class="acct-notif is-read">' +
    '<div class="acct-notif-dot-col"><span class="acct-notif-dot"></span></div>' +
    '<div class="acct-notif-ico">👋</div>' +
    '<div class="acct-notif-body">' +
      '<div class="acct-notif-title">' + t('Welcome to AL FAROOQUE','مرحباً في الفاروقي') + '</div>' +
      '<div class="acct-notif-sub">' + t('Your account is set up and ready to use.','حسابك جاهز للاستخدام.') + '</div>' +
      '<div class="acct-notif-time">' + t('Just now','الآن') + '</div>' +
    '</div>' +
  '</div>' +
  '<div class="acct-notif is-read">' +
    '<div class="acct-notif-dot-col"><span class="acct-notif-dot"></span></div>' +
    '<div class="acct-notif-ico">🔔</div>' +
    '<div class="acct-notif-body">' +
      '<div class="acct-notif-title">' + t('Notifications enabled','الإشعارات مفعّلة') + '</div>' +
      '<div class="acct-notif-sub">' + t("We'll notify you about order updates, quotes, and more.","سنُعلمك بتحديثات الطلبات والعروض والمزيد.") + '</div>' +
      '<div class="acct-notif-time">' + t('Today','اليوم') + '</div>' +
    '</div>' +
  '</div>';
}

/* ── Password strength ── */
function checkStrength(pw) {
  const wrap  = $('#pwStrengthWrap');
  if (!wrap) return;
  if (!pw) { wrap.hidden = true; return; }
  wrap.hidden = false;
  const len     = pw.length >= 8;
  const letter  = /[A-Za-z]/.test(pw);
  const num     = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);

  /* Rules checklist */
  const setRule = (id, met) => {
    const el = $('#' + id); if (!el) return;
    el.classList.toggle('is-met', met);
    const icon = el.querySelector('.rule-icon');
    if (icon) icon.textContent = met ? '✓' : '✗';
  };
  setRule('ruleLen',    len);
  setRule('ruleLetter', letter);
  setRule('ruleNumber', num);

  /* Bar strength */
  const score = [len, letter, num, special].filter(Boolean).length;
  const bars   = $$('.acct-strength-bar', wrap);
  const colors = ['s1','s2','s3','s4'];
  const color  = colors[score - 1] || 's1';
  bars.forEach((b, i) => { b.className = 'acct-strength-bar' + (i < score ? ' ' + color : ''); });

  const labels = [t('Weak','ضعيفة'), t('Fair','متوسطة'), t('Good','جيدة'), t('Strong','قوية')];
  const lbl = $('#pwStrengthLabel');
  if (lbl) lbl.textContent = score > 0 ? labels[score - 1] : '';
}

/* ── Wire all event handlers ── */
function wire() {
  /* Save profile */
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
    btn.disabled = false;
    if (res && res.error) {
      res = await AFAuth.updateProfile(base);
      if (res && res.error) return msg($('#profMsg'), res.error.message, 'error');
      msg($('#profMsg'), t('Saved. To store extra fields, run schema.sql update.','تم الحفظ. لحفظ الحقول الإضافية شغّل تحديث schema.sql.'), 'success');
    } else {
      msg($('#profMsg'), t('Profile saved ✓','تم حفظ الملف الشخصي ✓'), 'success');
    }
    CURRENT.profile = Object.assign(CURRENT.profile || {}, base, extra);
    $('#acctName').textContent = base.full_name || $('#acctName').textContent;
    $('#ovName').textContent   = base.first_name || $('#ovName').textContent;
    computeCompleteness();
  });

  /* Avatar upload */
  $('#profPhoto').addEventListener('change', async function () {
    const file = this.files && this.files[0]; if (!file) return;
    if (file.size > 3 * 1024 * 1024) return msg($('#profMsg'), t('Image is too large (max ~3 MB).','الصورة كبيرة جداً (بحد أقصى ~3 ميغابايت).'), 'error');
    msg($('#profMsg'), t('Uploading photo…','جارٍ رفع الصورة…'), 'success');
    try {
      const url = AFAuth.uploadAvatar ? await AFAuth.uploadAvatar(file) : null;
      if (url) {
        CURRENT.profile = Object.assign(CURRENT.profile || {}, { avatar_url: url });
        setAvatar(url, initials(CURRENT.user));
        msg($('#profMsg'), t('Photo updated ✓','تم تحديث الصورة ✓'), 'success');
        computeCompleteness();
      } else {
        msg($('#profMsg'), t('Could not upload the photo.','تعذّر رفع الصورة.'), 'error');
      }
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
    const curPw = $('#pwCurrent') ? $('#pwCurrent').value : '';
    const pw = $('#pwNew').value, pw2 = $('#pwConf').value;
    if (!curPw)
      return msg($('#pwMsg'), t('Please enter your current password.','يرجى إدخال كلمة المرور الحالية.'));
    if (!pw || pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw))
      return msg($('#pwMsg'), t('Password must be at least 8 characters and include a letter and a number.','يجب أن تكون كلمة المرور 8 أحرف على الأقل وتتضمن حرفاً ورقماً.'));
    if (pw !== pw2)
      return msg($('#pwMsg'), t('Passwords do not match.','كلمتا المرور غير متطابقتين.'));
    const btn = e.currentTarget.querySelector('button[type=submit]'); btn.disabled = true;
    const res = await AFAuth.updatePassword(pw); btn.disabled = false;
    if (res && res.error) return msg($('#pwMsg'), res.error.message, 'error');
    msg($('#pwMsg'), t('Password updated ✓','تم تحديث كلمة المرور ✓'), 'success');
    e.currentTarget.reset();
    checkStrength('');
  });

  /* Password show/hide toggles */
  $$('.acct-pw-eye').forEach(btn => btn.addEventListener('click', function () {
    const inp = $('#' + this.getAttribute('data-target'));
    if (!inp) return;
    const visible = inp.type === 'text';
    inp.type = visible ? 'password' : 'text';
    const show = this.querySelector('.eye-show'), hide = this.querySelector('.eye-hide');
    if (show) show.hidden = !visible;
    if (hide) hide.hidden = visible;
  }));

  /* Password strength meter */
  const pwNew = $('#pwNew');
  if (pwNew) pwNew.addEventListener('input', function () { checkStrength(this.value); });

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
    f.reset(); $('#addrMsg').hidden = true; $('#addrForm').hidden = true;
    loadAddresses(); loadStats();
  });

  /* Orders search */
  const orderSearch = $('#orderSearch');
  if (orderSearch) orderSearch.addEventListener('input', renderOrders);

  /* Orders filter chips */
  $$('.acct-chip', $('#orderFilterChips')).forEach(chip => {
    chip.addEventListener('click', function () {
      $$('.acct-chip', $('#orderFilterChips')).forEach(c => c.classList.remove('is-active'));
      this.classList.add('is-active');
      currentFilter = this.getAttribute('data-filter') || 'all';
      renderOrders();
    });
  });

  /* Mark all notifications read */
  const markAllBtn = $('#markAllReadBtn');
  if (markAllBtn) markAllBtn.addEventListener('click', () => {
    $$('.acct-notif').forEach(n => n.classList.add('is-read'));
    $$('.acct-notif-dot').forEach(d => { d.style.background = 'var(--bd-2)'; });
  });

  /* Theme toggle in settings */
  const themeBtn = $('#themeToggleBtn');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const isLight = document.documentElement.classList.contains('light');
    document.documentElement.classList.toggle('light', !isLight);
    document.body.classList.toggle('light', !isLight);
    localStorage.setItem('theme', isLight ? 'dark' : 'light');
    const themeEl = $('#setTheme');
    if (themeEl) themeEl.textContent = !isLight ? t('Light','فاتح') : t('Dark','داكن');
  });

  /* Language toggle in settings */
  const langBtn = $('#langToggleBtn');
  if (langBtn) langBtn.addEventListener('click', () => {
    const newLang = IS_AR ? 'en' : 'ar';
    localStorage.setItem('language', newLang);
    location.href = location.pathname + '?lang=' + newLang + (location.hash || '');
  });

  /* data-go navigation (stat cards + quick links + edit profile button) */
  $$('[data-go]').forEach(el => el.addEventListener('click', e => {
    if (el.tagName === 'A') e.preventDefault();
    goTo(el.getAttribute('data-go'));
  }));

  /* Mobile sidebar toggle */
  const tgl = $('#acctSideToggle');
  if (tgl) tgl.addEventListener('click', () => $('#acctSide').classList.toggle('is-open'));
  $$('#acctMenu a').forEach(a => a.addEventListener('click', () => {
    const s = $('#acctSide'); if (s) s.classList.remove('is-open');
  }));

  /* Logout */
  $$('[data-af-logout]').forEach(b => b.addEventListener('click', async () => {
    await AFAuth.signOut(); location.href = '/products';
  }));
}

/* ── Boot ── */
applyI18n();
wire();
window.addEventListener('hashchange', () => showSection(location.hash.replace('#', '')));
AFAuth.onChange(user => {
  showGate(!!user);
  if (user) { hydrate(user); showSection(location.hash.replace('#', '') || 'overview'); }
});
