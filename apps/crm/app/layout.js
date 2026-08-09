import './globals.css';
import GlassIconsLoader from '@/components/GlassIcons';

export const metadata = { title: 'CRM — AL FAROOQUE', description: 'Customer Relationship Management', icons: { icon: '/logo.png' } };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t=localStorage.getItem('af-crm-theme');
              if(t==='light'){document.documentElement.classList.add('light');document.body&&document.body.classList.add('light');}
            } catch(_){}
          })();
        ` }} />
      </head>
      <body className="bg-[#0a0f1e] text-white antialiased">
        <GlassIconsLoader />
        {children}
      </body>
    </html>
  );
}
