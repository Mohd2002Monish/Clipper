/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'ioredis', 'bullmq', 'archiver'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle these native/server-side packages
      config.externals = [...(config.externals || []), 'mongoose', 'ioredis', 'bullmq'];
    }
    return config;
  },
};

export default nextConfig;
