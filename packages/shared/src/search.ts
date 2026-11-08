import { z } from "zod";

export const dealTypes = ["sale", "rent", "daily"] as const;
export type DealType = (typeof dealTypes)[number];

export const propertyTypes = ["apartment", "house", "commercial", "land"] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const citySlugs = ["tbilisi", "batumi", "dubai"] as const;
export type CitySlug = (typeof citySlugs)[number];

/** A city's name exactly as it is stored on listings. */
export const cityNames: Record<CitySlug, string> = { tbilisi: "თბილისი", batumi: "ბათუმი", dubai: "დუბაი" };

/** Room counts offered in search. The last one means "this many or more". */
export const roomOptions = [1, 2, 3, 4] as const;

/** In USD. Keeps the bound inside the Int price column after converting to any currency. */
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
});

export type ListingFilters = z.infer<typeof filtersSchema>;

/** Reads filters from a URL's query. A missing or invalid value simply means that filter is off. */
export function parseListingFilters(query: Record<string, string | string[] | undefined>): ListingFilters {
  return filtersSchema.parse(query);
}
