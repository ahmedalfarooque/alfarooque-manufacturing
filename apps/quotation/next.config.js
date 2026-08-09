/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* Deployed as its own Vercel project with quotation.alfarooque.com as
     its production domain — same pattern as apps/cars and apps/projects
     (no basePath, root-relative paths everywhere; see apps/DEPLOYMENT.md). */
  async headers() {
    return [
      { source: '/(.*)', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
  /* @sparticuz/chromium (lib/pdf/renderPdfServer.js) locates its bundled
     Chromium binary via path.join(__dirname, 'bin') at runtime — a
     relative lookup that assumes __dirname still points at the real
     node_modules/@sparticuz/chromium folder. The REAL root cause of the
     production 500 ("The input directory '.../api/quotations/[id]/bin'
     does not exist") is that Next's webpack build BUNDLES that package's
     own code into the route's compiled output, which changes what
     __dirname resolves to at runtime — it ends up pointing at the
     ROUTE's own compiled folder, not the package's folder, so the
     lookup fails no matter how many extra files get copied alongside it
     (outputFileTracingIncludes/vercel.json includeFiles both still
     leave the CODE looking in the wrong place). serverComponentsExternalPackages
     tells Next to leave this package unbundled — resolved via a plain
     Node require() at runtime instead — which is what keeps __dirname
     correct and is the documented fix for this exact class of bug with
     puppeteer-core/@sparticuz/chromium under Next.js. */
  experimental: {
    /* Barrel-optimize heavy UI packages: Next rewrites `import { X } from
       'recharts'` to direct deep imports at compile time, cutting both dev
       compile cost and the dashboard bundle without any code change. */
    optimizePackageImports: ['recharts'],
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    outputFileTracingIncludes: {
      '/app/api/quotations/*/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },
};

module.exports = nextConfig;
