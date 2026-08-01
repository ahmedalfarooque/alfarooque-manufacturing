'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readPref, writePref, LANG_PREF_COOKIE } from './prefs';

export const LANG_KEY = 'af-accounting-lang';

export const translations = {
  en: {
    // Shell / nav
    'nav.title': 'Accounting',
    'nav.dashboard': 'Dashboard',
    'nav.chartOfAccounts': 'Chart of Accounts',
    'nav.journalEntries': 'Journal Entries',
    'nav.invoices': 'Invoices',
    'nav.bills': 'Bills',
    'nav.payments': 'Payments',
    'nav.banking': 'Banking',
    'nav.expenses': 'Expenses',
    'nav.assets': 'Fixed Assets',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    'shell.tagline': 'Accounting ERP',
    'shell.loading': 'Loading…',
    'shell.logout': 'Logout',
    'shell.toggleTheme': 'Toggle theme',
    'shell.toggleLanguage': 'Toggle language',

    // Dashboard
    'dash.title': 'Dashboard',
    'dash.totalReceivables': 'Total Receivables',
    'dash.totalPayables': 'Total Payables',
    'dash.cashBalance': 'Cash Balance',
    'dash.monthRevenue': 'Revenue This Month',
    'dash.recentEntries': 'Recent Journal Entries',
    'dash.agingAR': 'Accounts Receivable Aging',
    'dash.agingAP': 'Accounts Payable Aging',

    // Chart of Accounts
    'coa.title': 'Chart of Accounts',
    'coa.addAccount': 'Add Account',
    'coa.code': 'Code',
    'coa.name': 'Name',
    'coa.accountType': 'Account Type',
    'coa.accountClass': 'Account Class',
    'coa.parentAccount': 'Parent Account',
    'coa.isHeader': 'Header Account',
    'coa.asset': 'Asset',
    'coa.liability': 'Liability',
    'coa.equity': 'Equity',
    'coa.revenue': 'Revenue',
    'coa.expense': 'Expense',
    'coa.noAccounts': 'No accounts yet.',

    // Journal Entries
    'je.title': 'Journal Entries',
    'je.addEntry': 'Add Entry',
    'je.entryNumber': 'Entry No.',
    'je.entryDate': 'Entry Date',
    'je.description': 'Description',
    'je.reference': 'Reference',
    'je.entryType': 'Entry Type',
    'je.status': 'Status',
    'je.totalDebit': 'Total Debit',
    'je.totalCredit': 'Total Credit',
    'je.draft': 'Draft',
    'je.posted': 'Posted',
    'je.reversed': 'Reversed',
    'je.manual': 'Manual',
    'je.invoice': 'Invoice',
    'je.payment': 'Payment',
    'je.bill': 'Bill',
    'je.expense': 'Expense',
    'je.post': 'Post Entry',
    'je.reverse': 'Reverse Entry',
    'je.noEntries': 'No journal entries yet.',
    'je.lines': 'Entry Lines',
    'je.debit': 'Debit',
    'je.credit': 'Credit',
    'je.account': 'Account',
    'je.costCenter': 'Cost Center',

    // Invoices
    'invoices.title': 'Invoices',
    'invoices.addInvoice': 'Add Invoice',
    'invoices.invoiceNumber': 'Invoice No.',
    'invoices.invoiceDate': 'Invoice Date',
    'invoices.dueDate': 'Due Date',
    'invoices.customer': 'Customer',
    'invoices.status': 'Status',
    'invoices.subtotal': 'Subtotal',
    'invoices.discount': 'Discount',
    'invoices.tax': 'Tax',
    'invoices.total': 'Total',
    'invoices.paid': 'Paid',
    'invoices.balance': 'Balance Due',
    'invoices.draft': 'Draft',
    'invoices.sent': 'Sent',
    'invoices.partial': 'Partially Paid',
    'invoices.overdue': 'Overdue',
    'invoices.cancelled': 'Cancelled',
    'invoices.void': 'Void',
    'invoices.noInvoices': 'No invoices yet.',

    // Bills
    'bills.title': 'Bills',
    'bills.addBill': 'Add Bill',
    'bills.billNumber': 'Bill No.',
    'bills.billDate': 'Bill Date',
    'bills.supplier': 'Supplier',
    'bills.status': 'Status',
    'bills.noBills': 'No bills yet.',

    // Payments
    'payments.title': 'Payments',
    'payments.addPayment': 'Add Payment',
    'payments.paymentNumber': 'Payment No.',
    'payments.paymentDate': 'Payment Date',
    'payments.paymentType': 'Payment Type',
    'payments.paymentMethod': 'Payment Method',
    'payments.amount': 'Amount',
    'payments.received': 'Received',
    'payments.made': 'Made',
    'payments.bank': 'Bank Transfer',
    'payments.cash': 'Cash',
    'payments.cheque': 'Cheque',
    'payments.noPayments': 'No payments yet.',

    // Banking
    'banking.title': 'Banking',
    'banking.addAccount': 'Add Bank Account',
    'banking.accountNumber': 'Account Number',
    'banking.iban': 'IBAN',
    'banking.bankName': 'Bank Name',
    'banking.openingBalance': 'Opening Balance',
    'banking.currentBalance': 'Current Balance',
    'banking.noAccounts': 'No bank accounts yet.',
    'banking.reconcile': 'Reconcile',

    // Expenses / Claims
    'expenses.title': 'Expenses',
    'expenses.addClaim': 'Add Claim',
    'expenses.claimNumber': 'Claim No.',
    'expenses.claimDate': 'Claim Date',
    'expenses.submittedBy': 'Submitted By',
    'expenses.status': 'Status',
    'expenses.totalAmount': 'Total Amount',
    'expenses.noClaims': 'No expense claims yet.',
    'expenses.addLine': 'Add Line',
    'expenses.expenseDate': 'Expense Date',
    'expenses.category': 'Category',
    'expenses.receipt': 'Receipt',

    // Fixed Assets
    'assets.title': 'Fixed Assets',
    'assets.addAsset': 'Add Asset',
    'assets.assetNumber': 'Asset No.',
    'assets.acquisitionDate': 'Acquisition Date',
    'assets.cost': 'Cost',
    'assets.salvageValue': 'Salvage Value',
    'assets.usefulLife': 'Useful Life (years)',
    'assets.depMethod': 'Depreciation Method',
    'assets.bookValue': 'Book Value',
    'assets.accumulated': 'Accumulated Depreciation',
    'assets.straightLine': 'Straight-Line',
    'assets.decliningBalance': 'Declining Balance',
    'assets.noAssets': 'No fixed assets yet.',

    // Reports
    'reports.title': 'Reports',
    'reports.trialBalance': 'Trial Balance',
    'reports.balanceSheet': 'Balance Sheet',
    'reports.incomeStatement': 'Income Statement',
    'reports.cashFlow': 'Cash Flow Statement',
    'reports.agingReport': 'Aging Report',
    'reports.vatReport': 'VAT Report',
    'reports.period': 'Period',
    'reports.asOf': 'As Of',
    'reports.runReport': 'Run Report',
    'reports.noData': 'No data available for this report.',

    // Settings
    'settings.title': 'Settings',
    'settings.userRoles': 'User Roles',
    'settings.taxCodes': 'Tax Codes',
    'settings.periods': 'Accounting Periods',
    'settings.general': 'General',
    'settings.role': 'Role',
    'settings.addRole': 'Add Role',
    'settings.addPeriod': 'Add Period',
    'settings.addTaxCode': 'Add Tax Code',

    // Common
    'common.loading': 'Loading…',
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.status': 'Status',
    'common.notes': 'Notes',
    'common.created': 'Created successfully.',
    'common.updated': 'Updated successfully.',
    'common.deleted': 'Deleted successfully.',
    'common.error': 'An error occurred.',
    'common.confirmDelete': 'Are you sure you want to delete this item?',
    'common.name': 'Name',
    'common.code': 'Code',
    'common.description': 'Description',
    'common.currency': 'Currency',
    'common.amount': 'Amount',
    'common.date': 'Date',
    'common.type': 'Type',
    'common.reference': 'Reference',
    'common.noData': 'No data available.',
    'common.showing': 'Showing {from}–{to} of {total}',
    'common.prev': 'Prev',
    'common.next': 'Next',
    'common.sar': 'SAR',
    'common.view': 'View',
    'common.actions': 'Actions',
    'common.rows': 'Rows:',
    'common.print': 'Print',
    'common.export': 'Export',
    'common.none': '— None —',
    'common.select': 'Select…',

    // Login
    'login.accountingTagline': 'Accounting ERP',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.continue': 'Continue',
    'login.signingIn': 'Signing in…',
    'login.codeSentTo': 'We sent a 6-digit code to',
    'login.verifyAndSignIn': 'Verify & Sign In',
    'login.verifying': 'Verifying…',
    'login.resendCode': 'Resend code',
    'login.resendCodeIn': 'Resend code ({seconds}s)',
    'login.backToEmailPassword': '← Back to email & password',
    'login.successRedirect': 'Success — redirecting…',
    'login.genericError': 'Something went wrong.',
  },

  ar: {
    // Shell / nav
    'nav.title': 'المحاسبة',
    'nav.dashboard': 'لوحة التحكم',
    'nav.chartOfAccounts': 'دليل الحسابات',
    'nav.journalEntries': 'القيود اليومية',
    'nav.invoices': 'الفواتير',
    'nav.bills': 'فواتير الموردين',
    'nav.payments': 'المدفوعات',
    'nav.banking': 'الحسابات البنكية',
    'nav.expenses': 'المصروفات',
    'nav.assets': 'الأصول الثابتة',
    'nav.reports': 'التقارير',
    'nav.settings': 'الإعدادات',
    'shell.tagline': 'نظام المحاسبة',
    'shell.loading': 'جارٍ التحميل…',
    'shell.logout': 'تسجيل الخروج',
    'shell.toggleTheme': 'تبديل المظهر',
    'shell.toggleLanguage': 'تبديل اللغة',

    // Dashboard
    'dash.title': 'لوحة التحكم',
    'dash.totalReceivables': 'إجمالي الذمم المدينة',
    'dash.totalPayables': 'إجمالي الذمم الدائنة',
    'dash.cashBalance': 'الرصيد النقدي',
    'dash.monthRevenue': 'إيرادات هذا الشهر',
    'dash.recentEntries': 'القيود اليومية الأخيرة',
    'dash.agingAR': 'تحليل أعمار الذمم المدينة',
    'dash.agingAP': 'تحليل أعمار الذمم الدائنة',

    // Chart of Accounts
    'coa.title': 'دليل الحسابات',
    'coa.addAccount': 'إضافة حساب',
    'coa.code': 'الرمز',
    'coa.name': 'الاسم',
    'coa.accountType': 'نوع الحساب',
    'coa.accountClass': 'تصنيف الحساب',
    'coa.parentAccount': 'الحساب الأم',
    'coa.isHeader': 'حساب رئيسي',
    'coa.asset': 'أصول',
    'coa.liability': 'خصوم',
    'coa.equity': 'حقوق الملكية',
    'coa.revenue': 'إيرادات',
    'coa.expense': 'مصروفات',
    'coa.noAccounts': 'لا توجد حسابات بعد.',

    // Journal Entries
    'je.title': 'القيود اليومية',
    'je.addEntry': 'إضافة قيد',
    'je.entryNumber': 'رقم القيد',
    'je.entryDate': 'تاريخ القيد',
    'je.description': 'الوصف',
    'je.reference': 'المرجع',
    'je.entryType': 'نوع القيد',
    'je.status': 'الحالة',
    'je.totalDebit': 'إجمالي المدين',
    'je.totalCredit': 'إجمالي الدائن',
    'je.draft': 'مسودة',
    'je.posted': 'مرحّل',
    'je.reversed': 'معكوس',
    'je.manual': 'يدوي',
    'je.invoice': 'فاتورة',
    'je.payment': 'دفعة',
    'je.bill': 'فاتورة مورد',
    'je.expense': 'مصروف',
    'je.post': 'ترحيل القيد',
    'je.reverse': 'عكس القيد',
    'je.noEntries': 'لا توجد قيود يومية بعد.',
    'je.lines': 'بنود القيد',
    'je.debit': 'مدين',
    'je.credit': 'دائن',
    'je.account': 'الحساب',
    'je.costCenter': 'مركز التكلفة',

    // Invoices
    'invoices.title': 'الفواتير',
    'invoices.addInvoice': 'إضافة فاتورة',
    'invoices.invoiceNumber': 'رقم الفاتورة',
    'invoices.invoiceDate': 'تاريخ الفاتورة',
    'invoices.dueDate': 'تاريخ الاستحقاق',
    'invoices.customer': 'العميل',
    'invoices.status': 'الحالة',
    'invoices.subtotal': 'المجموع الفرعي',
    'invoices.discount': 'الخصم',
    'invoices.tax': 'الضريبة',
    'invoices.total': 'الإجمالي',
    'invoices.paid': 'المدفوع',
    'invoices.balance': 'الرصيد المستحق',
    'invoices.draft': 'مسودة',
    'invoices.sent': 'مرسلة',
    'invoices.partial': 'مدفوعة جزئياً',
    'invoices.overdue': 'متأخرة السداد',
    'invoices.cancelled': 'ملغاة',
    'invoices.void': 'باطلة',
    'invoices.noInvoices': 'لا توجد فواتير بعد.',

    // Bills
    'bills.title': 'فواتير الموردين',
    'bills.addBill': 'إضافة فاتورة مورد',
    'bills.billNumber': 'رقم الفاتورة',
    'bills.billDate': 'تاريخ الفاتورة',
    'bills.supplier': 'المورد',
    'bills.status': 'الحالة',
    'bills.noBills': 'لا توجد فواتير موردين بعد.',

    // Payments
    'payments.title': 'المدفوعات',
    'payments.addPayment': 'إضافة دفعة',
    'payments.paymentNumber': 'رقم الدفعة',
    'payments.paymentDate': 'تاريخ الدفعة',
    'payments.paymentType': 'نوع الدفعة',
    'payments.paymentMethod': 'طريقة الدفع',
    'payments.amount': 'المبلغ',
    'payments.received': 'مقبوضة',
    'payments.made': 'مدفوعة',
    'payments.bank': 'تحويل بنكي',
    'payments.cash': 'نقد',
    'payments.cheque': 'شيك',
    'payments.noPayments': 'لا توجد دفعات بعد.',

    // Banking
    'banking.title': 'الحسابات البنكية',
    'banking.addAccount': 'إضافة حساب بنكي',
    'banking.accountNumber': 'رقم الحساب',
    'banking.iban': 'الآيبان',
    'banking.bankName': 'اسم البنك',
    'banking.openingBalance': 'الرصيد الافتتاحي',
    'banking.currentBalance': 'الرصيد الحالي',
    'banking.noAccounts': 'لا توجد حسابات بنكية بعد.',
    'banking.reconcile': 'تسوية',

    // Expenses / Claims
    'expenses.title': 'المصروفات',
    'expenses.addClaim': 'إضافة مطالبة',
    'expenses.claimNumber': 'رقم المطالبة',
    'expenses.claimDate': 'تاريخ المطالبة',
    'expenses.submittedBy': 'مقدم من',
    'expenses.status': 'الحالة',
    'expenses.totalAmount': 'المبلغ الإجمالي',
    'expenses.noClaims': 'لا توجد مطالبات مصروفات بعد.',
    'expenses.addLine': 'إضافة بند',
    'expenses.expenseDate': 'تاريخ المصروف',
    'expenses.category': 'الفئة',
    'expenses.receipt': 'الإيصال',

    // Fixed Assets
    'assets.title': 'الأصول الثابتة',
    'assets.addAsset': 'إضافة أصل',
    'assets.assetNumber': 'رقم الأصل',
    'assets.acquisitionDate': 'تاريخ الاقتناء',
    'assets.cost': 'التكلفة',
    'assets.salvageValue': 'القيمة التخريدية',
    'assets.usefulLife': 'العمر الإنتاجي (سنوات)',
    'assets.depMethod': 'طريقة الإهلاك',
    'assets.bookValue': 'القيمة الدفترية',
    'assets.accumulated': 'الإهلاك المتراكم',
    'assets.straightLine': 'القسط الثابت',
    'assets.decliningBalance': 'القسط المتناقص',
    'assets.noAssets': 'لا توجد أصول ثابتة بعد.',

    // Reports
    'reports.title': 'التقارير',
    'reports.trialBalance': 'ميزان المراجعة',
    'reports.balanceSheet': 'الميزانية العمومية',
    'reports.incomeStatement': 'قائمة الدخل',
    'reports.cashFlow': 'قائمة التدفقات النقدية',
    'reports.agingReport': 'تقرير أعمار الديون',
    'reports.vatReport': 'تقرير ضريبة القيمة المضافة',
    'reports.period': 'الفترة',
    'reports.asOf': 'بتاريخ',
    'reports.runReport': 'تشغيل التقرير',
    'reports.noData': 'لا توجد بيانات لهذا التقرير.',

    // Settings
    'settings.title': 'الإعدادات',
    'settings.userRoles': 'أدوار المستخدمين',
    'settings.taxCodes': 'رموز الضريبة',
    'settings.periods': 'الفترات المحاسبية',
    'settings.general': 'عام',
    'settings.role': 'الدور',
    'settings.addRole': 'إضافة دور',
    'settings.addPeriod': 'إضافة فترة',
    'settings.addTaxCode': 'إضافة رمز ضريبة',

    // Common
    'common.loading': 'جارٍ التحميل…',
    'common.save': 'حفظ',
    'common.saving': 'جارٍ الحفظ…',
    'common.cancel': 'إلغاء',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.add': 'إضافة',
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.all': 'الكل',
    'common.active': 'نشط',
    'common.inactive': 'غير نشط',
    'common.status': 'الحالة',
    'common.notes': 'ملاحظات',
    'common.created': 'تم الإنشاء بنجاح.',
    'common.updated': 'تم التحديث بنجاح.',
    'common.deleted': 'تم الحذف بنجاح.',
    'common.error': 'حدث خطأ ما.',
    'common.confirmDelete': 'هل أنت متأكد من حذف هذا العنصر؟',
    'common.name': 'الاسم',
    'common.code': 'الرمز',
    'common.description': 'الوصف',
    'common.currency': 'العملة',
    'common.amount': 'المبلغ',
    'common.date': 'التاريخ',
    'common.type': 'النوع',
    'common.reference': 'المرجع',
    'common.noData': 'لا توجد بيانات.',
    'common.showing': 'عرض {from}–{to} من {total}',
    'common.prev': 'السابق',
    'common.next': 'التالي',
    'common.sar': 'ريال',
    'common.view': 'عرض',
    'common.actions': 'الإجراءات',
    'common.rows': 'الصفوف:',
    'common.print': 'طباعة',
    'common.export': 'تصدير',
    'common.none': '— لا يوجد —',
    'common.select': 'اختر…',

    // Login
    'login.accountingTagline': 'نظام المحاسبة',
    'login.email': 'البريد الإلكتروني',
    'login.password': 'كلمة المرور',
    'login.continue': 'متابعة',
    'login.signingIn': 'جارٍ تسجيل الدخول…',
    'login.codeSentTo': 'لقد أرسلنا رمزًا مكونًا من 6 أرقام إلى',
    'login.verifyAndSignIn': 'تحقق وسجّل الدخول',
    'login.verifying': 'جارٍ التحقق…',
    'login.resendCode': 'إعادة إرسال الرمز',
    'login.resendCodeIn': 'إعادة إرسال الرمز ({seconds}ث)',
    'login.backToEmailPassword': '← العودة إلى البريد الإلكتروني وكلمة المرور',
    'login.successRedirect': 'تم بنجاح — جارٍ إعادة التوجيه…',
    'login.genericError': 'حدث خطأ ما.',
  },
};

function applyDomLang(lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

const LOCALE = { en: 'en-US', ar: 'ar-SA' };

function formatDateFor(lang, value, opts) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(LOCALE[lang] || LOCALE.en, opts);
}

function formatDateTimeFor(lang, value, opts) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(LOCALE[lang] || LOCALE.en, opts);
}

function formatNumberFor(lang, value, opts) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (isNaN(n)) return String(value);
  return n.toLocaleString(LOCALE[lang] || LOCALE.en, opts);
}

export function trEnum(t, prefix, value) {
  if (value === null || value === undefined || value === '') return value;
  const key = prefix + '.' + value;
  const s = t(key);
  return s === key ? value : s;
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    let saved = 'en';
    try {
      saved = readPref(LANG_PREF_COOKIE) || localStorage.getItem(LANG_KEY) || 'en';
    } catch (_) {}
    setLangState(saved);
    applyDomLang(saved);
  }, []);

  const setLang = useCallback((next) => {
    setLangState(next);
    applyDomLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch (_) {}
    writePref(LANG_PREF_COOKIE, next);
  }, []);

  const t = useCallback((key, vars) => {
    const dict = translations[lang] || translations.en;
    let str = dict[key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        str = str.replace(`{${k}}`, vars[k]);
      }
    }
    return str;
  }, [lang]);

  const formatDate = useCallback((value, opts) => formatDateFor(lang, value, opts), [lang]);
  const formatDateTime = useCallback((value, opts) => formatDateTimeFor(lang, value, opts), [lang]);
  const formatNumber = useCallback((value, opts) => formatNumberFor(lang, value, opts), [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, formatDate, formatDateTime, formatNumber }),
    [lang, setLang, t, formatDate, formatDateTime, formatNumber],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: 'en',
      setLang: () => {},
      t: (key, vars) => {
        let str = translations.en[key] ?? key;
        if (vars) { for (const k of Object.keys(vars)) str = str.replace(`{${k}}`, vars[k]); }
        return str;
      },
      formatDate: (v, opts) => formatDateFor('en', v, opts),
      formatDateTime: (v, opts) => formatDateTimeFor('en', v, opts),
      formatNumber: (v, opts) => formatNumberFor('en', v, opts),
    };
  }
  return ctx;
}
