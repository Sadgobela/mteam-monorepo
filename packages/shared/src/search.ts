import { z } from "zod";
import { isFeature, specKeys, type SpecName } from "./details";
import { cityDistricts, isCity, isMetro, METRO_CITY } from "./places";

export const dealTypes = ["sale", "rent", "daily", "pledge", "lease"] as const;
export type DealType = (typeof dealTypes)[number];

export const propertyTypes = ["apartment", "house", "country", "commercial", "land", "hotel"] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const buildingStatuses = ["old", "new", "construction"] as const;
export type BuildingStatus = (typeof buildingStatuses)[number];
const isBuildingStatus = (value: string): value is BuildingStatus => (buildingStatuses as readonly string[]).includes(value);

export const currencies = ["USD", "GEL"] as const;
export type Currency = (typeof currencies)[number];

/** Room counts offered in search. The last one means "this many or more". */
export const roomOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const floorPositions = ["last", "notLast", "notFirst"] as const;
export type FloorPosition = (typeof floorPositions)[number];

/** In USD. Keeps a bound well inside the Int price column. */
export const MAX_PRICE = 100_000_000;

const price = z
  .string()
  .regex(/^\d{1,9}$/)
  .transform(Number)
  .refine((value) => value <= MAX_PRICE)
  .optional()
  .catch(undefined);

const wholeNumber = z
  .string()
  .regex(/^\d{1,7}$/)
  .transform(Number)
  .optional()
  .catch(undefined);

/** Separated by "|", because some street names contain commas. */
const nameList = z
  .string()
  .min(1)
  .max(4000)
  .refine((value) => !value.includes("\0"))
  .transform((value) => value.split("|"))
  .optional()
  .catch(undefined);

const roomCount = z
  .string()
  .regex(/^([1-9]|10)$/)
  .transform(Number)
  .optional()
  .catch(undefined);

const decimal = z
  .string()
  .regex(/^\d{1,2}(\.\d{1,2})?$/)
  .transform(Number)
  .optional()
  .catch(undefined);

/** Any of a detail's fixed choices. */
const specFilter = (name: SpecName) =>
  z
    .string()
    .max(200)
    .transform((value) => {
      const known = [...new Set(value.split("|").filter((key) => specKeys(name).includes(key)))];
      return known.length > 0 ? known : undefined;
    })
    .optional()
    .catch(undefined);

const filtersSchema = z.object({
  deal: z.enum(dealTypes).optional().catch(undefined),
  type: z.enum(propertyTypes).optional().catch(undefined),
  /** A city's name exactly as it is stored on listings. */
  city: z.string().refine(isCity).optional().catch(undefined),
  /** Exact names. They only mean something inside a city. */
  district: nameList,
  street: nameList,
  metro: z.string().refine(isMetro).optional().catch(undefined),
  building: z
    .string()
    .max(60)
    .transform((value) => {
      const known = [...new Set(value.split("|").filter(isBuildingStatus))];
      return known.length > 0 ? known : undefined;
    })
    .optional()
    .catch(undefined),
  belowMarket: z
    .literal("1")
    .transform(() => true)
    .optional()
    .catch(undefined),
  owner: z
    .literal("1")
    .transform(() => true)
    .optional()
    .catch(undefined),
  sqmMin: price,
  sqmMax: price,
  priceMin: price,
  priceMax: price,
  rooms: roomCount,
  bedrooms: roomCount,
  floorsMin: wholeNumber,
  floorsMax: wholeNumber,
  floorPos: z.enum(floorPositions).optional().catch(undefined),
  ceilingMin: decimal,
  ceilingMax: decimal,
  condition: specFilter("condition"),
  projectType: specFilter("projectType"),
  bathroom: specFilter("bathroom"),
  storage: specFilter("storage"),
  parking: specFilter("parking"),
  heating: specFilter("heating"),
  hotWater: specFilter("hotWater"),
  material: specFilter("material"),
  windows: specFilter("windows"),
  livingRoom: specFilter("livingRoom"),
  features: z
    .string()
    .max(1000)
    .transform((value) => {
      const known = [...new Set(value.split("|").filter(isFeature))];
      return known.length > 0 ? known : undefined;
    })
    .optional()
    .catch(undefined),
  areaMin: wholeNumber,
  areaMax: wholeNumber,
  floorMin: wholeNumber,
  floorMax: wholeNumber,
  /** Free text matched against district, address, city and title. */
  q: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => !value.includes("\0"))
    .optional()
    .catch(undefined),
  verified: z
    .literal("1")
    .transform(() => true)
    .optional()
    .catch(undefined),
});

export type ListingFilters = z.infer<typeof filtersSchema>;

/** Reads filters from a URL's query. A missing or invalid value simply means that filter is off. */
export function parseListingFilters(query: Record<string, string | string[] | undefined>): ListingFilters {
  const filters = filtersSchema.parse(query);
  if (!filters.city) return { ...filters, district: undefined, street: undefined };
  const known = cityDistricts(filters.city);
  const district = [...new Set(filters.district?.filter((name) => known.includes(name)))];
  const street = [...new Set(filters.street?.filter(Boolean))];
  return {
    ...filters,
    district: district.length > 0 ? district : undefined,
    street: street.length > 0 ? street : undefined,
    metro: filters.city === METRO_CITY ? filters.metro : undefined,
  };
}

const MAX_SAVED_QUERY = 2000;

/** A search as stable URL parameters: only filters that mean something, in a fixed order. Empty when there are none, or too many to keep. */
export function canonicalSearch(query: Record<string, string | string[] | undefined>): string {
  const filters = parseListingFilters(query);
  const kept = Object.entries(filters).flatMap(([name, value]) => (value === undefined ? [] : [[name, String(query[name])]]));
  const search = new URLSearchParams(kept.sort(([a], [b]) => a.localeCompare(b))).toString();
  return search.length <= MAX_SAVED_QUERY ? search : "";
}

export const sortOrders = ["new", "asc", "desc"] as const;
export type SortOrder = (typeof sortOrders)[number];
export type DisplayCurrency = "usd" | "gel";

const displaySchema = z.object({
  sort: z.enum(sortOrders).catch("new"),
  view: z.enum(["grid", "list", "map"]).catch("grid"),
  cur: z.enum(["usd", "gel"]).catch("usd"),
  page: z
    .string()
    .regex(/^[1-9]\d{0,5}$/)
    .transform(Number)
    .catch(1),
});

export type ListingDisplay = z.infer<typeof displaySchema>;

/** Reads how results are shown from a URL's query. A missing or invalid value falls back to the default. */
export function parseListingDisplay(query: Record<string, string | string[] | undefined>): ListingDisplay {
  return displaySchema.parse(query);
}

// ponytail: fixed rate. GEL drifts, so use a stored daily rate before launch.
const unitsPerUsd: Record<Currency, number> = { USD: 1, GEL: 2.7 };

export function priceInUsd(price: number, currency: Currency): number {
  return Math.round(price / unitsPerUsd[currency]);
}

/** A dollar filter in lari, on a round number when that still means the same dollars, so 150000 reads back as 150000. */
export function priceInLari(usd: number): number {
  const rounded = Math.round((usd * unitsPerUsd.GEL) / 10) * 10;
  return priceInUsd(rounded, "GEL") === usd ? rounded : Math.round(usd * unitsPerUsd.GEL);
}

/** Converts a price into the currency the visitor chose to see. */
export function convertPrice(price: number, currency: Currency, target: DisplayCurrency): number {
  const usd = price / unitsPerUsd[currency];
  return Math.round(target === "gel" ? usd * unitsPerUsd.GEL : usd);
}
