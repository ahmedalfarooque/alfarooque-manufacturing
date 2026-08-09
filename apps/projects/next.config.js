/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* Barrel-optimize heavy UI packages (recharts): Next rewrites the barrel
     import to direct deep imports at compile time — faster dev compile and
     a smaller dashboard bundle, no code change. */
  experimental: { optimizePackageImports: ['recharts'] },
  /* Local Windows quirk: a stale dev server can hold an exclusive lock
     on .next/trace, aborting every subsequent `next build` with EPERM.
     NEXT_DIST_DIR lets local builds/starts target a fresh dir without
     touching the default (Vercel builds ignore it — env var unset). */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  /* Deployed as its own Vercel project with projects.alfarooque.com as
     its production domain — the app lives at the domain root, so no
     basePath. (It used to be proxied under alfarooque.com/projects;
     every internal fetch/href was updated to root-relative paths when
     it moved to a dedicated subdomain — see apps/DEPLOYMENT.md, and
     apps/cars which made the same move first.) */
  async headers() {
    return [
      { source: '/(.*)', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
};

module.exports = nextConfig;
