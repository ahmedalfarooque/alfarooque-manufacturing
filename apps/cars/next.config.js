/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* Deployed as its own Vercel project with cars.alfarooque.com as its
     production domain — the app lives at the domain root, so no
     basePath. (It used to be proxied under alfarooque.com/cars; every
     internal fetch/href in this app was updated to root-relative paths
     when it moved to a dedicated subdomain — see apps/DEPLOYMENT.md.) */
  async headers() {
    return [
      { source: '/(.*)', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
};

module.exports = nextConfig;
