import type { NextConfig } from 'next'

// Baseline security headers for every response. The Content-Security-Policy is
// not here: it needs a fresh nonce per request, so src/proxy.ts sets it.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  // ECharts ships large; let Next tree-shake/transpile it server-side cleanly.
  transpilePackages: ['echarts', 'echarts-for-react', 'zrender'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
