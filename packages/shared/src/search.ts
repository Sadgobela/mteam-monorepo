import { z } from "zod";

export const dealTypes = ["sale", "rent", "daily"] as const;
export type DealType = (typeof dealTypes)[number];

export const propertyTypes = ["apartment", "house", "commercial", "land"] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const currencies = ["USD", "GEL", "AED"] as const;
export type Currency = (typeof currencies)[number];

export const citySlugs = ["tbilisi", "batumi", "dubai"] as const;
export type CitySlug = (typeof citySlugs)[number];

/** A city's name exactly as it is stored on listings. */
export const cityNames: Record<CitySlug, string> = { tbilisi: "თბილისი", batumi: "ბათუმი", dubai: "დუბაი" };

/** Room counts offered in search. The last one means "this many or more". */
export const roomOptions = [1, 2, 3, 4] as const;

/** In USD. Keeps a bound well inside the Int price column. */
const MAX_PRICE = 100_000_000;

const price = z
  .string()
  .regex(/^\d{1,9}$/)
  .transform(Number)
  .refine((value) => value <= MAX_PRICE)
  .optional()
  .catch(undefined);

const filtersSchema = z.object({
  deal: z.enum(dealTypes).optional().catch(undefined),
  type: z.enum(propertyTypes).optional().catch(undefined),
  city: z.enum(citySlugs).optional().catch(undefined),
  priceMin: price,
  priceMax: price,
  rooms: z
    .string()
    .regex(/^[1-4]$/)
    .transform(Number)
    .optional()
    .catch(undefined),
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
  return filtersSchema.parse(query);
}

export const sortOrders = ["new", "asc", "desc"] as const;
export type SortOrder = (typeof sortOrders)[number];
export type DisplayCurrency = "usd" | "gel";

const displaySchema = z.object({
  sort: z.enum(sortOrders).catch("new"),
  view: z.enum(["grid", "list"]).catch("grid"),
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

// ponytail: fixed rates. AED is pegged to USD; GEL drifts, so use a stored daily rate before launch.
const unitsPerUsd: Record<Currency, number> = { USD: 1, GEL: 2.7, AED: 3.6725 };

export function priceInUsd(price: number, currency: Currency): number {
  return Math.round(price / unitsPerUsd[currency]);
}

/** Converts a price into the currency the visitor chose to see. */
export function convertPrice(price: number, currency: Currency, target: DisplayCurrency): number {
  const usd = price / unitsPerUsd[currency];
  return Math.round(target === "gel" ? usd * unitsPerUsd.GEL : usd);
}
