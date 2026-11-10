import type { Metadata } from "next";
import { getDictionary, locales, parseListingFilters, placeLabel, type Listing, type Locale } from "@mteam/shared";
import { z } from "zod";
import { cardTitle } from "@/components/ListingCard";
import type { Query } from "@/lib/url";

const DESCRIPTION_LENGTH = 160;
/** A search page is worth indexing with only these. Sorted, paged or finely filtered versions would be near-copies. */
const INDEXED_FILTERS = ["deal", "type", "city"] as const;

/** Search engines need absolute addresses. */
export function siteUrl(): string {
  return z.url().default("http://localhost:3111").parse(process.env.SITE_URL);
}

/** The address of this page, and of the same page in the other languages. `path` starts after the language. */
export function languageAlternates(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  return { canonical: `/${locale}${path}`, languages: Object.fromEntries(locales.map((language) => [language, `/${language}${path}`])) };
}

/** The address of a search by deal, type and city, after the language. */
export function searchPath(filters: { deal?: string; type?: string; city?: string }): string {
  const known = INDEXED_FILTERS.flatMap((name) => (filters[name] ? [[name, filters[name]]] : []));
  return known.length > 0 ? `?${new URLSearchParams(known)}` : "";
}

export function searchMetadata(locale: Locale, query: Query): Metadata {
  const t = getDictionary(locale);
  const filters = parseListingFilters(query);
  const alternates = languageAlternates(searchPath(filters), locale);
  const indexed = Object.keys(query).every((name) => (INDEXED_FILTERS as readonly string[]).includes(name));
  const robots = indexed ? undefined : { index: false, follow: true };
  const title = [filters.deal && t.deal[filters.deal], filters.type && t.propertyType[filters.type], filters.city && placeLabel(filters.city, locale)].filter(Boolean).join(" · ");
  // Written out because a layout's title template does not reach a page in its own segment.
  return title ? { title: `${title} | MTeam`, alternates, robots } : { alternates, robots };
}

export function listingMetadata(listing: Listing, locale: Locale): Metadata {
  const title = cardTitle(listing, locale, getDictionary(locale));
  const description = listing.description.slice(0, DESCRIPTION_LENGTH);
  return {
    title,
    description,
    alternates: languageAlternates(`/listings/${listing.id}`, locale),
    openGraph: { title, description, images: listing.images.slice(0, 1) },
  };
}
