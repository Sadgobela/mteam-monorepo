import { z } from "zod";
import { isFeature, specKeys, type SpecName } from "./details";
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

/** One of a detail's fixed choices, or blank. */
const spec = (name: SpecName) => z.union([z.literal("").transform(() => undefined), z.enum(specKeys(name) as [string, ...string[]])]).optional();

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
    condition: spec("condition"),
    projectType: spec("projectType"),
    bathroom: spec("bathroom"),
    storage: spec("storage"),
    parking: spec("parking"),
    heating: spec("heating"),
    hotWater: spec("hotWater"),
    material: spec("material"),
    windows: spec("windows"),
    livingRoom: spec("livingRoom"),
    bedrooms: optionalWhole(1, 50),
    yearBuilt: optionalWhole(1800, 2100),
    ceiling: z
      .union([
        z.literal("").transform(() => undefined),
        z
          .string()
          .regex(/^\d{1,2}(\.\d{1,2})?$/)
          .transform(Number)
          .refine((value) => value >= 1 && value <= 20),
      ])
      .optional(),
    features: z
      .string()
      .max(2000)
      .transform((value) => [...new Set(value.split("|").filter(isFeature))])
      .optional(),
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

/** The columns a listing can be given. */
export const draftFields = Object.keys(draftSchema.shape);

/** Which fields of a draft are wrong, for a bulk import's report. A rule across several fields has no single name. */
export function draftProblems(fields: Record<string, unknown>): string[] {
  const result = draftSchema.safeParse(fields);
  if (result.success) return [];
  const named = result.error.issues.map((issue) => issue.path.join(".")).filter(Boolean);
  return named.length > 0 ? [...new Set(named)] : ["combination"];
}

export const MAX_MESSAGE = 2000;

const messageSchema = text(MAX_MESSAGE).transform((value) => value.trim()).refine((value) => value.length > 0);

/** A chat message, or null if there is nothing to send. */
export function parseMessage(input: unknown): string | null {
  const result = messageSchema.safeParse(input);
  return result.success ? result.data : null;
}

export const reportReasons = ["sold", "wrongPrice", "wrongPhotos", "fake", "other"] as const;

const reportSchema = z.object({
  reason: z.enum(reportReasons),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || undefined)
    .optional(),
});

export type ReportDraft = z.infer<typeof reportSchema>;

/** Validates a report on a listing. Unknown form fields are dropped. */
export function parseReport(fields: Record<string, unknown>): ReportDraft | null {
  const result = reportSchema.safeParse(fields);
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
