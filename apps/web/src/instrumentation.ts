import { siteUrl } from "@/lib/site-url";

/** Runs once when the server starts, so a wrong address stops a deploy instead of breaking every page. */
export async function register(): Promise<void> {
  siteUrl();
  // Push is sent from the Node.js server only. This file is built for the edge too, where web-push cannot load.
  if (process.env.NEXT_RUNTIME === "nodejs") (await import("@/lib/push")).registerPush();
}
