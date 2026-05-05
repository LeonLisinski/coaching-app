import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseHostname = supabaseUrl.replace(/^https?:\/\//, '')

const nextConfig: NextConfig = {
  experimental: {
    proxyPrefetch: 'strict',
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js App Router requires unsafe-inline for hydration scripts; unsafe-eval for some RSC chunks
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' blob: data: https://${supabaseHostname}`,
      "font-src 'self' data:",
      `connect-src 'self' https://${supabaseHostname} wss://${supabaseHostname} https://api.stripe.com https://*.ingest.de.sentry.io https://*.ingest.sentry.io`,
      `frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com`,
      "object-src 'none'",
      "base-uri 'self'",
      `form-action 'self' https://checkout.stripe.com`,
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ')

    const securityHeaders = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    ]

    return [
      {
        source: '/site.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "unitlift",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
