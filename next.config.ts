import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  // Never cache API responses or auth callbacks. They contain user-scoped data
  // and serving stale data across sessions could leak weights between users.
  workboxOptions: {
    navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
    runtimeCaching: [
      {
        urlPattern: /^\/api\/.*/,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /^\/auth\/.*/,
        handler: 'NetworkOnly',
      },
    ],
  },
})

const nextConfig: NextConfig = {
  // nothing extra needed
}

export default withPWA(nextConfig)
