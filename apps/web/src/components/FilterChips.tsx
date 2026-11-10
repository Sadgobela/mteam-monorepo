import Link from "next/link";
import { priceInLari, featureLabel, placeLabel, specLabel, specNames, specTitles, type Dict, type ListingFilters, type Locale, type SpecName } from "@mteam/shared";
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
  const list = (names: string[] | undefined) => names && placeLabel(names[0], locale) + (names.length > 1 ? ` +${names.length - 1}` : "");
  // Prices are stored in dollars; shown in the currency the visitor chose.
  const money = (value: number | undefined, label: string) => (query.cur === "gel" ? number(value === undefined ? value : priceInLari(value), label.replace("$", "₾")) : number(value, label));
  const chips: [string, string | undefined][] = [
    ["deal", filters.deal && t.deal[filters.deal]],
    ["type", filters.type && t.propertyType[filters.type]],
    ["city", filters.city && placeLabel(filters.city, locale)],
    ["district", list(filters.district)],
    ["street", list(filters.street)],
    ["metro", filters.metro && `${t.search.metro}: ${placeLabel(filters.metro, locale)}`],
    ["building", filters.building?.map((status) => t.search.building[status]).join(", ")],
    ["owner", filters.owner ? t.search.ownerOnly : undefined],
    ["belowMarket", filters.belowMarket ? t.market.below : undefined],
    ["sqmMin", money(filters.sqmMin, t.search.sqmMin)],
    ["sqmMax", money(filters.sqmMax, t.search.sqmMax)],
    ["bedrooms", number(filters.bedrooms, t.post.fields.bedrooms)],
    ["floorsMin", number(filters.floorsMin, t.search.floorsMin)],
    ["floorsMax", number(filters.floorsMax, t.search.floorsMax)],
    ["ceilingMin", number(filters.ceilingMin, t.search.ceilingMin)],
    ["ceilingMax", number(filters.ceilingMax, t.search.ceilingMax)],
    ["floorPos", filters.floorPos && t.search.floorPos[filters.floorPos]],
    ...specNames.map((name): [SpecName, string | undefined] => [name, filters[name] && `${specTitles[name][locale]}: ${filters[name].map((key) => specLabel(name, key, locale)).join(", ")}`]),
    ["features", filters.features && featureLabel(filters.features[0], locale) + (filters.features.length > 1 ? ` +${filters.features.length - 1}` : "")],
    ["q", filters.q],
    ["verified", filters.verified ? "MTeam Verified" : undefined],
    ["rooms", number(filters.rooms, t.search.rooms)],
    ["priceMin", money(filters.priceMin, t.search.priceMin)],
    ["priceMax", money(filters.priceMax, t.search.priceMax)],
    ["areaMin", number(filters.areaMin, t.search.areaMin)],
    ["areaMax", number(filters.areaMax, t.search.areaMax)],
    ["floorMin", number(filters.floorMin, t.search.floorMin)],
    ["floorMax", number(filters.floorMax, t.search.floorMax)],
  ];
  const active = chips.filter((chip): chip is [string, string] => chip[1] !== undefined);
  if (active.length === 0) return null;
  return (
    <div className="chips">
      {active.map(([key, label]) => (
        <Link key={key} href={resultsHref(locale, query, { [key]: "", page: "1", ...(key === "district" && { street: "" }) })} aria-label={`${t.results.removeFilter}: ${label}`}>
          {label} <span aria-hidden="true">×</span>
        </Link>
      ))}
    </div>
  );
}
