import './globals.css';
import GlassIconsLoader from '@/components/GlassIcons';
import DeletePermissionGate from '../../shared/DeletePermissionGate';

export const metadata = { title: 'CRM — AL FAROOQUE', description: 'Customer Relationship Management', icons: { icon: '/logo.png' } };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t=localStorage.getItem('af-crm-theme')||'dark';
              if(t==='dark')document.documentElement.classList.add('dark');
              var l=localStorage.getItem('af-crm-language')||'en';
              document.documentElement.lang=l; document.documentElement.dir=l==='ar'?'rtl':'ltr';
            } catch(_){}
          })();
        ` }} />
      </head>
      <body className="bg-[#0a0f1e] text-white antialiased">
        <GlassIconsLoader />
        <DeletePermissionGate />
        {children}
      </body>
    </html>
  );
}
