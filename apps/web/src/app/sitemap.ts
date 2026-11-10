import type { MetadataRoute } from "next";
import { sitemapListings, sitemapSearches } from "@mteam/db";
import { defaultLocale, locales } from "@mteam/shared";
import { searchPath } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  // Next writes these into the XML as they are, and a bare & makes the whole file invalid.
  const address = (locale: string, path: string) => `${base}/${locale}${path}`.replaceAll("&", "&amp;");
  // ponytail: only the Georgian address gets its own entry, the others are named as its alternates. A separate entry for each needs a sitemap index once listings pass about 15,000.
  const entry = (path: string, lastModified?: Date): MetadataRoute.Sitemap[number] => ({
    url: address(defaultLocale, path),
    lastModified,
    alternates: { languages: Object.fromEntries(locales.map((locale) => [locale, address(locale, path)])) },
  });
  const [listings, searches] = await Promise.all([sitemapListings(), sitemapSearches()]);
  return [entry(""), entry("/brokers"), entry("/prices"), entry("/mortgage"), ...searches.map((search) => entry(searchPath(search))), ...listings.map((listing) => entry(`/listings/${listing.id}`, listing.updatedAt))];
}
