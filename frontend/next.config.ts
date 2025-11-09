import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'export',
  basePath: '/Bird-Collision-Map-Sharkbyte',
  assetPrefix: '/Bird-Collision-Map-Sharkbyte/',
};

export default nextConfig;
