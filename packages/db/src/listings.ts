import type { BuildingStatus as DbBuildingStatus, DealType as DbDealType, Prisma, PropertyType as DbPropertyType } from "@prisma/client";
import {
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
    verified: row.verified,
    marketLevel: row.marketLevel ?? undefined,
    agent: agent
      ? {
          id: agent.id,
          name: agent.user.name ?? "",
          branch: agent.branch?.name ?? "",
          phone: agent.user.phone,
        }
      : undefined,
    verification: row.verifiedAt
      ? { by: row.verifiedBy?.user.name ?? "MTeam", at: row.verifiedAt.toISOString().slice(0, 10) }
      : undefined,
    contactPhone: agent?.user.phone ?? row.owner.phone,
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

function whereFor(filters: ListingFilters, located = false, hiddenIds: number[] = []): Prisma.ListingWhereInput {
  return {
    status: "ACTIVE",
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

const orderings: Record<SortOrder, Prisma.ListingOrderByWithRelationInput[]> = {
  // Verified first is MTeam's default: trust leads, not paid placement.
  new: [{ verified: "desc" }, { id: "desc" }],
  asc: [{ priceUsd: "asc" }, { id: "desc" }],
  desc: [{ priceUsd: "desc" }, { id: "desc" }],
};

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
  const rows = await db().listing.findMany({
    where: whereFor(filters, located, hiddenIds),
    include: publicInclude,
    orderBy: orderings[sort],
    skip: (page - 1) * limit,
    take: limit,
  });
  return rows.map(toListing);
}

/** How many published listings match the filters, across all pages. */
export function countListings(filters: ListingFilters = {}, { located = false, hiddenIds = [] }: { located?: boolean; hiddenIds?: number[] } = {}): Promise<number> {
  return db().listing.count({ where: whereFor(filters, located, hiddenIds) });
}

const SIMILAR_LIMIT = 4;
const SIMILAR_PRICE_SPREAD = 0.3;

/** Same deal, type and city at a nearby price and size. */
export async function listSimilarListings(listing: Listing, hiddenIds: number[] = []): Promise<Listing[]> {
  const usd = priceInUsd(listing.price, listing.currency);
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

/** A validated draft as listing columns. */
export function draftColumns(draft: ListingDraft) {
  return {
    ...draft,
    priceUsd: priceInUsd(draft.price, draft.currency),
    pricePerSqmUsd: Math.round(priceInUsd(draft.price, draft.currency) / draft.area),
    building: draft.building && dbBuildings[draft.building],
    deal: dbDeals[draft.deal],
    type: dbPropertyTypes[draft.type],
  };
}

/** Saves a user's listing. It stays PENDING and unverified until MTeam reviews it. */
export async function createListing(ownerId: string, draft: ListingDraft, imageUrls: string[]): Promise<number> {
  const { id } = await db().listing.create({
    data: {
      ...draftColumns(draft),
      status: "PENDING",
      verified: false,
      ownerId,
      images: { create: imageUrls.map((url, position) => ({ url, position })) },
    },
    select: { id: true },
  });
  return id;
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
