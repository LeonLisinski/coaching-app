import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyPrefetch: 'strict',
  },
};

export default nextConfig;