import './globals.css';
import GlassIconsLoader from '@/components/GlassIcons';
import DeletePermissionGate from '../../shared/DeletePermissionGate';
import { LanguageProvider } from '@/lib/i18n';

export const metadata = { title: 'CRM — AL FAROOQUE', description: 'Customer Relationship Management', icons: { icon: '/logo.png' } };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Was defaulting to dark and reading only the per-app localStorage
            key — same theme-default bug already fixed in the other five
            apps earlier this session, missed here. Now light-by-default,
            reads the shared cross-app af_theme/af_lang cookies first. */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{function c(n){var m=document.cookie.match(new RegExp('(?:^|;\\\\s*)'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}var t=c('af_theme')||localStorage.getItem('af-crm-theme');if(t==='dark'){document.documentElement.classList.add('dark');}var l=c('af_lang')||localStorage.getItem('af-crm-language');if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';}}catch(e){}})();`,
        }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <GlassIconsLoader />
        <DeletePermissionGate />
        <div className="af-ambient" aria-hidden="true">
          <div className="af-orb af-orb-1" />
          <div className="af-orb af-orb-2" />
          <div className="af-orb af-orb-3" />
        </div>
        <LanguageProvider><div className="relative z-[1] min-h-screen">{children}</div></LanguageProvider>
      </body>
    </html>
  );
}
