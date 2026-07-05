import './globals.css';

export const metadata = {
  title: 'ProTrack — AL FAROOQUE Project Management',
  description: 'Project and customer tracking for AL FAROOQUE Manufacturing',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('af-projects-theme');if(t==='light'){}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
