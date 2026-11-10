import type { Metadata } from "next";
import { countListings } from "@mteam/db";
import { getDictionary, locales, parseListingFilters, placeLabel, type Listing, type ListingFilters, type Locale } from "@mteam/shared";
import { cardTitle } from "@/components/ListingCard";
import type { Query } from "@/lib/url";

const DESCRIPTION_LENGTH = 160;
/** A search page is worth indexing with only these. Sorted, paged or finely filtered versions would be near-copies. */
const INDEXED_FILTERS = ["deal", "type", "city"] as const;

/** The address of this page, and of the same page in the other languages. `path` starts after the language. */
export function languageAlternates(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  return { canonical: `/${locale}${path}`, languages: Object.fromEntries(locales.map((language) => [language, `/${language}${path}`])) };
}

/** The address of a search by deal, type and city, after the language. */
export function searchPath(filters: { deal?: string; type?: string; city?: string }): string {
  const known = INDEXED_FILTERS.flatMap((name) => (filters[name] ? [[name, filters[name]]] : []));
  return known.length > 0 ? `?${new URLSearchParams(known)}` : "";
}

/** A search's deal, type and city, in the page language. */
export function searchName(filters: ListingFilters, locale: Locale): string {
  const t = getDictionary(locale);
  return [filters.deal && t.deal[filters.deal], filters.type && t.propertyType[filters.type], filters.city && placeLabel(filters.city, locale)].filter(Boolean).join(" · ");
}

export async function searchMetadata(locale: Locale, query: Query): Promise<Metadata> {
  const filters = parseListingFilters(query);
  const alternates = languageAlternates(searchPath(filters), locale);
  const title = searchName(filters, locale);
  const indexed = Object.keys(query).every((name) => (INDEXED_FILTERS as readonly string[]).includes(name));
  // An empty result page is a dead end for someone arriving from a search engine.
  const worthIndexing = indexed && (title === "" || (await countListings(filters)) > 0);
  const robots = worthIndexing ? undefined : { index: false, follow: true };
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
