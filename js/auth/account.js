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
  addAddress:['Add Address','إضافة عنوان'], editAddress:['Edit Address','تعديل العنوان'],
  addrLabel:['Label','التسمية'], addrPhone:['Phone','الهاتف'], addrLine:['Full Address','العنوان الكامل'],
  saveAddress:['Save Address','حفظ العنوان'], cancel:['Cancel','إلغاء'],
  state:['State / Region','المنطقة'], searchLocation:['Search for a location…','ابحث عن موقع…'],
  useCurrentLocation:['Use Current Location','استخدام الموقع الحالي'], locating:['Locating…','جارٍ تحديد الموقع…'],
  locationNotFound:['Location not found. Try a different search.','لم يتم العثور على الموقع. جرّب بحثاً مختلفاً.'],
  geoNotSupported:['Location services are not available on this device.','خدمات الموقع غير متاحة على هذا الجهاز.'],
  setDefaultAddr:['Set as default address','تعيين كعنوان افتراضي'],
  dragMarkerHint:['Drag the pin, search, or use your current location to set the address.','اسحب العلامة أو ابحث أو استخدم موقعك الحالي لتحديد العنوان.'],
  mapLoadError:['Could not load the map. Please check your connection.','تعذّر تحميل الخريطة. يرجى التحقق من الاتصال.'],
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
  noNotifSub:['No notifications yet. We will notify you about orders and updates.','لا توجد إشعارات حتى الآن. سنُعلمك بالطلبات والتحديثات.'],
  orderDetails:['Order Details','تفاصيل الطلب'], close:['Close','إغلاق'],
  orderPlaced:['Order Placed','تم الطلب'], orderConfirmed:['Confirmed','تم التأكيد'],
  orderProcessing:['Processing','قيد المعالجة'], orderReady:['Ready','جاهز'],
  orderDelivered:['Delivered','تم التسليم'], orderCancelledTl:['Cancelled','ملغي'],
  reorderAdded:['Items added to your cart ✓','تمت إضافة المنتجات إلى السلة ✓'],
  invoiceSoon:['Invoice download coming soon.','تحميل الفاتورة قريباً.'],
  prevPage:['Previous','السابق'], nextPage:['Next','التالي'],
  pageOf:['Page {n} of {t}','صفحة {n} من {t}'],
  buyNow:['Buy Now','اشترِ الآن'],
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
let ordersPage = 1;
const ORDERS_PER_PAGE = 5;
let _unsubscribeOrders = null;

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

  /* Live sync: re-pull orders + stats the instant admin updates a status
     or tracking field, with no reload needed. */
  if (typeof _unsubscribeOrders === 'function') _unsubscribeOrders();
  _unsubscribeOrders = AFAuth.subscribeOrders(function () {
    loadOrders();
    loadStats();
  });
  loadNotifPrefs();
}

/* ── Notification preference toggles (persisted locally) ── */
function loadNotifPrefs() {
  let prefs = { email: true, whatsapp: false, marketing: false };
  try { prefs = Object.assign(prefs, JSON.parse(localStorage.getItem('afq-notif-prefs') || '{}')); } catch(e) {}
  const em = $('#prefEmailNotif'), wa = $('#prefWhatsapp'), mk = $('#prefMarketing');
  if (em) em.checked = !!prefs.email;
  if (wa) wa.checked = !!prefs.whatsapp;
  if (mk) mk.checked = !!prefs.marketing;
}
function saveNotifPrefs() {
  const prefs = {
    email: $('#prefEmailNotif') ? $('#prefEmailNotif').checked : true,
    whatsapp: $('#prefWhatsapp') ? $('#prefWhatsapp').checked : false,
    marketing: $('#prefMarketing') ? $('#prefMarketing').checked : false,
  };
  localStorage.setItem('afq-notif-prefs', JSON.stringify(prefs));
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

const ORDER_STATUS_LIST = ['pending','confirmed','processing','completed','cancelled'];
const CANCELLABLE_STATUSES = ['pending', 'processing'];
const DELETABLE_STATUSES = ['cancelled', 'completed'];
function stClass(s) { return ORDER_STATUS_LIST.includes(s) ? s : 'pending'; }
function orderStatusLabel(st) {
  const ST_LABEL = {
    pending: t('Pending','قيد الانتظار'), confirmed: t('Confirmed','مؤكد'),
    processing: t('Processing','جاري المعالجة'), completed: t('Completed','مكتمل'),
    cancelled: t('Cancelled','ملغي')
  };
  return ST_LABEL[st] || st;
}
function findOrder(id) { return ALL_ORDERS.find(o => String(o.id) === String(id)); }

function renderOrders() {
  const el = $('#ordersBody'); if (!el) return;
  const search = ($('#orderSearch') ? $('#orderSearch').value : '').toLowerCase().trim();

  const filtered = ALL_ORDERS.filter(o => {
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
  if (!filtered.length) {
    el.innerHTML = emptyState('🔍', t('No results found','لا توجد نتائج'),
      t('Try a different filter or search term.','جرّب فلتراً أو كلمة بحث مختلفة.'));
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE));
  if (ordersPage > totalPages) ordersPage = totalPages;
  const start = (ordersPage - 1) * ORDERS_PER_PAGE;
  const rows = filtered.slice(start, start + ORDERS_PER_PAGE);

  const money = n => 'SAR ' + Number(n || 0).toLocaleString('en-US');

  el.innerHTML = '<div class="acct-orders-list">' +
    rows.map(o => {
      const st = (o.status || 'pending').toLowerCase();
      const num = esc(o.order_no || '#' + String(o.id || '').slice(0,8).toUpperCase());
      const date = new Date(o.created_at).toLocaleDateString(IS_AR ? 'ar-SA' : 'en-GB', {year:'numeric',month:'short',day:'numeric'});
      const items = (o.items && o.items.length) || 0;
      return '<div class="acct-order-card">' +
        '<div class="acct-order-card-head">' +
          '<span class="acct-order-card-num">' + num + '</span>' +
          '<span class="acct-order-status acct-order-status--' + esc(stClass(st)) + '">' + esc(orderStatusLabel(st) || o.status || 'Pending') + '</span>' +
        '</div>' +
        '<div class="acct-order-card-body">' +
          '<span class="acct-order-card-date">📅 ' + esc(date) + '</span>' +
          '<span class="acct-order-card-items">📦 ' + items + ' ' + t('items','عناصر') + '</span>' +
          '<span class="acct-order-card-total">' + money(o.grand_total) + '</span>' +
        '</div>' +
        '<div class="acct-order-card-actions">' +
          '<button class="acct-order-btn" data-view="' + esc(o.id) + '">' + t('View Details','تفاصيل الطلب') + '</button>' +
          '<button class="acct-order-btn" data-invoice="' + esc(o.id) + '">' + t('Invoice','الفاتورة') + '</button>' +
          '<button class="acct-order-btn" data-reorder="' + esc(o.id) + '">' + t('Reorder','إعادة الطلب') + '</button>' +
          (CANCELLABLE_STATUSES.includes(st) ?
            '<button class="acct-order-btn acct-order-btn--danger" data-cancel-order="' + esc(o.id) + '">' + t('Cancel Order','إلغاء الطلب') + '</button>' : '') +
          (DELETABLE_STATUSES.includes(st) ?
            '<button class="acct-order-btn acct-order-btn--danger" data-delete-order="' + esc(o.id) + '">' + t('Delete Order','حذف الطلب') + '</button>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>' +
    (totalPages > 1 ?
      '<div class="acct-pagination">' +
        '<button class="acct-btn-ghost acct-page-btn" id="ordersPrev"' + (ordersPage <= 1 ? ' disabled' : '') + '>' + t('Previous','السابق') + '</button>' +
        '<span class="acct-page-info">' + t('Page ','صفحة ') + ordersPage + t(' of ',' من ') + totalPages + '</span>' +
        '<button class="acct-btn-ghost acct-page-btn" id="ordersNext"' + (ordersPage >= totalPages ? ' disabled' : '') + '>' + t('Next','التالي') + '</button>' +
      '</div>' : '');

  const prevBtn = $('#ordersPrev'), nextBtn = $('#ordersNext');
  if (prevBtn) prevBtn.addEventListener('click', () => { ordersPage--; renderOrders(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { ordersPage++; renderOrders(); });

  $$('[data-view]', el).forEach(b => b.addEventListener('click', () => openOrderModal(b.getAttribute('data-view'))));
  $$('[data-invoice]', el).forEach(b => b.addEventListener('click', () => {
    msg($('#profMsg') && !$('#profMsg').hidden ? $('#profMsg') : ensureToast(), t('Invoice download coming soon.','تحميل الفاتورة قريباً.'), 'success');
  }));
  $$('[data-reorder]', el).forEach(b => b.addEventListener('click', () => reorderOrder(b.getAttribute('data-reorder'))));
  $$('[data-cancel-order]', el).forEach(b => b.addEventListener('click', () => cancelOrderAction(b.getAttribute('data-cancel-order'))));
  $$('[data-delete-order]', el).forEach(b => b.addEventListener('click', () => deleteOrderAction(b.getAttribute('data-delete-order'))));
}

/* ── Cancel an order (Pending/Processing only — enforced above by which
   button even renders) ── */
async function cancelOrderAction(id) {
  if (!window.confirm(t('Are you sure you want to cancel this order?','هل أنت متأكد أنك تريد إلغاء هذا الطلب؟'))) return;
  const res = await AFAuth.cancelOrder(id);
  if (res && res.error) { showToast(t('Could not cancel the order. Please try again.','تعذّر إلغاء الطلب. يرجى المحاولة مرة أخرى.')); return; }
  const o = findOrder(id);
  if (o) o.status = 'cancelled';
  renderOrders();
  showToast(t('Order cancelled successfully.','تم إلغاء الطلب بنجاح.'));
}

/* ── Permanently delete an order (Cancelled/Completed only) ── */
async function deleteOrderAction(id) {
  if (!window.confirm(t('Are you sure you want to permanently delete this order? This action cannot be undone.','هل أنت متأكد أنك تريد حذف هذا الطلب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.'))) return;
  const res = await AFAuth.deleteOrder(id);
  if (res && res.error) { showToast(t('Could not delete the order. Please try again.','تعذّر حذف الطلب. يرجى المحاولة مرة أخرى.')); return; }
  ALL_ORDERS = ALL_ORDERS.filter(o => String(o.id) !== String(id));
  renderOrders();
  showToast(t('Order deleted successfully.','تم حذف الطلب بنجاح.'));
}

/* ── Toast (lightweight, reused for action feedback outside forms) ── */
function ensureToast() {
  let toast = $('#acctToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'acctToast';
    toast.className = 'acct-toast';
    document.body.appendChild(toast);
  }
  return toast;
}
function showToast(text) {
  const toast = ensureToast();
  toast.textContent = text;
  toast.classList.add('is-visible');
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

/* ── Reorder: push order items back into the local cart ── */
function reorderOrder(id) {
  const o = findOrder(id); if (!o) return;
  try {
    const cart = JSON.parse(localStorage.getItem('afq-products-cart') || '[]');
    (o.items || []).forEach(it => {
      const existing = cart.find(c => c.id === it.id || c.product_id === it.id);
      if (existing) existing.qty = (Number(existing.qty) || 1) + (Number(it.qty) || 1);
      else cart.push({ id: it.id || it.product_id, nameEn: it.nameEn || it.name, nameAr: it.nameAr || it.name, price: it.price, qty: it.qty || 1 });
    });
    localStorage.setItem('afq-products-cart', JSON.stringify(cart));
  } catch (e) {}
  showToast(t('Items added to your cart ✓','تمت إضافة المنتجات إلى السلة ✓'));
  loadCart();
}

/* ── Order details modal with visual timeline ── */
const ORDER_TIMELINE_STEPS = [
  { key:'placed',     icon:'📝' },
  { key:'confirmed',  icon:'✅' },
  { key:'processing', icon:'⚙️' },
  { key:'ready',      icon:'📦' },
  { key:'delivered',  icon:'🚚' },
];
function timelineStepIndex(status) {
  const st = (status || 'pending').toLowerCase();
  if (st === 'cancelled') return -1;
  if (st === 'pending') return 0;
  if (st === 'confirmed') return 1;
  if (st === 'processing') return 2;
  if (st === 'completed') return 4;
  return 0;
}
function renderOrderTimeline(o) {
  const st = (o.status || 'pending').toLowerCase();
  if (st === 'cancelled') {
    return '<div class="acct-timeline acct-timeline--cancelled">' +
      '<span class="acct-timeline-cancel-ico">✗</span>' +
      '<span>' + t('This order was cancelled.','تم إلغاء هذا الطلب.') + '</span>' +
    '</div>';
  }
  const activeIdx = timelineStepIndex(st);
  const LABELS = [
    t('Order Placed','تم الطلب'), t('Confirmed','تم التأكيد'),
    t('Processing','قيد المعالجة'), t('Ready','جاهز'), t('Delivered','تم التسليم')
  ];
  return '<div class="acct-timeline">' +
    ORDER_TIMELINE_STEPS.map((step, i) => {
      const state = i < activeIdx ? 'done' : (i === activeIdx ? 'active' : '');
      return '<div class="acct-timeline-step is-' + (state || 'pending') + '">' +
        '<span class="acct-timeline-dot">' + (i < activeIdx ? '✓' : step.icon) + '</span>' +
        '<span class="acct-timeline-label">' + esc(LABELS[i]) + '</span>' +
        (i < ORDER_TIMELINE_STEPS.length - 1 ? '<span class="acct-timeline-line ' + (i < activeIdx ? 'is-done' : '') + '"></span>' : '') +
      '</div>';
    }).join('') +
  '</div>';
}
function openOrderModal(id) {
  const o = findOrder(id); if (!o) return;
  let modal = $('#acctOrderModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'acctOrderModal';
    modal.className = 'acct-modal-overlay';
    modal.innerHTML = '<div class="acct-modal"><button class="acct-modal-close" id="acctModalClose" aria-label="Close">&times;</button><div id="acctModalBody"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeOrderModal(); });
    $('#acctModalClose', modal).addEventListener('click', closeOrderModal);
  }
  const num = esc(o.order_no || '#' + String(o.id || '').slice(0,8).toUpperCase());
  const date = new Date(o.created_at).toLocaleDateString(IS_AR ? 'ar-SA' : 'en-GB', {year:'numeric',month:'short',day:'numeric'});
  const st = (o.status || 'pending').toLowerCase();
  const money = n => 'SAR ' + Number(n || 0).toLocaleString('en-US');
  const items = o.items || [];
  $('#acctModalBody', modal).innerHTML =
    '<h3 class="acct-modal-title">' + t('Order Details','تفاصيل الطلب') + ' — ' + num + '</h3>' +
    '<div class="acct-modal-meta">' +
      '<span class="acct-order-status acct-order-status--' + esc(stClass(st)) + '">' + esc(orderStatusLabel(st)) + '</span>' +
      '<span>📅 ' + esc(date) + '</span>' +
    '</div>' +
    renderOrderTimeline(o) +
    '<div class="acct-modal-items">' +
      (items.length ? items.map(it => (
        '<div class="acct-modal-item">' +
          '<span>' + esc(IS_AR ? (it.nameAr || it.nameEn || it.name) : (it.nameEn || it.nameAr || it.name)) + '</span>' +
          '<span>×' + esc(it.qty || 1) + '</span>' +
          '<span>' + money(it.price ? it.price * (it.qty||1) : it.lineTotal) + '</span>' +
        '</div>'
      )).join('') : '<p style="color:var(--tx-3);font-size:13px">' + t('No item details available.','لا توجد تفاصيل منتجات متاحة.') + '</p>') +
    '</div>' +
    '<div class="acct-modal-total">' + t('Total','الإجمالي') + ': <strong>' + money(o.grand_total) + '</strong></div>';
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeOrderModal() {
  const modal = $('#acctOrderModal');
  if (modal) modal.classList.remove('is-open');
  document.body.style.overflow = '';
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
  /* Load product metadata saved by the products page */
  let wishMeta = {};
  try { wishMeta = JSON.parse(localStorage.getItem('afq-wishlist-meta') || '{}'); } catch(e) {}

  el.innerHTML = '<div class="acct-wish-grid">' + ids.map(id => {
    const m = wishMeta[String(id)] || {};
    const name = IS_AR ? (m.nameAr || m.nameEn || t('Product','منتج') + ' #' + id)
                       : (m.nameEn || m.nameAr || t('Product','منتج') + ' #' + id);
    const price = m.price ? ('SAR ' + Number(m.price).toLocaleString('en-US', {maximumFractionDigits:0})) : '';
    const cat   = m.cat   ? (m.cat.charAt(0).toUpperCase() + m.cat.slice(1)) : t('Saved item','منتج محفوظ');
    return '<div class="acct-wish-card">' +
      '<div class="acct-wish-img">📦</div>' +
      '<div class="acct-wish-body">' +
        '<div class="acct-wish-name">' + esc(name) + '</div>' +
        '<div class="acct-wish-cat">' + esc(cat) + '</div>' +
        (price ? '<div class="acct-wish-price">' + esc(price) + '</div>' : '') +
        '<div class="acct-wish-actions">' +
          '<button class="acct-wish-buy" data-buy="' + esc(id) + '">' + t('Buy Now','اشترِ الآن') + '</button>' +
          '<a class="acct-wish-shop" href="/products">' + t('View in Shop →','عرض في المتجر →') + '</a>' +
          '<button class="acct-wish-rm" data-rm="' + esc(id) + '">' + t('Remove','حذف') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';

  $$('[data-rm]', el).forEach(b => b.addEventListener('click', async () => {
    await AFAuth.toggleWishlist(b.getAttribute('data-rm'), false);
    /* Also remove from local metadata */
    try {
      const wm = JSON.parse(localStorage.getItem('afq-wishlist-meta') || '{}');
      delete wm[String(b.getAttribute('data-rm'))];
      localStorage.setItem('afq-wishlist-meta', JSON.stringify(wm));
    } catch(e) {}
    loadWishlist(); loadStats();
  }));

  $$('[data-buy]', el).forEach(b => b.addEventListener('click', () => {
    const id = b.getAttribute('data-buy');
    const m = wishMeta[String(id)] || {};
    try {
      const cart = JSON.parse(localStorage.getItem('afq-products-cart') || '[]');
      const existing = cart.find(c => String(c.id) === String(id));
      if (existing) existing.qty = (Number(existing.qty) || 1) + 1;
      else cart.push({ id, nameEn: m.nameEn, nameAr: m.nameAr, price: m.price, qty: 1 });
      localStorage.setItem('afq-products-cart', JSON.stringify(cart));
    } catch (e) {}
    location.href = '/products';
  }));
}

/* ── Addresses ── */
let ALL_ADDRESSES = [];

async function loadAddresses() {
  const el = $('#addrBody'); if (!el) return;
  const res = await AFAuth.getAddresses();
  const rows = (res && res.data) || [];
  ALL_ADDRESSES = rows;
  if (!rows.length) {
    el.innerHTML = emptyState('📍',
      t('No saved addresses','لا توجد عناوين محفوظة'),
      t('Add a shipping address to speed up checkout.','أضف عنوان شحن لتسريع إتمام الطلب.'));
    return;
  }
  /* Backward-compat: if no row has is_default set, treat the first as default */
  const hasDefault = rows.some(a => a.is_default);
  el.innerHTML = '<div class="acct-addr-grid">' +
    rows.map((a, i) => {
      const isDefault = hasDefault ? !!a.is_default : i === 0;
      const line2 = [a.city, a.state, a.postal_code].filter(Boolean).join(', ');
      return '<div class="acct-addr-card">' +
        '<div class="acct-addr-top">' +
          '<span class="acct-addr-label">' + esc(a.label || t('Address','عنوان')) + '</span>' +
          (isDefault ? '<span class="acct-addr-default">' + t('Default','افتراضي') + '</span>' : '') +
        '</div>' +
        '<div class="acct-addr-text">' + esc(a.line1 || '') + '</div>' +
        (line2 ? '<div class="acct-addr-text acct-addr-text--sub">' + esc(line2) + (a.country ? ', ' + esc(a.country) : '') + '</div>' : (a.country ? '<div class="acct-addr-text acct-addr-text--sub">' + esc(a.country) + '</div>' : '')) +
        (a.phone ? '<div class="acct-addr-phone">' + esc(a.phone) + '</div>' : '') +
        '<div class="acct-addr-actions">' +
          (isDefault ? '' : '<button class="acct-addr-default-btn" data-set-default="' + esc(a.id) + '">' + t('Set as Default','تعيين كافتراضي') + '</button>') +
          '<button class="acct-addr-edit" data-edit-id="' + esc(a.id) + '">' + t('Edit','تعديل') + '</button>' +
          '<button class="acct-addr-del" data-del="' + esc(a.id) + '">' + t('Delete','حذف') + '</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';

  $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => {
    await AFAuth.deleteAddress(b.getAttribute('data-del'));
    loadAddresses(); loadStats();
  }));
  $$('[data-edit-id]', el).forEach(b => b.addEventListener('click', () => {
    const addr = ALL_ADDRESSES.find(a => String(a.id) === b.getAttribute('data-edit-id'));
    if (addr) addrModal.open(addr);
  }));
  $$('[data-set-default]', el).forEach(b => b.addEventListener('click', async () => {
    const id = b.getAttribute('data-set-default');
    await setDefaultAddress(id);
  }));
}

/* ── Set one address as default, unsetting all others ── */
async function setDefaultAddress(id) {
  await Promise.all(ALL_ADDRESSES.map(a =>
    AFAuth.updateAddress(a.id, { is_default: String(a.id) === String(id) })
  ));
  loadAddresses();
}

/* ── Live map address picker ──────────────────────────────────────────
   Leaflet (map/marker) + OpenStreetMap tiles + Nominatim (search &
   reverse geocoding) — no API key / billing account required. ── */
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const DEFAULT_CENTER = [21.4858, 39.1925]; // Jeddah, Saudi Arabia
let _leafletLoading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (_leafletLoading) return _leafletLoading;
  _leafletLoading = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('leaflet-load-failed'));
    document.body.appendChild(script);
  });
  return _leafletLoading;
}

function reverseGeocodeFields(addr) {
  const a = addr || {};
  return {
    line1: addr.display_name || '',
    city: a.city || a.town || a.village || a.municipality || a.county || '',
    state: a.state || a.region || '',
    country: a.country || '',
    postal_code: a.postcode || '',
  };
}

const addrModal = {
  el: null, map: null, marker: null, editingId: null, _searchTimer: null,

  ensureDom: function () {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.className = 'acct-modal-overlay';
    el.id = 'acctAddrModal';
    el.innerHTML =
      '<div class="acct-modal acct-modal--wide">' +
        '<button class="acct-modal-close" id="acctAddrModalClose" aria-label="Close">&times;</button>' +
        '<h3 class="acct-modal-title" id="acctAddrModalTitle">' + t('Add Address','إضافة عنوان') + '</h3>' +
        '<div class="af-msg" id="acctAddrMsg" hidden></div>' +
        '<div class="acct-map-search-row">' +
          '<div class="acct-map-search-wrap">' +
            '<input class="af-input" id="acctMapSearch" type="text" placeholder="' + t('Search for a location…','ابحث عن موقع…') + '" autocomplete="off">' +
            '<div class="acct-map-suggestions" id="acctMapSuggestions" hidden></div>' +
          '</div>' +
          '<button type="button" class="acct-btn-secondary acct-map-locate" id="acctMapLocate">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>' +
            '<span>' + t('Use Current Location','استخدام الموقع الحالي') + '</span>' +
          '</button>' +
        '</div>' +
        '<div class="acct-map-container" id="acctMapContainer"></div>' +
        '<p class="acct-map-hint">' + t('Drag the pin, search, or use your current location to set the address.','اسحب العلامة أو ابحث أو استخدم موقعك الحالي لتحديد العنوان.') + '</p>' +
        '<form id="acctAddrForm" class="acct-form">' +
          '<div class="acct-form-grid">' +
            '<div class="af-field"><label class="af-label">' + t('Label','التسمية') + '</label><input class="af-input" name="label" placeholder="Home / Office"></div>' +
            '<div class="af-field"><label class="af-label">' + t('Phone','الهاتف') + '</label><input class="af-input" name="phone" type="tel"></div>' +
          '</div>' +
          '<div class="af-field"><label class="af-label">' + t('Full Address','العنوان الكامل') + '</label><textarea class="af-input acct-textarea" name="line1" required></textarea></div>' +
          '<div class="acct-form-grid acct-form-grid--3">' +
            '<div class="af-field"><label class="af-label">' + t('City','المدينة') + '</label><input class="af-input" name="city"></div>' +
            '<div class="af-field"><label class="af-label">' + t('State / Region','المنطقة') + '</label><input class="af-input" name="state"></div>' +
            '<div class="af-field"><label class="af-label">' + t('Postal Code','الرمز البريدي') + '</label><input class="af-input" name="postal_code"></div>' +
          '</div>' +
          '<div class="af-field"><label class="af-label">' + t('Country','الدولة') + '</label><input class="af-input" name="country"></div>' +
          '<label class="af-check acct-map-default-check"><input type="checkbox" name="is_default"><span>' + t('Set as default address','تعيين كعنوان افتراضي') + '</span></label>' +
          '<div class="acct-form-actions">' +
            '<button class="acct-btn-primary" type="submit">' + t('Save Address','حفظ العنوان') + '</button>' +
            '<button class="acct-btn-ghost" type="button" id="acctAddrCancel">' + t('Cancel','إلغاء') + '</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(el);
    this.el = el;
    el.addEventListener('click', e => { if (e.target === el) this.close(); });
    $('#acctAddrModalClose', el).addEventListener('click', () => this.close());
    $('#acctAddrCancel', el).addEventListener('click', () => this.close());
    $('#acctMapLocate', el).addEventListener('click', () => this.useCurrentLocation());
    $('#acctMapSearch', el).addEventListener('input', e => this.onSearchInput(e.target.value));
    $('#acctAddrForm', el).addEventListener('submit', e => this.save(e));
    return el;
  },

  fillFields: function (fields) {
    const f = $('#acctAddrForm');
    if (!f) return;
    if (fields.line1 != null) f.line1.value = fields.line1;
    if (fields.city != null) f.city.value = fields.city;
    if (fields.state != null) f.state.value = fields.state;
    if (fields.country != null) f.country.value = fields.country;
    if (fields.postal_code != null) f.postal_code.value = fields.postal_code;
  },

  placeMarker: function (lat, lng) {
    if (!this.map) return;
    if (this.marker) { this.marker.setLatLng([lat, lng]); }
    else {
      this.marker = window.L.marker([lat, lng], { draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => {
        const p = this.marker.getLatLng();
        this.reverseGeocode(p.lat, p.lng);
      });
    }
    this.lat = lat; this.lng = lng;
  },

  reverseGeocode: async function (lat, lng) {
    this.placeMarker(lat, lng);
    try {
      const res = await fetch(NOMINATIM + '/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng + '&addressdetails=1');
      const data = await res.json();
      this.fillFields(reverseGeocodeFields(Object.assign({ display_name: data.display_name }, data.address)));
    } catch (e) { /* keep the coordinates even if reverse geocoding fails */ }
  },

  onSearchInput: function (q) {
    clearTimeout(this._searchTimer);
    const box = $('#acctMapSuggestions');
    if (!q || q.trim().length < 3) { if (box) { box.hidden = true; box.innerHTML = ''; } return; }
    this._searchTimer = setTimeout(async () => {
      try {
        const res = await fetch(NOMINATIM + '/search?format=jsonv2&addressdetails=1&limit=5&q=' + encodeURIComponent(q));
        const results = await res.json();
        if (!box) return;
        if (!results.length) {
          box.innerHTML = '<div class="acct-map-suggestion acct-map-suggestion--empty">' + t('Location not found. Try a different search.','لم يتم العثور على الموقع. جرّب بحثاً مختلفاً.') + '</div>';
          box.hidden = false;
          return;
        }
        box.innerHTML = results.map((r, i) => '<button type="button" class="acct-map-suggestion" data-idx="' + i + '">' + esc(r.display_name) + '</button>').join('');
        box.hidden = false;
        $$('.acct-map-suggestion[data-idx]', box).forEach(btn => btn.addEventListener('click', () => {
          const r = results[Number(btn.getAttribute('data-idx'))];
          const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
          this.map.setView([lat, lng], 16);
          this.placeMarker(lat, lng);
          this.fillFields(reverseGeocodeFields(Object.assign({ display_name: r.display_name }, r.address)));
          box.hidden = true;
          $('#acctMapSearch').value = r.display_name;
        }));
      } catch (e) { /* non-fatal — user can still drag the pin */ }
    }, 400);
  },

  useCurrentLocation: function () {
    if (!navigator.geolocation) return msg($('#acctAddrMsg'), t('Location services are not available on this device.','خدمات الموقع غير متاحة على هذا الجهاز.'), 'error');
    const btn = $('#acctMapLocate');
    if (btn) btn.disabled = true;
    navigator.geolocation.getCurrentPosition(pos => {
      if (btn) btn.disabled = false;
      const { latitude, longitude } = pos.coords;
      this.map.setView([latitude, longitude], 16);
      this.reverseGeocode(latitude, longitude);
    }, () => {
      if (btn) btn.disabled = false;
      msg($('#acctAddrMsg'), t('Location services are not available on this device.','خدمات الموقع غير متاحة على هذا الجهاز.'), 'error');
    }, { enableHighAccuracy: true, timeout: 8000 });
  },

  open: async function (existing) {
    this.ensureDom();
    this.editingId = existing ? existing.id : null;
    $('#acctAddrModalTitle').textContent = existing ? t('Edit Address','تعديل العنوان') : t('Add Address','إضافة عنوان');
    const f = $('#acctAddrForm');
    f.reset();
    $('#acctMapSearch').value = '';
    const suggestions = $('#acctMapSuggestions'); if (suggestions) { suggestions.hidden = true; suggestions.innerHTML = ''; }
    const addrMsgEl = $('#acctAddrMsg'); if (addrMsgEl) addrMsgEl.hidden = true;
    if (existing) {
      f.label.value = existing.label || '';
      f.phone.value = existing.phone || '';
      f.line1.value = existing.line1 || '';
      f.city.value = existing.city || '';
      f.state.value = existing.state || '';
      f.country.value = existing.country || '';
      f.postal_code.value = existing.postal_code || '';
      f.is_default.checked = !!existing.is_default;
    }
    this.el.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    try {
      await loadLeaflet();
    } catch (e) {
      msg($('#acctAddrMsg'), t('Could not load the map. Please check your connection.','تعذّر تحميل الخريطة. يرجى التحقق من الاتصال.'), 'error');
      return;
    }
    const center = (existing && existing.lat && existing.lng) ? [existing.lat, existing.lng] : DEFAULT_CENTER;
    if (!this.map) {
      this.map = window.L.map('acctMapContainer').setView(center, existing && existing.lat ? 16 : 12);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
      }).addTo(this.map);
      this.map.on('click', e => this.reverseGeocode(e.latlng.lat, e.latlng.lng));
    } else {
      this.map.setView(center, existing && existing.lat ? 16 : 12);
      setTimeout(() => this.map.invalidateSize(), 50);
    }
    if (existing && existing.lat && existing.lng) this.placeMarker(existing.lat, existing.lng);
    else if (this.marker) { this.map.removeLayer(this.marker); this.marker = null; this.lat = this.lng = null; }
    setTimeout(() => this.map.invalidateSize(), 80);
  },

  close: function () {
    if (this.el) this.el.classList.remove('is-open');
    document.body.style.overflow = '';
  },

  save: async function (e) {
    e.preventDefault();
    const f = e.currentTarget;
    const base = {
      label: f.label.value.trim(), phone: f.phone.value.trim(),
      line1: f.line1.value.trim(), city: f.city.value.trim(), country: f.country.value.trim(),
      is_default: !!f.is_default.checked,
    };
    if (!base.line1) return msg($('#acctAddrMsg'), t('Please enter the address.','يرجى إدخال العنوان.'), 'error');
    const extra = {
      state: f.state.value.trim() || null,
      postal_code: f.postal_code.value.trim() || null,
      lat: this.lat != null ? this.lat : null,
      lng: this.lng != null ? this.lng : null,
    };
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    const full = Object.assign({}, base, extra);
    let res = this.editingId ? await AFAuth.updateAddress(this.editingId, full) : await AFAuth.addAddress(full);
    if (res && res.error) {
      /* Extended columns (state/postal_code/lat/lng) may not exist yet — retry with the base fields only */
      res = this.editingId ? await AFAuth.updateAddress(this.editingId, base) : await AFAuth.addAddress(base);
    }
    btn.disabled = false;
    if (res && res.error) return msg($('#acctAddrMsg'), res.error.message, 'error');
    if (base.is_default) {
      /* Unset default on every other address */
      const savedId = this.editingId || (res && res.data && res.data.id);
      await Promise.all(ALL_ADDRESSES.filter(a => String(a.id) !== String(savedId))
        .map(a => AFAuth.updateAddress(a.id, { is_default: false })));
    }
    this.close();
    loadAddresses(); loadStats();
  },
};

/* ── Notifications ── */
function baseNotifications() {
  const list = [
    { id:'welcome', ico:'👋', title:t('Welcome to AL FAROOQUE','مرحباً في الفاروقي'),
      sub:t('Your account is set up and ready to use.','حسابك جاهز للاستخدام.'),
      desc:t('Your AL FAROOQUE account has been created and is ready to use. Explore your dashboard to track orders, manage your wishlist, and update your profile.','تم إنشاء حسابك في الفاروقي وهو جاهز للاستخدام. تصفّح لوحة التحكم لتتبع طلباتك وإدارة قائمة رغباتك وتحديث ملفك الشخصي.'),
      ts: 0, time:t('Just now','الآن') },
    { id:'notif-on', ico:'🔔', title:t('Notifications enabled','الإشعارات مفعّلة'),
      sub:t('We will notify you about order updates, quotes, and more.','سنُعلمك بتحديثات الطلبات والعروض والمزيد.'),
      desc:t('You will receive notifications here whenever your order status changes, a quote is answered, or your account is updated.','ستصلك إشعارات هنا عند تغيّر حالة طلبك أو الرد على عرض سعر أو تحديث حسابك.'),
      ts: 0, time:t('Today','اليوم') },
  ];
  ALL_ORDERS.slice(0, 5).forEach(o => {
    const num = o.order_no || '#' + String(o.id || '').slice(0,8).toUpperCase();
    const st = (o.status || 'pending').toLowerCase();
    const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
    list.push({
      id: 'order-' + o.id, ico:'📦',
      title: t('Order ' + num, 'الطلب ' + num),
      sub: t('Status: ' + orderStatusLabel(st), 'الحالة: ' + orderStatusLabel(st)),
      desc: t('Your order ' + num + ' is currently ' + orderStatusLabel(st) + '. Total: SAR ' + Number(o.grand_total || 0).toLocaleString('en-US') + '.',
              'طلبك ' + num + ' حالياً ' + orderStatusLabel(st) + '. الإجمالي: ' + Number(o.grand_total || 0).toLocaleString('en-US') + ' ريال.'),
      ts: ts,
      time: o.created_at ? new Date(o.created_at).toLocaleString(IS_AR ? 'ar-SA' : 'en-GB', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '',
      orderId: o.id,
      action: t('View Order','عرض الطلب'),
    });
  });
  return list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
function getReadNotifIds() {
  try { return JSON.parse(localStorage.getItem('afq-notif-read') || '[]'); } catch(e) { return []; }
}
function setReadNotifIds(ids) { localStorage.setItem('afq-notif-read', JSON.stringify(ids)); }
function getDeletedNotifIds() {
  try { return JSON.parse(localStorage.getItem('afq-notif-deleted') || '[]'); } catch(e) { return []; }
}
function setDeletedNotifIds(ids) { localStorage.setItem('afq-notif-deleted', JSON.stringify(ids)); }
function markNotifRead(id) {
  const read = getReadNotifIds();
  if (read.indexOf(id) === -1) { read.push(id); setReadNotifIds(read); }
  updateNotifBadge();
}
function visibleNotifications() {
  const deleted = getDeletedNotifIds();
  return baseNotifications().filter(n => deleted.indexOf(n.id) === -1);
}

function updateNotifBadge() {
  const items = visibleNotifications();
  const read = getReadNotifIds();
  const unread = items.filter(n => read.indexOf(n.id) === -1).length;
  const hdr = $('#notifBadgeHdr'), menu = $('#notifBadgeMenu');
  [hdr, menu].forEach(b => { if (b) { b.hidden = unread === 0; b.textContent = unread > 9 ? '9+' : String(unread); } });
  const markAllBtn = $('#markAllReadBtn');
  if (markAllBtn) markAllBtn.hidden = unread === 0;
}

function loadNotifications() {
  const el = $('#notifBody'); if (!el) return;
  const items = visibleNotifications();
  const read = getReadNotifIds();
  const unreadCount = items.filter(n => read.indexOf(n.id) === -1).length;

  if (!items.length) {
    el.innerHTML = emptyState('🔔', t('No notifications','لا توجد إشعارات'),
      t('You have no notifications right now.','لا توجد إشعارات لديك حالياً.'));
    updateNotifBadge();
    return;
  }

  const caughtUpBanner = unreadCount === 0
    ? '<div class="acct-notif-caughtup"><span class="acct-caughtup-ico">✓</span><span>' + t("You're all caught up",'أنت على اطلاع بكل شيء') + '</span></div>'
    : '';

  el.innerHTML = caughtUpBanner + items.map(n => {
    const isRead = read.indexOf(n.id) !== -1;
    return '<div class="acct-notif' + (isRead ? ' is-read' : ' is-unread') + '" data-notif="' + esc(n.id) + '" tabindex="0" role="button">' +
      '<div class="acct-notif-dot-col">' + (isRead ? '' : '<span class="acct-notif-dot"></span>') + '</div>' +
      '<div class="acct-notif-ico">' + n.ico + '</div>' +
      '<div class="acct-notif-body">' +
        '<div class="acct-notif-title">' + esc(n.title) + '</div>' +
        '<div class="acct-notif-sub">' + esc(n.sub) + '</div>' +
        '<div class="acct-notif-time">' + esc(n.time) + '</div>' +
      '</div>' +
      '<button class="acct-notif-del" data-notif-del="' + esc(n.id) + '" aria-label="' + t('Delete','حذف') + '">&times;</button>' +
    '</div>';
  }).join('');
  updateNotifBadge();

  $$('.acct-notif[data-notif]', el).forEach(card => {
    const open = () => openNotifModal(card.getAttribute('data-notif'));
    card.addEventListener('click', e => { if (!e.target.closest('[data-notif-del]')) open(); });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  $$('[data-notif-del]', el).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const id = b.getAttribute('data-notif-del');
    const deleted = getDeletedNotifIds();
    if (deleted.indexOf(id) === -1) { deleted.push(id); setDeletedNotifIds(deleted); }
    loadNotifications();
  }));
}

/* ── Notification detail modal (reuses the generic .acct-modal styles) ── */
function openNotifModal(id) {
  const n = visibleNotifications().find(x => x.id === id); if (!n) return;
  markNotifRead(id);
  $$('.acct-notif[data-notif="' + id + '"]').forEach(card => {
    card.classList.remove('is-unread'); card.classList.add('is-read');
    const dot = $('.acct-notif-dot-col', card); if (dot) dot.innerHTML = '';
  });
  const banner = $('#notifBody .acct-notif-caughtup');
  const stillUnread = visibleNotifications().some(x => getReadNotifIds().indexOf(x.id) === -1);
  if (!stillUnread && !banner) loadNotifications(); // re-render to show "all caught up" + hide mark-all-read

  let modal = $('#acctNotifModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'acctNotifModal';
    modal.className = 'acct-modal-overlay';
    modal.innerHTML = '<div class="acct-modal"><button class="acct-modal-close" id="acctNotifModalClose" aria-label="Close">&times;</button><div id="acctNotifModalBody"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeNotifModal(); });
    $('#acctNotifModalClose', modal).addEventListener('click', closeNotifModal);
  }
  $('#acctNotifModalBody', modal).innerHTML =
    '<div class="acct-notif-modal-ico">' + n.ico + '</div>' +
    '<h3 class="acct-modal-title">' + esc(n.title) + '</h3>' +
    '<p class="acct-notif-modal-time">' + esc(n.time) + '</p>' +
    '<p class="acct-notif-modal-desc">' + esc(n.desc || n.sub) + '</p>' +
    '<div class="acct-modal-actions">' +
      (n.orderId ? '<button class="acct-btn-primary" id="acctNotifAction">' + esc(n.action || t('View','عرض')) + '</button>' : '') +
      '<button class="acct-btn-ghost" id="acctNotifDelete">' + t('Delete Notification','حذف الإشعار') + '</button>' +
    '</div>';
  const actionBtn = $('#acctNotifAction', modal);
  if (actionBtn) actionBtn.addEventListener('click', () => { closeNotifModal(); goTo('orders'); });
  $('#acctNotifDelete', modal).addEventListener('click', () => {
    const deleted = getDeletedNotifIds();
    if (deleted.indexOf(id) === -1) { deleted.push(id); setDeletedNotifIds(deleted); }
    closeNotifModal();
    loadNotifications();
  });
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeNotifModal() {
  const modal = $('#acctNotifModal');
  if (modal) modal.classList.remove('is-open');
  document.body.style.overflow = '';
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
  const profFormEl = $('#profForm');
  if (!profFormEl) return; // gate — elements may not be in DOM (shouldn't happen on account.html)
  profFormEl.addEventListener('submit', async e => {
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

  /* Cancel profile edits */
  const profCancel = $('#profCancel');
  if (profCancel) profCancel.addEventListener('click', () => { if (CURRENT.user) hydrate(CURRENT.user); });

  /* Notification preference toggles */
  $$('#prefEmailNotif, #prefWhatsapp, #prefMarketing').forEach(inp => inp && inp.addEventListener('change', saveNotifPrefs));

  /* Avatar upload */
  const profPhotoEl = $('#profPhoto');
  if (profPhotoEl) profPhotoEl.addEventListener('change', async function () {
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
  const profPhotoRemoveEl = $('#profPhotoRemove');
  if (profPhotoRemoveEl) profPhotoRemoveEl.addEventListener('click', async () => {
    await AFAuth.updateProfile({ avatar_url: null });
    CURRENT.profile = Object.assign(CURRENT.profile || {}, { avatar_url: null });
    setAvatar('', initials(CURRENT.user));
    computeCompleteness();
  });

  /* Change password */
  const pwFormEl = $('#pwForm');
  if (pwFormEl) pwFormEl.addEventListener('submit', async e => {
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

  /* Add Address → opens the live map picker modal */
  const addrAddBtn = $('#addrAddBtn');
  if (addrAddBtn) addrAddBtn.addEventListener('click', () => addrModal.open(null));

  /* Orders search */
  const orderSearch = $('#orderSearch');
  if (orderSearch) orderSearch.addEventListener('input', () => { ordersPage = 1; renderOrders(); });

  /* Orders filter chips */
  $$('.acct-chip', $('#orderFilterChips')).forEach(chip => {
    chip.addEventListener('click', function () {
      $$('.acct-chip', $('#orderFilterChips')).forEach(c => c.classList.remove('is-active'));
      this.classList.add('is-active');
      currentFilter = this.getAttribute('data-filter') || 'all';
      ordersPage = 1;
      renderOrders();
    });
  });

  /* Mark all notifications read */
  const markAllBtn = $('#markAllReadBtn');
  if (markAllBtn) markAllBtn.addEventListener('click', () => {
    setReadNotifIds(visibleNotifications().map(n => n.id));
    loadNotifications();
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

/* ── Boot ──
   The Dashboard (overview) must always be the landing tab the first time
   the dashboard is opened in a browser session — regardless of what hash
   the user arrived with (a stale bookmark, an old link, etc.). After that
   first landing, normal hash-based navigation/deep-linking takes over. */
applyI18n();
wire();
window.addEventListener('hashchange', () => showSection(location.hash.replace('#', '')));
AFAuth.onChange(user => {
  showGate(!!user);
  if (user) {
    hydrate(user);
    let sec = location.hash.replace('#', '') || 'overview';
    try {
      if (!sessionStorage.getItem('af-dashboard-opened')) {
        sessionStorage.setItem('af-dashboard-opened', '1');
        sec = 'overview';
      }
    } catch (_) {}
    showSection(sec);
  }
});
