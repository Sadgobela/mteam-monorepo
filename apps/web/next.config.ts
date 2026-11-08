import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mteam/shared", "@mteam/db"],
  // Ten photos of up to 5 MB each, plus the form fields. Middleware has its own limit and silently cuts longer bodies.
  experimental: { serverActions: { bodySizeLimit: "55mb" }, middlewareClientMaxBodySize: "55mb" },
};

export default nextConfig;
