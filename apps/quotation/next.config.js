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
};

module.exports = nextConfig;
