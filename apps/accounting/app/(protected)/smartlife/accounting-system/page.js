'use client';

/* Accounting System landing page — the operational-navigation counterpart
   to the Financial Reports hub (apps/accounting/app/(protected)/smartlife/
   [resource]/page.js, FinancialReportsView). Deliberately a SEPARATE,
   standalone route rather than a new branch inside that shared [resource]
   component: that component is the verified, regression-sensitive engine
   behind every real SmartERP-backed table/report page, and this page needs
   none of its data-fetching/filtering/export machinery — it is pure
   navigation, so keeping it isolated means zero risk of touching that
   infrastructure. Every card below links to an already-verified real route
   (see apps/accounting/components/Shell.js NAV_GROUPS "Accounting System"
   for the same list). No API call, no KPI numbers, no fabricated data —
   navigation cards only, per the explicit "prefer navigation cards over
   fake KPI values" requirement. */

import { GlassBadge, GlassCard } from '@/components/glass';
import { GlassIcon } from '@/components/GlassIcons';
import PageHeader from '@/components/PageHeader';
import { useLanguage } from '@/lib/i18n';

const CATEGORIES = [
  { key: 'core-accounting', label: 'Core Accounting', labelAr: 'المحاسبة الأساسية', items: [
    { href: '/smartlife/accounts', name: 'Chart of Accounts', nameAr: 'دليل الحسابات', description: 'Full SmartLife account tree', icon: 'ledger' },
    { href: '/smartlife/account-balances', name: 'Account Balances', nameAr: 'أرصدة الحسابات', description: 'Current balance per account', icon: 'balance' },
    { href: '/smartlife/trial-balance', name: 'Trial Balance', nameAr: 'ميزان المراجعة', description: 'Every account, Debit/Credit', icon: 'balance' },
  ] },
  { key: 'financial-statements', label: 'Financial Statements', labelAr: 'القوائم المالية', items: [
    { href: '/smartlife/income-statement', name: 'Income Statement', nameAr: 'قائمة الدخل', description: 'Sales, cost of sales, expenses, income', icon: 'chart' },
    { href: '/smartlife/financial-position', name: 'Financial Position', nameAr: 'المركز المالي', description: 'Assets, liabilities and equity', icon: 'chart' },
    { href: '/smartlife/cash-flow', name: 'Cash Flow Statement', nameAr: 'قائمة التدفقات النقدية', description: 'Net profit and ending cash', icon: 'chart' },
  ] },
  { key: 'transactions', label: 'Transactions', labelAr: 'الحركات', items: [
    { href: '/smartlife/daily-move', name: 'Daily Move', nameAr: 'اليومية العامة', description: 'Synchronized general ledger', icon: 'ledger' },
    { href: '/smartlife/receipts', name: 'Receipts', nameAr: 'سندات القبض', description: 'سند قبض — Receipt Vouchers', icon: 'invoice' },
    { href: '/smartlife/cash-receipts', name: 'Cash Receipts', nameAr: 'سندات القبض النقدي', description: 'سند قبض نقدي — Cash Receipt Vouchers', icon: 'invoice' },
  ] },
  { key: 'management-tax', label: 'Management & Tax', labelAr: 'الإدارة والضرائب', items: [
    { href: '/smartlife/cost-centers', name: 'Cost Centers', nameAr: 'مراكز التكلفة', description: 'SmartLife cost center list', icon: 'target' },
    { href: '/vat', name: 'VAT Report', nameAr: 'تقرير ضريبة القيمة المضافة', description: 'VAT return summary', icon: 'percent-doc' },
  ] },
];

export default function AccountingSystemDashboard() {
  const { lang } = useLanguage();

  return (
    <div className="space-y-4">
      <PageHeader
        title={lang === 'ar' ? 'النظام المحاسبي' : 'Accounting System'}
        description={lang === 'ar' ? 'الوظائف المحاسبية التشغيلية' : 'Operational accounting functions'}
        badge={<GlassBadge tone="emerald">{lang === 'ar' ? 'مصدر SmartLife' : 'SmartLife source'}</GlassBadge>}
      />

      {CATEGORIES.map(cat => (
        <div key={cat.key}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--tx-3)]">
            {lang === 'ar' ? cat.labelAr : cat.label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cat.items.map(item => (
              <a key={item.href} href={item.href} className="block">
                <GlassCard className="p-4 h-full transition-colors hover:bg-[color:var(--sidebar-hover-bg)]">
                  <div className="flex items-center gap-2">
                    <GlassIcon name={item.icon} size={20} bare />
                    <div className="font-semibold text-[color:var(--tx)]">{lang === 'ar' ? item.nameAr : item.name}</div>
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--tx-3)]">{item.description}</div>
                </GlassCard>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
