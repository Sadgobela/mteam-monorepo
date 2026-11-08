import Link from "next/link";
import type { Dict, ListingFilters, Locale } from "@mteam/shared";
import { resultsHref, type Query } from "@/lib/url";

/** The active filters as links that remove themselves, so a search can be widened one step at a time. */
export function FilterChips({
  locale,
  t,
  query,
  filters,
}: {
  locale: Locale;
  t: Dict;
  query: Query;
  filters: ListingFilters;
}) {
  const number = (value: number | undefined, label: string) => (value === undefined ? undefined : `${label} ${value}`);
  const chips: [string, string | undefined][] = [
    ["deal", filters.deal && t.deal[filters.deal]],
    ["type", filters.type && t.propertyType[filters.type]],
    ["city", filters.city && t.city[filters.city]],
    ["q", filters.q],
    ["verified", filters.verified ? "mTeam Verified" : undefined],
    ["rooms", number(filters.rooms, t.search.rooms)],
    ["priceMin", number(filters.priceMin, t.search.priceMin)],
    ["priceMax", number(filters.priceMax, t.search.priceMax)],
    ["areaMin", number(filters.areaMin, t.search.areaMin)],
    ["areaMax", number(filters.areaMax, t.search.areaMax)],
  ];
  const active = chips.filter((chip): chip is [string, string] => chip[1] !== undefined);
  if (active.length === 0) return null;
  return (
    <div className="chips">
      {active.map(([key, label]) => (
        <Link key={key} href={resultsHref(locale, query, { [key]: "", page: "1" })} aria-label={`${t.results.removeFilter}: ${label}`}>
          {label} <span aria-hidden="true">×</span>
        </Link>
      ))}
    </div>
  );
}
