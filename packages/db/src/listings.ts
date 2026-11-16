import type { BuildingStatus as DbBuildingStatus, DealType as DbDealType, ListingStatus, Prisma, PropertyType as DbPropertyType } from "@prisma/client";
import {
  draftFields,
  type DraftProgress,
  specKeys,
  specNames,
  type BuildingStatus,
  roomOptions,
  type DealType,
  type Listing,
  type ListingDraft,
  type ListingFilters,
  priceInUsd,
  type PropertyType,
  type SortOrder,
} from "@mteam/shared";
import { z } from "zod";
import { db } from "./client";
import { getGelPerUsd } from "./rates";

export const PAGE_SIZE = 24;
const POSTGRES_INT_MAX = 2147483647;
/** Market levels 1 and 2. */
const BELOW_MARKET = 2;

const deals: Record<DbDealType, DealType> = { SALE: "sale", RENT: "rent", DAILY: "daily", PLEDGE: "pledge", LEASE: "lease" };
const propertyTypes: Record<DbPropertyType, PropertyType> = {
  APARTMENT: "apartment",
  HOUSE: "house",
  COMMERCIAL: "commercial",
  LAND: "land",
  COUNTRY_HOUSE: "country",
  HOTEL: "hotel",
};
const dbDeals: Record<DealType, DbDealType> = { sale: "SALE", rent: "RENT", daily: "DAILY", pledge: "PLEDGE", lease: "LEASE" };
const dbPropertyTypes: Record<PropertyType, DbPropertyType> = {
  apartment: "APARTMENT",
  house: "HOUSE",
  commercial: "COMMERCIAL",
  land: "LAND",
  country: "COUNTRY_HOUSE",
  hotel: "HOTEL",
};
const buildings: Record<DbBuildingStatus, BuildingStatus> = { OLD: "old", NEW: "new", CONSTRUCTION: "construction" };
const dbBuildings: Record<BuildingStatus, DbBuildingStatus> = { old: "OLD", new: "NEW", construction: "CONSTRUCTION" };
const tones = ["violet", "sand", "steel", "rose"] as const;

/** Only what a public page may show: names and emails stay out, and the phone is the listing's contact number. */
export const publicInclude = {
  agent: { include: { branch: true, user: { select: { name: true, phone: true, role: true } } } },
  images: { select: { url: true }, orderBy: { position: "asc" } },
  owner: { select: { phone: true } },
  verifiedBy: { select: { user: { select: { name: true } } } },
} satisfies Prisma.ListingInclude;

type ListingRow = Prisma.ListingGetPayload<{ include: typeof publicInclude }>;

/** Digits only, so "1e3" or " 12" do not resolve to a listing, and within the column's range. */
const listingIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .transform(Number)
  .refine((id) => id <= POSTGRES_INT_MAX);

export function toListing(row: ListingRow): Listing {
  // A listing can outlive its broker's role; a phone is only public while that person is a broker.
  const agent = row.agent?.user.role === "AGENT" ? row.agent : null;
  return {
    id: row.id,
    deal: deals[row.deal],
    type: propertyTypes[row.type],
    title: row.title,
    city: row.city,
    // The posting form requires district and address; rooms is 0 for property without rooms, and the UI hides it.
    district: row.district ?? "",
    address: row.address ?? "",
    street: row.street ?? undefined,
    metro: row.metro ?? undefined,
    building: row.building ? buildings[row.building] : undefined,
    rooms: row.rooms ?? 0,
    price: row.price,
    currency: row.currency,
    area: row.area,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    floor: row.floor ?? undefined,
    floors: row.floors ?? undefined,
    specs: Object.fromEntries(specNames.flatMap((name) => (specKeys(name).includes(row[name] ?? "") ? [[name, row[name]]] : []))),
    features: row.features,
    bedrooms: row.bedrooms ?? undefined,
    ceiling: row.ceiling ?? undefined,
    yearBuilt: row.yearBuilt ?? undefined,
    description: row.description,
    descriptionEn: row.descriptionEn ?? undefined,
    descriptionRu: row.descriptionRu ?? undefined,
    verified: row.verified,
    marketLevel: row.marketLevel ?? undefined,
    agent: agent
      ? {
          id: agent.id,
          name: agent.user.name ?? "",
          branch: agent.branch?.name ?? "",
          // Brokers are made from a phone number (promoteUser), so this is always set.
          phone: agent.user.phone ?? "",
        }
      : undefined,
    verification: row.verifiedAt
      ? { by: row.verifiedBy?.user.name ?? "MTeam", at: row.verifiedAt.toISOString().slice(0, 10) }
      : undefined,
    // Posting needs a phone, so an owner without one (signed in with Google, Facebook or Apple) has no listings.
    contactPhone: agent?.user.phone ?? row.owner.phone ?? "",
    hidePhone: row.hidePhone,
    sellerId: row.ownerId,
    images: row.images.map((image) => image.url),
    // ponytail: placeholder gradient picked from the id, remove once every listing has photos.
    tone: tones[row.id % tones.length],
    updatedAt: row.updatedAt.toISOString().slice(0, 10),
  };
}

/** The top count means "this many or more". */
function roomsClause(rooms: number | undefined): Prisma.IntNullableFilter | number | undefined {
  return rooms === roomOptions[roomOptions.length - 1] ? { gte: rooms } : rooms;
}

function floorClause({ floorMin, floorMax, floorPos }: ListingFilters): Prisma.IntNullableFilter<"Listing"> {
  const floors = db().listing.fields.floors;
  return {
    gte: floorPos === "notFirst" ? Math.max(2, floorMin ?? 2) : floorMin,
    lte: floorMax,
    equals: floorPos === "last" ? floors : undefined,
    not: floorPos === "notLast" ? { equals: floors } : undefined,
  };
}

function textClause(q: string | undefined): Prisma.ListingWhereInput[] | undefined {
  if (q === undefined) return undefined;
  // Without escaping, % and _ would act as LIKE wildcards.
  const match = { contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } as const;
  const byId = /^\d{1,9}$/.test(q) ? [{ id: Number(q) }] : [];
  return [{ district: match }, { address: match }, { street: match }, { city: match }, { title: match }, ...byId];
}

function whereFor(filters: ListingFilters, located = false, hiddenIds: number[] = [], since?: Date): Prisma.ListingWhereInput {
  return {
    status: "ACTIVE",
    createdAt: since && { gt: since },
    id: hiddenIds.length > 0 ? { notIn: hiddenIds } : undefined,
    deal: filters.deal && dbDeals[filters.deal],
    type: filters.type && dbPropertyTypes[filters.type],
    city: filters.city,
    district: filters.district && { in: filters.district },
    street: filters.street && { in: filters.street },
    metro: filters.metro,
    building: filters.building && { in: filters.building.map((status) => dbBuildings[status]) },
    agentId: filters.owner ? null : undefined,
    pricePerSqmUsd: { gte: filters.sqmMin, lte: filters.sqmMax },
    rooms: roomsClause(filters.rooms),
    verified: filters.verified,
    marketLevel: filters.belowMarket ? { lte: BELOW_MARKET } : undefined,
    priceUsd: { gte: filters.priceMin, lte: filters.priceMax },
    area: { gte: filters.areaMin, lte: filters.areaMax },
    floor: floorClause(filters),
    floors: { gte: filters.floorsMin, lte: filters.floorsMax },
    ceiling: { gte: filters.ceilingMin, lte: filters.ceilingMax },
    bedrooms: roomsClause(filters.bedrooms),
    features: filters.features && { hasEvery: filters.features },
    ...Object.fromEntries(specNames.map((name) => [name, filters[name] && { in: filters[name] }])),
    lat: located ? { not: null } : undefined,
    lng: located ? { not: null } : undefined,
    OR: textClause(filters.q),
  };
}

const orderings: Record<Exclude<SortOrder, "new">, Prisma.ListingOrderByWithRelationInput[]> = {
  asc: [{ priceUsd: "asc" }, { id: "desc" }],
  desc: [{ priceUsd: "desc" }, { id: "desc" }],
};

const newestKey = (row: ListingRow) => (row.bumpedAt ?? row.createdAt).getTime();

/**
 * "Newest" is verified first (MTeam's default: trust leads, not paid placement), then by the last bump, else creation:
 * COALESCE(bumpedAt, createdAt), which Prisma cannot order by. Bumped and unbumped listings are each read in that order
 * and merged, which is exact for any page.
 */
async function newestRows(where: Prisma.ListingWhereInput, skip: number, take: number): Promise<ListingRow[]> {
  // ponytail: reads skip + take rows from each half, so deep pages cost more; a generated sort column fixes that if it matters.
  const [bumped, unbumped] = await Promise.all([
    db().listing.findMany({ where: { ...where, bumpedAt: { not: null } }, include: publicInclude, orderBy: [{ verified: "desc" }, { bumpedAt: "desc" }, { id: "desc" }], take: skip + take }),
    db().listing.findMany({ where: { ...where, bumpedAt: null }, include: publicInclude, orderBy: [{ verified: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: skip + take }),
  ]);
  return [...bumped, ...unbumped]
    .sort((a, b) => Number(b.verified) - Number(a.verified) || newestKey(b) - newestKey(a) || b.id - a.id)
    .slice(skip, skip + take);
}

/** One page of published listings matching the filters. No filters means all of them. */
export async function searchListings(
  filters: ListingFilters = {},
  {
    sort = "new",
    page = 1,
    limit = PAGE_SIZE,
    located = false,
    hiddenIds = [],
  }: { sort?: SortOrder; page?: number; limit?: number; located?: boolean; hiddenIds?: number[] } = {},
): Promise<Listing[]> {
  const where = whereFor(filters, located, hiddenIds);
  const skip = (page - 1) * limit;
  const rows =
    sort === "new"
      ? await newestRows(where, skip, limit)
      : await db().listing.findMany({ where, include: publicInclude, orderBy: orderings[sort], skip, take: limit });
  return rows.map(toListing);
}

/** How many published listings match the filters, across all pages. */
export function countListings(filters: ListingFilters = {}, { located = false, hiddenIds = [], since }: { located?: boolean; hiddenIds?: number[]; since?: Date } = {}): Promise<number> {
  return db().listing.count({ where: whereFor(filters, located, hiddenIds, since) });
}

const SIMILAR_LIMIT = 4;
const SIMILAR_PRICE_SPREAD = 0.3;

/** Same deal, type and city at a nearby price and size. */
export async function listSimilarListings(listing: Listing, hiddenIds: number[] = []): Promise<Listing[]> {
  const usd = priceInUsd(listing.price, listing.currency, await getGelPerUsd());
  const rows = await db().listing.findMany({
    where: {
      status: "ACTIVE",
      id: { not: listing.id, notIn: hiddenIds },
      deal: dbDeals[listing.deal],
      type: dbPropertyTypes[listing.type],
      city: listing.city,
      priceUsd: { gte: Math.round(usd * (1 - SIMILAR_PRICE_SPREAD)), lte: Math.round(usd * (1 + SIMILAR_PRICE_SPREAD)) },
      rooms: listing.rooms > 0 ? { gte: listing.rooms - 1, lte: listing.rooms + 1 } : undefined,
    },
    include: publicInclude,
    orderBy: [{ verified: "desc" }, { id: "desc" }],
    take: SIMILAR_LIMIT,
  });
  return rows.map(toListing);
}

const sellerWhere = (ownerId: string) => ({ status: "ACTIVE", ownerId, agentId: null, owner: { role: "USER" } }) satisfies Prisma.ListingWhereInput;

/** An owner's own published listings. Listings handled by a broker belong on the broker's page. */
export async function listSellerListings(ownerId: string): Promise<Listing[]> {
  if (!/^[\w-]{1,40}$/.test(ownerId)) return [];
  const rows = await db().listing.findMany({ where: sellerWhere(ownerId), include: publicInclude, orderBy: { id: "desc" }, take: 100 });
  return rows.map(toListing);
}

export function countSellerListings(ownerId: string): Promise<number> {
  return db().listing.count({ where: sellerWhere(ownerId) });
}

const SITEMAP_LIMIT = 45_000;

/** Every published listing, for the sitemap. One file holds 50,000 addresses at most. */
export function sitemapListings(): Promise<{ id: number; updatedAt: Date }[]> {
  return db().listing.findMany({ where: { status: "ACTIVE" }, select: { id: true, updatedAt: true }, orderBy: { id: "desc" }, take: SITEMAP_LIMIT });
}

/** The deal, type and city combinations that have something to show. */
export async function sitemapSearches(): Promise<{ deal: DealType; type: PropertyType; city: string }[]> {
  const rows = await db().listing.groupBy({ by: ["deal", "type", "city"], where: { status: "ACTIVE" } });
  return rows.map((row) => ({ deal: deals[row.deal], type: propertyTypes[row.type], city: row.city }));
}

/** Reads an id from untrusted text. Returns null for anything that is not a possible listing id. */
export function parseListingId(raw: string): number | null {
  const id = listingIdSchema.safeParse(raw);
  return id.success ? id.data : null;
}

/** Takes the raw URL segment. Unknown, unpublished and malformed ids all return undefined. */
export async function getListing(rawId: string): Promise<Listing | undefined> {
  const id = parseListingId(rawId);
  if (id === null) return undefined;
  const row = await db().listing.findFirst({ where: { id, status: "ACTIVE" }, include: publicInclude });
  return row ? toListing(row) : undefined;
}

/** Optional fields become nullable columns; the required ones stay as they are. */
type DraftColumns = { [K in keyof Required<DraftProgress>]: Exclude<DraftProgress[K], undefined> | (undefined extends DraftProgress[K] ? null : never) };

/**
 * A validated draft, finished or not, as listing columns, with dollar prices at the given rate. Every field is set, a blank one to
 * null, so an edit clears what was removed. An unfinished draft gets neutral values for the columns that cannot be empty.
 */
export function draftColumns(draft: DraftProgress, gelPerUsd: number) {
  const price = draft.price ?? 0;
  const area = draft.area ?? 0;
  const currency = draft.currency ?? "USD";
  const priceUsd = priceInUsd(price, currency, gelPerUsd);
  const columns = Object.fromEntries(draftFields.map((name) => [name, draft[name as keyof DraftProgress] ?? null])) as DraftColumns;
  return {
    ...columns,
    title: draft.title ?? "",
    description: draft.description ?? "",
    price,
    currency,
    area,
    features: draft.features ?? [],
    hidePhone: draft.hidePhone ?? false,
    priceUsd,
    pricePerSqmUsd: area > 0 ? Math.round(priceUsd / area) : 0,
    building: draft.building ? dbBuildings[draft.building] : null,
    deal: dbDeals[draft.deal],
    type: dbPropertyTypes[draft.type],
  };
}

const imageRows = (imageUrls: string[]) => imageUrls.map((url, position) => ({ url, position }));

/**
 * Saves a user's listing. It stays PENDING and unverified until MTeam reviews it. `agentId` is the poster's broker id when the
 * poster is a broker: a broker's listing is theirs to handle, and it never expires.
 */
export async function createListing(ownerId: string, draft: ListingDraft, imageUrls: string[], agentId: string | null = null): Promise<number> {
  const { id } = await db().listing.create({
    data: {
      ...draftColumns(draft, await getGelPerUsd()),
      status: "PENDING",
      verified: false,
      ownerId,
      agentId,
      images: { create: imageRows(imageUrls) },
    },
    select: { id: true },
  });
  return id;
}

/** Enough for someone posting several properties at once, few enough that autosave cannot pile up rows. */
const MAX_DRAFTS = 10;

/**
 * Autosaves an unfinished form as a DRAFT, which nobody else sees. Without an id it starts a new draft and returns its id; with
 * one it updates that draft. Returns null when the draft is not the user's, is no longer a draft, or the user has too many.
 * `agentId` as for `createListing`; it stays with the draft when it is sent for review.
 */
export async function saveDraft(ownerId: string, id: number | null, draft: DraftProgress, imageUrls: string[], agentId: string | null = null): Promise<number | null> {
  const columns = draftColumns(draft, await getGelPerUsd());
  if (id === null) {
    if ((await db().listing.count({ where: { ownerId, status: "DRAFT" } })) >= MAX_DRAFTS) return null;
    const created = await db().listing.create({
      data: { ...columns, status: "DRAFT", verified: false, ownerId, agentId, images: { create: imageRows(imageUrls) } },
      select: { id: true },
    });
    return created.id;
  }
  return db().$transaction(async (tx) => {
    const { count } = await tx.listing.updateMany({ where: { id, ownerId, status: "DRAFT" }, data: columns });
    if (count === 0) return null;
    await replaceImages(tx, id, imageUrls);
    return id;
  });
}

async function replaceImages(tx: Prisma.TransactionClient, listingId: number, imageUrls: string[]): Promise<void> {
  await tx.listingImage.deleteMany({ where: { listingId } });
  await tx.listingImage.createMany({ data: imageRows(imageUrls).map((image) => ({ ...image, listingId })) });
}

const EDITABLE: ListingStatus[] = ["DRAFT", "PENDING", "ACTIVE"];
/** Changing only these leaves a published listing published. */
const PRICE_FIELDS = new Set(["price", "currency"]);

/** Compares a stored value with a new one: the order features were ticked in does not matter. */
const sameValue = (stored: unknown, next: unknown) =>
  JSON.stringify(Array.isArray(stored) ? [...stored].sort() : stored) === JSON.stringify(Array.isArray(next) ? [...next].sort() : next);

/**
 * The owner's edit of a listing, sent for review. A draft or a pending listing becomes PENDING. A published one stays ACTIVE when
 * only its price changed, and goes back to PENDING for any other change, photos and their order included. Whenever a published
 * listing's price or currency changes, a `ListingPriceChange` row records the old and new dollar price, whatever the new status.
 * Any change but the price also removes MTeam's verification, which vouched for the content as it was.
 * Archived and rejected listings cannot be edited. Returns the new status, or null when the listing is not the user's or not editable.
 */
export async function updateListing(ownerId: string, id: number, draft: ListingDraft, imageUrls: string[]): Promise<ListingStatus | null> {
  const columns = draftColumns(draft, await getGelPerUsd());
  return db().$transaction(async (tx) => {
    const row = await tx.listing.findFirst({ where: { id, ownerId, status: { in: EDITABLE } }, include: { images: { select: { url: true }, orderBy: { position: "asc" } } } });
    if (!row) return null;
    const stored: Record<string, unknown> = row;
    const next: Record<string, unknown> = columns;
    const contentChanged =
      draftFields.some((name) => !PRICE_FIELDS.has(name) && !sameValue(stored[name], next[name])) || !sameValue(row.images.map((image) => image.url).join("\n"), imageUrls.join("\n"));
    const status: ListingStatus = row.status === "ACTIVE" && !contentChanged ? "ACTIVE" : "PENDING";
    // The status read above is part of the write, so a listing moderated in between is left alone.
    // Back in review it has no end date, or taking it down and renewing it would publish the change unreviewed. Approval sets a new one.
    // A broker's check confirmed the photos, area and price as they were, so changed content loses the badge; a new price alone keeps it.
    const { count } = await tx.listing.updateMany({
      where: { id, ownerId, status: row.status },
      data: {
        ...columns,
        status,
        ...(status === "PENDING" ? { expiresAt: null } : {}),
        ...(contentChanged ? { verified: false, verifiedAt: null, verifiedById: null } : {}),
      },
    });
    if (count === 0) return null;
    await replaceImages(tx, id, imageUrls);
    // From the entered price, not the dollar one: that is recalculated at today's rate, which would make every lari listing look repriced.
    if (row.status === "ACTIVE" && (row.price !== columns.price || row.currency !== columns.currency)) {
      await tx.listingPriceChange.create({ data: { listingId: id, oldPriceUsd: row.priceUsd, newPriceUsd: columns.priceUsd } });
    }
    return status;
  });
}

export interface EditableListing {
  id: number;
  status: ListingStatus;
  /** The form's starting values by field name, blank where nothing is set. */
  fields: Record<string, string>;
  images: string[];
}

/** The owner's own draft, pending or published listing, as the posting form's values. Includes the cadastral code, so it is only for the owner. */
export async function getEditableListing(ownerId: string, rawId: string): Promise<EditableListing | null> {
  const id = parseListingId(rawId);
  if (id === null) return null;
  const row = await db().listing.findFirst({ where: { id, ownerId, status: { in: EDITABLE } }, include: { images: { select: { url: true }, orderBy: { position: "asc" } } } });
  if (!row) return null;
  const stored: Record<string, unknown> = row;
  const text = (value: unknown) => (value === null || value === false ? "" : value === true ? "on" : Array.isArray(value) ? value.join("|") : String(value));
  return {
    id,
    status: row.status,
    fields: {
      ...Object.fromEntries(draftFields.map((name) => [name, text(stored[name])])),
      deal: deals[row.deal],
      type: propertyTypes[row.type],
      building: row.building ? buildings[row.building] : "",
      // An unfinished draft stores 0 where nothing was entered yet.
      price: row.price > 0 ? String(row.price) : "",
      area: row.area > 0 ? String(row.area) : "",
    },
    images: row.images.map((image) => image.url),
  };
}

/** Whether any of these photo addresses belongs to someone else's listing, which a form must not take over. */
export async function photosOfOthers(ownerId: string, urls: string[]): Promise<boolean> {
  if (urls.length === 0) return false;
  return (await db().listingImage.count({ where: { url: { in: urls }, listing: { ownerId: { not: ownerId } } } })) > 0;
}

/** Whether the user chose to hide their number on new listings. */
export async function hidesPhoneByDefault(userId: string): Promise<boolean> {
  const user = await db().user.findUnique({ where: { id: userId }, select: { hidePhoneDefault: true } });
  return user?.hidePhoneDefault ?? false;
}

/** Everything a user has posted, whatever its status. */
export async function listMyListings(ownerId: string) {
  const rows = await db().listing.findMany({
    where: { ownerId },
    include: publicInclude,
    orderBy: { id: "desc" },
    take: 100,
  });
  return rows.map((row) => ({ listing: toListing(row), status: row.status }));
}

/** Takes a live or pending listing down. The owner check is part of the write, and a rejection cannot be overwritten. */
export async function archiveListing(ownerId: string, id: number): Promise<void> {
  await db().listing.updateMany({ where: { id, ownerId, status: { in: ["PENDING", "ACTIVE"] } }, data: { status: "ARCHIVED" } });
}
