import './globals.css';
import { LanguageProvider } from '@/lib/i18n';
import GlassIconsLoader from '@/components/GlassIcons';

export const metadata = {
  title: 'ProTrack — AL FAROOQUE Project Management',
  description: 'Project and customer tracking for AL FAROOQUE Manufacturing',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{function c(n){var m=document.cookie.match(new RegExp('(?:^|;\\\\s*)'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}var t=c('af_theme')||localStorage.getItem('af-projects-theme');if(t!=='light'){document.documentElement.classList.add('dark');}var l=c('af_lang')||localStorage.getItem('af-projects-lang');if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <GlassIconsLoader />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
