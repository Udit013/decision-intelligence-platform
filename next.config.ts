import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ECharts ships large; let Next tree-shake/transpile it server-side cleanly.
  transpilePackages: ['echarts', 'echarts-for-react', 'zrender'],
}

export default nextConfig
