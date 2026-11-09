import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mteam/shared", "@mteam/db"],
};

export default nextConfig;
