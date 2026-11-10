import type { MetadataRoute } from "next";
import { locales } from "@mteam/shared";
import { siteUrl } from "@/lib/site-url";

const PRIVATE_PAGES = ["admin", "login", "favorites", "my-listings", "listings/new"];

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", ...locales.flatMap((locale) => PRIVATE_PAGES.map((page) => `/${locale}/${page}`))] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
