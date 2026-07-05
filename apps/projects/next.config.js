/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* This app is proxied under alfarooque.com/projects via a Vercel
     rewrite from the main site's vercel.json — basePath makes every
     route, asset, and Link resolve correctly under that prefix whether
     you're hitting this app directly on its own Vercel URL or through
     the proxy. */
  basePath: '/projects',
  async headers() {
    return [
      { source: '/(.*)', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
};

module.exports = nextConfig;
