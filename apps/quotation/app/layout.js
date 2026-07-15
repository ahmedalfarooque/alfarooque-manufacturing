import './globals.css';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { LanguageProvider } from '@/lib/i18n';
import GlassIconsLoader from '@/components/GlassIcons';

/* Self-hosted via next/font/google: the font files are downloaded ONCE
   at build time and served from this app's own domain — no runtime
   network request to fonts.googleapis.com at all. This is what
   actually fixes Arabic PDF generation: QuoteDocument.js's font-family
   for Arabic was previously just a wishful list of names
   ('IBM Plex Sans Arabic','Tajawal','Segoe UI',sans-serif) with NO
   loading mechanism behind any of them — it only ever "worked" on
   local Windows dev because Segoe UI happens to be a real installed
   system font there with decent Arabic coverage. Vercel's serverless
   Chromium has none of those fonts, so Arabic text fell through to a
   generic sans-serif with no Arabic glyphs at all — rendering
   invisible, and (since the fallback's metrics differ) reflowing onto
   a second page. Exposed as a CSS variable so QuoteDocument.js can
   reference it directly instead of a hopeful font-family string. */
const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  /* 'block' (not 'swap'): the PDF pipeline measures the document's real
     rendered height, then prints, immediately after document.fonts.ready
     resolves (see renderPdfServer.js). With 'swap', the browser paints
     text with a FALLBACK font first and swaps to this one asynchronously
     — document.fonts.ready can resolve in the gap before that swap
     actually repaints, so the measured height reflects the wrong font's
     metrics. 'block' holds text rendering until this (self-hosted,
     same-origin, near-instant) font is ready, so by the time anything
     paints the correct font is already active — measurement and paint
     are guaranteed consistent. */
  display: 'block',
});

export const metadata = {
  title: 'QuotePro — AL FAROOQUE Quotation & Costing',
  description: 'Quotation and cost estimation system for AL FAROOQUE Manufacturing',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={arabicFont.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{function c(n){var m=document.cookie.match(new RegExp('(?:^|;\\\\s*)'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}var t=c('af_theme')||localStorage.getItem('af-quotation-theme');if(t==='dark'){document.documentElement.classList.add('dark');}var l=c('af_lang')||localStorage.getItem('af-quotation-lang');if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';}}catch(e){}})();`,
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
