import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@lotwise/engine'],
  reactStrictMode: true,
  agentRules: false,
  poweredByHeader: false,
  experimental: { optimizePackageImports: ['motion', 'd3-scale', 'd3-shape', 'd3-array'] },
  async headers() {
    return [
      // Embeddable widgets may be framed by any site; everything else may not.
      { source: '/embed/:path*', headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }] },
      { source: '/((?!embed).*)', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'X-Content-Type-Options', value: 'nosniff' }] },
    ];
  },
};
export default nextConfig;
