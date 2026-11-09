import { z } from "zod";
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
export const roomOptions = [1, 2, 3, 4] as const;

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
  .transform((value) => value.split("|"))
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
  owner: z
    .literal("1")
    .transform(() => true)
    .optional()
    .catch(undefined),
  sqmMin: price,
  sqmMax: price,
  priceMin: price,
  priceMax: price,
  rooms: z
    .string()
    .regex(/^[1-4]$/)
    .transform(Number)
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

/** Converts a price into the currency the visitor chose to see. */
export function convertPrice(price: number, currency: Currency, target: DisplayCurrency): number {
  const usd = price / unitsPerUsd[currency];
  return Math.round(target === "gel" ? usd * unitsPerUsd.GEL : usd);
}
