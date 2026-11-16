import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mteam/shared", "@mteam/db"],
  // Avatars and broker photos go through server actions, whose default limit is 1 MB. Vercel caps a request at 4.5 MB
  // anyway, so the browser shrinks photos before sending them.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // The workspace root, so the server bundle traces files from the shared packages, Prisma's engine among them.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Prisma loads its engine by a path worked out at run time, which tracing cannot follow, so its generated folder is
  // added by hand. Without it every page reading the database fails on Vercel ("could not locate the Query Engine").
  outputFileTracingIncludes: {
    "/**": ["../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*"],
  },
};

export default nextConfig;
