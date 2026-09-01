'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';
import AppSwitcherButtons from '@/components/AppSwitcherButtons';
import { GlassToastHost } from '@/components/glass';
import { readPref, writePref, THEME_PREF_COOKIE } from '@/lib/prefs';
import ModuleActionVisibility from '../../shared/ModuleActionVisibility';

/* Grouped nav — every href is an EXISTING route (the generic
   /smartlife/[resource] page for every SmartERP-backed module, or an
   already-working local page). No new physical routes were created to
   build this list; see apps/accounting/app/(protected)/smartlife/[resource]/page.js
   MODULES for the full SmartERP-backed set. "Purchase Invoices" pointed at a
   resource key ('purchase-invoices') that has never existed in
   SMARTLIFE_RESOURCES (the real key is 'purchases') — fixed here.
   "Expenses" pointed at '/smartlife/expenses', a resource key that ALSO
   never existed in MODULES — the generic [resource] page's fallback
   (`LABELS[params.resource] ? params.resource : 'sales-invoices'`) silently
   rendered Sales Invoices data under the Expenses label. Removed entirely
   (no SmartERP expenses endpoint exists to replace it with). */
const NAV_GROUPS = [
  { group: null, items: [
    { href: '/dashboard', label: 'Dashboard', labelAr: 'الرئيسية', icon: 'grid' },
  ] },
  { group: 'Accounting System', groupAr: 'النظام المحاسبي', items: [
    { href: '/smartlife/accounts', label: 'Chart of Accounts', labelAr: 'دليل الحسابات', icon: 'ledger' },
    { href: '/smartlife/account-balances', label: 'Account Balances', labelAr: 'أرصدة الحسابات', icon: 'balance' },
    { href: '/smartlife/daily-move', label: 'Daily Move', labelAr: 'اليومية العامة', icon: 'ledger' },
    { href: '/smartlife/receipts', label: 'Receipts', labelAr: 'سندات القبض', icon: 'invoice' },
    { href: '/smartlife/cash-receipts', label: 'Cash Receipts', labelAr: 'سندات القبض النقدي', icon: 'invoice' },
    { href: '/smartlife/trial-balance', label: 'Trial Balance', labelAr: 'ميزان المراجعة', icon: 'balance' },
    { href: '/smartlife/income-statement', label: 'Income Statement', labelAr: 'قائمة الدخل', icon: 'chart' },
    { href: '/smartlife/financial-position', label: 'Financial Position', labelAr: 'المركز المالي', icon: 'chart' },
    { href: '/smartlife/cash-flow', label: 'Cash Flow Statement', labelAr: 'قائمة التدفقات النقدية', icon: 'chart' },
    { href: '/smartlife/cost-centers', label: 'Cost Centers', labelAr: 'مراكز التكلفة', icon: 'target' },
    { href: '/vat', label: 'VAT Report', labelAr: 'تقرير ضريبة القيمة المضافة', icon: 'percent-doc' },
    /* journal-entries/invoices/bills/payments/banking/expenses/assets all
       HAVE page.js source files with real-looking forms, but every one is
       explicitly retired: middleware.js LEGACY_FINANCIAL_PAGES 301s every
       one of them straight to /smartlife/sales-invoices (or /purchase-
       invoices, /payments) before the page ever renders, and their /api/*
       routes return HTTP 410 ("This local financial API is retired.
       SmartLife is the financial source of truth."). Confirmed live: both
       /journal-entries and /assets redirect away instead of rendering.
       So "Recurring Journal Entries" / "Depreciation Of Assets" / "Payment
       Methods" / Cheque Books / etc still have no real, reachable
       implementation — do not link to these paths. */
  ] },
  /* Financial Reports — the existing hub (apps/accounting/app/(protected)/
     smartlife/[resource]/page.js FinancialReportsView + /api/smartlife/
     reports) stays as the landing/overview item. Below it are real,
     independently-working report pages that were never linked from the
     sidebar at all:
       - /reports: a local report GENERATOR (income statement, balance
         sheet, cash flow, VAT, inventory valuation, project costing,
         summary — apps/accounting/app/(protected)/reports/page.js,
         REPORT_TITLES) built from AL FAROOQUE's own local records, not the
         SmartERP mirror. Unlike journal-entries/expenses/payments/etc, this
         page and its /api/reports backend are explicitly NOT in
         middleware.js's retired-pages list (re-activated 2026-08-13 per
         that file's own comment) — confirmed live, /reports renders its
         real report-type picker with no redirect. Real match for "Optional
         Reports" (the user picks which report to run).
       NOTE: /expenses, /payments, /journal-entries, /assets, /banking,
       /invoices, /bills all have page.js source but are explicitly retired
       by middleware.js (redirect before render, API returns 410) — verified
       live, so "Expense Report" and "Payments Report" are NOT linked here.
     Account Balances / Cost Centers / Cash Flow Statement are intentionally
     repeated here (same href as their Accounting System entry) because
     Financial Reports is the reporting/analysis grouping and those three
     are genuinely reports, not just operational lookups — see commit
     message for the full per-item investigation. Every other requested
     SmartLife report name (Sales Costs Report, Customer And Supplier
     Report, both debt-aging reports, Tax Return, Overview Chart, Best
     Purchasing/Selling Products, Warehouse Stock Chart, Stock Exchange
     Orders, Register Report, Stagnant Products, Excise Tax Report, Sales
     Raw Products, Transfers Products, Adjustments Report, Categories
     Report, Brands Report, Payments By Method, Inactive Customers, Staff
     Report, Stock Count Reports, Raw Materials Linked to Assembly, Group
     Product Prices Report, Stock Receipt, Stock Supply Orders Report,
     Quotes Report, Statistical Total Profits as a standalone page) has no
     real implementation anywhere in this app and was left out rather than
     given a fake href. */
  { group: 'Financial Reports', groupAr: 'التقارير المالية', items: [
    { href: '/smartlife/financial-reports', label: 'Financial Reports', labelAr: 'التقارير المالية', icon: 'chart' },
    { href: '/reports', label: 'Optional Reports', labelAr: 'تقارير اختيارية', icon: 'chart' },
    { href: '/smartlife/account-balances', label: 'Accounts Balances Report', labelAr: 'تقرير أرصدة الحسابات', icon: 'balance' },
    { href: '/smartlife/cost-centers', label: 'Cost Centers Report', labelAr: 'تقرير مراكز التكلفة', icon: 'target' },
    { href: '/smartlife/cash-flow', label: 'Cash Flow Report', labelAr: 'تقرير التدفقات النقدية', icon: 'chart' },
  ] },
  { group: 'Sales', groupAr: 'المبيعات', items: [
    { href: '/smartlife/sales-invoices', label: 'Sales Invoices', labelAr: 'فواتير المبيعات', icon: 'invoice' },
    { href: '/smartlife/customers', label: 'Customers', labelAr: 'العملاء', icon: 'users' },
    { href: '/smartlife/payments', label: 'Payments', labelAr: 'المدفوعات', icon: 'card-pay' },
  ] },
  { group: 'Purchasing', groupAr: 'المشتريات', items: [
    { href: '/smartlife/purchases', label: 'Purchase Invoices', labelAr: 'فواتير المشتريات', icon: 'invoice' },
    { href: '/purchase-requests', label: 'Purchase Requests', labelAr: 'طلبات الشراء', icon: 'quote' },
    { href: '/smartlife/suppliers', label: 'Suppliers', labelAr: 'الموردون', icon: 'users' },
  ] },
  { group: 'Inventory', groupAr: 'المخزون', items: [
    { href: '/inventory', label: 'Inventory', labelAr: 'المخزون', icon: 'warehouse' },
    { href: '/smartlife/product-balances', label: 'Product Balances', labelAr: 'أرصدة المنتجات', icon: 'balance' },
    { href: '/smartlife/products', label: 'Products', labelAr: 'المنتجات', icon: 'box' },
    { href: '/smartlife/categories', label: 'Categories', labelAr: 'الفئات', icon: 'folder' },
    { href: '/smartlife/brands', label: 'Brands', labelAr: 'العلامات التجارية', icon: 'tag' },
    { href: '/smartlife/units', label: 'Units', labelAr: 'الوحدات', icon: 'ruler' },
    { href: '/smartlife/warehouses', label: 'Warehouses / Branches', labelAr: 'المستودعات / الفروع', icon: 'warehouse' },
    { href: '/smartlife/tax', label: 'Tax', labelAr: 'الضرائب', icon: 'percent-doc' },
  ] },
  { group: 'Other', groupAr: 'أخرى', items: [
    { href: '/smartlife/gift-cards', label: 'Gift Cards', labelAr: 'بطاقات الهدايا', icon: 'gift' },
    { href: '/smartlife/coupons', label: 'Coupons', labelAr: 'القسائم', icon: 'ticket' },
    { href: '/users', label: 'Users', labelAr: 'المستخدمون', icon: 'user', adminOnly: true },
    { href: '/smartlife/cashiers', label: 'Cashiers', labelAr: 'الصرافون', icon: 'cashier' },
  ] },
  { group: null, items: [
    { href: '/settings', label: 'Settings', labelAr: 'الإعدادات', icon: 'gear' },
  ] },
];

export default function Shell({ children, active }) {
  const { lang, setLang } = useLanguage();
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUser(d.user))
      .catch(() => {});
    try {
      const saved = readPref(THEME_PREF_COOKIE) || localStorage.getItem('af-accounting-theme');
      setDark(saved === 'dark');
    } catch (_) {}
    /* Background SmartLife sync trigger — fire-and-forget, never awaited,
       never blocks render (this whole block runs after the page is already
       showing). Once per browser tab per session (sessionStorage guard) so
       navigating between pages doesn't refire it on every mount. The actual
       decision to skip (already synced recently / already running elsewhere)
       is made server-side in the central sync route — this is just the
       trigger, not the sync itself, so even if several tabs/apps all fire it
       around the same time, only one real sync runs (see
       apps/crm/app/api/integrations/[key]/sync/route.js). */
    try {
      if (!sessionStorage.getItem('af_smartlife_bg_sync_fired')) {
        sessionStorage.setItem('af_smartlife_bg_sync_fired', '1');
        fetch('/api/smartlife/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify({ trigger: 'background' }),
        }).catch(() => {});
      }
    } catch (_) {}
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-accounting-theme', next ? 'dark' : 'light'); } catch (_) {}
    writePref(THEME_PREF_COOKIE, next ? 'dark' : 'light');
  }

  async function logout() {
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'logout' }) }); } catch (_) {}
    window.location.href = '/login';
  }

  // Keep the server render and the first client render identical. Reading
  // window.location during render made the active-link class differ during
  // hydration (server: inactive, client: active), producing noisy warnings.
  const [currentPath, setCurrentPath] = useState('');
  useEffect(() => { setCurrentPath(window.location.pathname); }, []);

  return (
    <div className="min-h-screen flex text-[color:var(--tx)]">
      <ModuleActionVisibility />
      {/* Sidebar */}
      <aside className={
        'fixed lg:static z-40 inset-y-0 start-0 w-64 shrink-0 flex flex-col transition-transform af-sidebar ' +
        'bg-[color:var(--sidebar-bg)] border-e border-[color:var(--sidebar-border)] ' +
        (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      }>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[color:var(--sidebar-border)] shrink-0">
          <img src="/logo.png" alt="AF" className="h-9 w-9 object-contain rounded-xl" />
          <div>
            <div className="text-[color:var(--sidebar-active-text)] font-bold text-sm leading-tight">AL FAROOQUE</div>
            <div className="text-[color:var(--sidebar-text-muted)] text-[10px]">{lang === 'ar' ? 'المحاسبة' : 'Accounting'}</div>
          </div>
        </div>
        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_GROUPS.map((section, sectionIndex) => (
            <div key={section.group || `ungrouped-${sectionIndex}`}>
              {section.group && (
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sidebar-text-muted)]">
                  {lang === 'ar' ? section.groupAr : section.group}
                </div>
              )}
              {section.items.filter(item => !item.adminOnly || user?.role === 'admin').map(item => {
                const isActive = active === item.href || currentPath.startsWith(item.href);
                return (
                  <a key={item.href} href={item.href}
                    className={
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ' +
                      (isActive
                        ? 'nav-active bg-[color:var(--sidebar-active-bg)] text-[color:var(--sidebar-active-text)]'
                        : 'text-[color:var(--sidebar-text)] hover:bg-[color:var(--sidebar-hover-bg)] hover:text-[color:var(--sidebar-active-text)]')
                    }>
                    <GlassIcon name={item.icon} size={21} bare />
                    <span>{lang === 'ar' ? item.labelAr : item.label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        {/* User */}
        {user && (
          <div className="px-4 py-3 border-t border-[color:var(--sidebar-border)] shrink-0">
            <div className="text-xs font-medium text-[color:var(--sidebar-text)] truncate">{user.email}</div>
            <div className="text-[10px] text-[color:var(--sidebar-text-muted)] capitalize">{user.role}</div>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="af-topbar h-16 shrink-0 flex items-center gap-3 px-4 border-b border-[color:var(--sidebar-border)] bg-[color:var(--sidebar-bg)]">
          <button className="lg:hidden glass-ctrl gbtn--icon" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div className="flex-1" />
          <AppSwitcherButtons user={user} />
          <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="glass-ctrl" title="Toggle language">
            <span className="ctrl-label">{lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>
          <button type="button" onClick={toggleTheme} className="glass-ctrl" title="Toggle theme" aria-pressed={dark}>
            <GlassIcon name={dark ? 'sun' : 'moon'} size={16} className="ctrl-icon" />
          </button>
          <button type="button" onClick={logout} className="glass-ctrl" title="Logout">
            <GlassIcon name="logout" size={16} className="ctrl-icon" />
            <span className="ctrl-label">{lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <GlassToastHost />
    </div>
  );
}
