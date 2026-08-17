'use client';

import { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    dashboard: 'Dashboard', leads: 'Leads', contacts: 'Contacts', deals: 'Deals',
    activities: 'Activities', pipeline: 'Pipeline', integrations: 'Integrations', reports: 'Reports',
    settings: 'Settings', logout: 'Logout', theme: 'Theme',
    notifications: 'Notifications', noNotificationsYet: 'No notifications yet.', delete: 'Delete',
    toggleLanguage: 'Toggle language', toggleTheme: 'Toggle theme', menu: 'Menu',
    print: 'Print', downloadPdf: 'Download PDF',
    companies: 'Companies', opportunities: 'Opportunities', workspace: 'My Workspace',
    analytics: 'Analytics', search: 'Search', attention: 'Attention', calendar: 'Calendar',
    communications: 'Communications', documents: 'Documents',
  },
  ar: {
    dashboard: 'لوحة التحكم', leads: 'العملاء المحتملون', contacts: 'جهات الاتصال', deals: 'الصفقات',
    activities: 'الأنشطة', pipeline: 'خط الأنابيب', integrations: 'التكاملات', reports: 'التقارير',
    settings: 'الإعدادات', logout: 'تسجيل الخروج', theme: 'المظهر',
    notifications: 'الإشعارات', noNotificationsYet: 'لا توجد إشعارات بعد.', delete: 'حذف',
    toggleLanguage: 'تبديل اللغة', toggleTheme: 'تبديل المظهر', menu: 'القائمة',
    print: 'طباعة', downloadPdf: 'تنزيل PDF',
    companies: 'الشركات', opportunities: 'الفرص', workspace: 'مساحتي',
    analytics: 'التحليلات', search: 'بحث', attention: 'يتطلب الانتباه', calendar: 'التقويم',
    communications: 'الاتصالات', documents: 'المستندات',
  },
};

const LangContext = createContext({ lang: 'en', t: k => k, setLang: () => {} });

export function LanguageProvider({ children, initial = 'en' }) {
  const [lang, updateLang] = useState(initial);
  const setLang = value => {
    updateLang(value);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = value;
      document.documentElement.dir = value === 'ar' ? 'rtl' : 'ltr';
      localStorage.setItem('af-crm-language', value);
    }
  };
  const t = k => translations[lang]?.[k] ?? translations.en[k] ?? k;
  return <LangContext.Provider value={{ lang, t, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() { return useContext(LangContext); }
