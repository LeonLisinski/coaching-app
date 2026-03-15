import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyPrefetch: 'strict',
  },
  async headers() {
    return [
      {
        source: '/site.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ]
  },
};

export default nextConfig;