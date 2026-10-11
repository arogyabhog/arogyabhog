import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /** Pre-launch: never let any proxy/browser cache a stale shell. Hashed
   *  production assets still cache fine in real deployments (flip later). */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
