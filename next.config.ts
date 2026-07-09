import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.VERCEL ? ".next" : process.env.NEXT_DIST_DIR ?? ".next-build",
  turbopack: {},
};

export default nextConfig;
