import './globals.css';
import { LanguageProvider } from '@/lib/i18n';
import GlassIconsLoader from '@/components/GlassIcons';

export const metadata = {
  title: 'TrackFleet — AL FAROOQUE Cars Tracking',
  description: 'Fleet and maintenance tracking for the AL FAROOQUE vehicle fleet',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('af-cars-theme');if(t==='dark'){document.documentElement.classList.add('dark');}var l=localStorage.getItem('af-cars-lang');if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';}}catch(e){}})();`,
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
