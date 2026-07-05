import './globals.css';

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
            __html: `(function(){try{var t=localStorage.getItem('af-cars-theme');if(t==='light'){}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
