'use client';

import { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    dashboard: 'Dashboard', contacts: 'Contacts', deals: 'Deals',
    activities: 'Activities', pipeline: 'Pipeline', integrations: 'Integrations', reports: 'Reports',
    settings: 'Settings', logout: 'Logout', theme: 'Theme',
  },
  ar: {
    dashboard: 'لوحة التحكم', contacts: 'جهات الاتصال', deals: 'الصفقات',
    activities: 'الأنشطة', pipeline: 'خط الأنابيب', integrations: 'التكاملات', reports: 'التقارير',
    settings: 'الإعدادات', logout: 'تسجيل الخروج', theme: 'المظهر',
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
