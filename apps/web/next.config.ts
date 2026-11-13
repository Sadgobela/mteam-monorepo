import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mteam/shared", "@mteam/db"],
  // The workspace root, so the server bundle traces files from the shared packages, Prisma's engine among them.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
