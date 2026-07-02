/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['xlsx'],
  },
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

module.exports = nextConfig;
