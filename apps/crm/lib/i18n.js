'use client';

import { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    dashboard: 'Dashboard', contacts: 'Contacts', deals: 'Deals',
    activities: 'Activities', pipeline: 'Pipeline', reports: 'Reports',
    settings: 'Settings', logout: 'Logout',
  },
  ar: {
    dashboard: 'لوحة التحكم', contacts: 'جهات الاتصال', deals: 'الصفقات',
    activities: 'الأنشطة', pipeline: 'خط الأنابيب', reports: 'التقارير',
    settings: 'الإعدادات', logout: 'تسجيل الخروج',
  },
};

const LangContext = createContext({ lang: 'en', t: k => k, setLang: () => {} });

export function LanguageProvider({ children, initial = 'en' }) {
  const [lang, setLang] = useState(initial);
  const t = k => translations[lang]?.[k] ?? translations.en[k] ?? k;
  return <LangContext.Provider value={{ lang, t, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() { return useContext(LangContext); }
