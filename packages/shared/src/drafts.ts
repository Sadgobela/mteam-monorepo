import { z } from "zod";
import { isFeature, specKeys, type SpecName } from "./details";
import { cityDistricts, isCity, isMetro, METRO_CITY } from "./places";
import { buildingStatuses, canonicalSearch, currencies, dealTypes, FALLBACK_GEL_PER_USD, MAX_PRICE, priceInUsd, propertyTypes } from "./search";

/** Georgian mobile numbers only, in any common spelling. Returns +9955XXXXXXXX, or null. */
export function parsePhone(input: string): string | null {
  const national = input.replace(/[\s()-]/g, "").replace(/^(\+995|00995|995)/, "");
  return /^5\d{8}$/.test(national) ? `+995${national}` : null;
}

export const MAX_PHOTOS = 16;
/** Photos go up one per request, and a Vercel function refuses a body over 4.5 MB, so one photo plus the form's framing must stay below that. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** How the server names a stored photo, `listings/<uuid>.webp`, and its small copy, `listings/<uuid>_thumb.webp`. */
const storedPhoto = /(\/listings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;

/**
 * The small copy of a photo, for cards and previews. Photos stored before copies were made, and imported ones on other hosts,
 * have none, so anything not named like ours comes back unchanged; an older photo of ours that has no copy needs an image's onError fallback.
 */
export function thumbUrl(url: string): string {
  return url.replace(storedPhoto, "$1_thumb.webp");
}

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

const blankOr = <T extends z.ZodType>(schema: T) => z.union([z.literal("").transform(() => undefined), schema]).optional();

const draftObject = z.object({
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
    descriptionEn: blankOr(text(5000)),
    descriptionRu: blankOr(text(5000)),
    /** The public registry's number, digits in dot-separated groups. Kept for MTeam, never shown on the site. */
    cadastralCode: blankOr(z.string().trim().max(40).regex(/^\d+(\.\d+)*$/)),
    /** A ticked box posts "on"; an unticked one posts nothing. */
    hidePhone: z.literal("on").optional().transform((value) => value === "on"),
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
});

const draftSchema = draftObject
  // Exact names, or searching by district would miss the listing. Places without districts have none to give.
  .refine((d) => (cityDistricts(d.city).length === 0 ? d.district === undefined : cityDistricts(d.city).includes(d.district ?? "")))
  .refine((d) => d.metro === undefined || d.city === METRO_CITY)
  // Keeps the stored price per m² inside its column.
  .refine((d) => priceInUsd(d.price, d.currency, FALLBACK_GEL_PER_USD) / d.area <= MAX_PRICE)
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
export const draftFields = Object.keys(draftObject.shape);

/** An unfinished form, saved as a draft: each field filled in must be valid, but only the deal, type and city must be there. */
const progressSchema = draftObject.partial().required({ deal: true, type: true, city: true });

export type DraftProgress = z.infer<typeof progressSchema>;

/** Validates a form part way through, for an autosaved draft. A draft is checked in full with `parseListingDraft` before it is sent for review. */
export function parseDraftProgress(fields: Record<string, unknown>): DraftProgress | null {
  // Blank means not filled in yet, which a required field like the price would otherwise refuse.
  const result = progressSchema.safeParse(Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== "")));
  return result.success ? result.data : null;
}

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
  deal: z.enum(["sale", "rent", "daily"]),
  /** Set when someone looking for a property asks a broker to find it: the search they made. */
  search: z
    .string()
    .max(2000)
    .optional()
    .transform((value) => (value && canonicalSearch(Object.fromEntries(new URLSearchParams(value)))) || undefined),
})
  // Owners hand over a sale or a rental; daily stays only come from a search.
  .refine((lead) => lead.search !== undefined || lead.deal !== "daily");

export type LeadDraft = z.infer<typeof leadSchema>;

/** Validates a "Give it to MTeam" request, or a request for a broker to find a property. */
export function parseLead(fields: Record<string, unknown>): LeadDraft | null {
  const result = leadSchema.safeParse(fields);
  return result.success ? result.data : null;
}
