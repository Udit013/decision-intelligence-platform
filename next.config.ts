import type { NextConfig } from 'next'

// Baseline security headers for every response. CSP is intentionally omitted for
// now: Next inlines bootstrap scripts and ECharts renders to canvas, so a strict
// CSP needs nonce plumbing — a follow-up, not a quick win.
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
