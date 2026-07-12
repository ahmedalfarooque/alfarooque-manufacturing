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
     Chromium binary relative to its own module path at runtime. Next.js's
     automatic serverless file tracer does not follow that dynamic lookup,
     so without this the "bin" folder is silently left out of the deployed
     function — the exact production error this fixes:
     "The input directory '.../api/quotations/[id]/bin' does not exist."
     The key is matched with picomatch against the route's NORMALIZED app
     path (e.g. "/app/api/quotations/[id]/pdf" — no "route.js" suffix,
     leading slash present), not the literal file path — verified
     directly against Next 14.2.15's own matching code before landing on
     this pattern. */
  experimental: {
    outputFileTracingIncludes: {
      '/app/api/quotations/*/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },
};

module.exports = nextConfig;
