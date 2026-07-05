/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
