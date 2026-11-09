import { z } from "zod";
import { cityDistricts, isCity, isMetro, METRO_CITY } from "./places";
import { buildingStatuses, currencies, dealTypes, MAX_PRICE, priceInUsd, propertyTypes } from "./search";

/** Georgian mobile numbers only, in any common spelling. Returns +9955XXXXXXXX, or null. */
export function parsePhone(input: string): string | null {
  const national = input.replace(/[\s()-]/g, "").replace(/^(\+995|00995|995)/, "");
  return /^5\d{8}$/.test(national) ? `+995${national}` : null;
}

export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Postgres text columns cannot hold a NUL byte. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !value.includes("\0"));

const whole = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d{1,10}$/)
    .transform(Number)
    .refine((value) => value >= min && value <= max);

const optionalWhole = (min: number, max: number) =>
  z.union([z.literal("").transform(() => undefined), whole(min, max)]).optional();

const coordinate = (limit: number) =>
  z
    .union([
      z.literal("").transform(() => undefined),
      z
        .string()
        .regex(/^-?\d{1,3}(\.\d{1,8})?$/)
        .transform(Number)
        .refine((value) => Math.abs(value) <= limit),
    ])
    .optional();

const draftSchema = z
  .object({
    deal: z.enum(dealTypes),
    type: z.enum(propertyTypes),
    city: z.string().refine(isCity),
    district: text(100).optional(),
    address: text(200),
    street: z.union([z.literal("").transform(() => undefined), text(120)]).optional(),
    metro: z.union([z.literal("").transform(() => undefined), z.string().refine(isMetro)]).optional(),
    building: z.union([z.literal("").transform(() => undefined), z.enum(buildingStatuses)]).optional(),
    title: text(120),
    description: text(5000),
    price: whole(1, 2_000_000_000),
    currency: z.enum(currencies),
    area: z
      .string()
      .regex(/^\d{1,7}(\.\d{1,2})?$/)
      .transform(Number)
      .refine((value) => value > 0),
    rooms: optionalWhole(1, 50),
    floor: optionalWhole(1, 200),
    floors: optionalWhole(1, 200),
    lat: coordinate(90),
    lng: coordinate(180),
  })
  // Exact names, or searching by district would miss the listing. Places without districts have none to give.
  .refine((d) => (cityDistricts(d.city).length === 0 ? d.district === undefined : cityDistricts(d.city).includes(d.district ?? "")))
  .refine((d) => d.metro === undefined || d.city === METRO_CITY)
  // Keeps the stored price per m² inside its column.
  .refine((d) => priceInUsd(d.price, d.currency) / d.area <= MAX_PRICE)
  .refine((d) => d.rooms !== undefined || d.type === "commercial" || d.type === "land" || d.type === "hotel")
  .refine((d) => (d.lat === undefined) === (d.lng === undefined))
  .refine((d) => (d.floor === undefined) === (d.floors === undefined) && (d.floor ?? 0) <= (d.floors ?? 0));

export type ListingDraft = z.infer<typeof draftSchema>;

/** Validates a submitted listing form. Owner, status and verification are never read from it. */
export function parseListingDraft(fields: Record<string, unknown>): ListingDraft | null {
  const result = draftSchema.safeParse(fields);
  return result.success ? result.data : null;
}

const leadSchema = z.object({
  name: text(100),
  phone: z.string().transform((value, context) => {
    const phone = parsePhone(value);
    if (!phone) context.addIssue({ code: "custom", message: "invalid phone" });
    return phone ?? "";
  }),
  deal: z.enum(["sale", "rent"]),
});

export type LeadDraft = z.infer<typeof leadSchema>;

/** Validates a "Give it to MTeam" request. */
export function parseLead(fields: Record<string, unknown>): LeadDraft | null {
  const result = leadSchema.safeParse(fields);
  return result.success ? result.data : null;
}
