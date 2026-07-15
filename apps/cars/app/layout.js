import './globals.css';
import { LanguageProvider } from '@/lib/i18n';
import GlassIconsLoader from '@/components/GlassIcons';

export const metadata = {
  title: 'TrackFleet — AL FAROOQUE Cars Tracking',
  description: 'Fleet and maintenance tracking for the AL FAROOQUE vehicle fleet',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{function c(n){var m=document.cookie.match(new RegExp('(?:^|;\\\\s*)'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}var t=c('af_theme')||localStorage.getItem('af-cars-theme');if(t==='dark'){document.documentElement.classList.add('dark');}var l=c('af_lang')||localStorage.getItem('af-cars-lang');if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <GlassIconsLoader />
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
