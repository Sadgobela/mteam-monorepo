import { siteUrl } from "@/lib/site-url";

/** Runs once when the server starts, so a wrong address stops a deploy instead of breaking every page. */
export function register(): void {
  siteUrl();
}
