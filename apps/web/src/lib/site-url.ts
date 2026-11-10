import { z } from "zod";

/** The site's origin. Search engines need absolute addresses, and a production server has no safe guess. */
export function siteUrl(): string {
  const address = process.env.SITE_URL || (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3111");
  return new URL(z.url({ protocol: /^https?$/ }).parse(address)).origin;
}
