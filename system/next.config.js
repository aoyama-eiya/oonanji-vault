/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  compress: false,
  async rewrites() {
    return [
      {
        source: '/api/authenticate',
        destination: 'http://backend:8000/token',
      },
      {
        source: '/api/:path*',
        destination: 'http://backend:8000/api/:path*',
      },
      {
        source: '/token',
        destination: 'http://backend:8000/token',
      },
    ]
  },
  /* config options here */
};

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false,
});

module.exports = withPWA(nextConfig);
