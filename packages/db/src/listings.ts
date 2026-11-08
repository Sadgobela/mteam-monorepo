import type { DealType as DbDealType, Prisma, PropertyType as DbPropertyType } from "@prisma/client";
import {
  cityNames,
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

const deals: Record<DbDealType, DealType> = { SALE: "sale", RENT: "rent", DAILY: "daily" };
const propertyTypes: Record<DbPropertyType, PropertyType> = {
  APARTMENT: "apartment",
  HOUSE: "house",
  COMMERCIAL: "commercial",
  LAND: "land",
};
const dbDeals: Record<DealType, DbDealType> = { sale: "SALE", rent: "RENT", daily: "DAILY" };
const dbPropertyTypes: Record<PropertyType, DbPropertyType> = {
  apartment: "APARTMENT",
  house: "HOUSE",
  commercial: "COMMERCIAL",
  land: "LAND",
};
const tones = ["violet", "sand", "steel", "rose"] as const;

/** Only what a public page may show: names and emails stay out, and the phone is the listing's contact number. */
export const publicInclude = {
  agent: { include: { branch: true, user: { select: { name: true, phone: true } } } },
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
  return {
    id: row.id,
    deal: deals[row.deal],
    type: propertyTypes[row.type],
    title: row.title,
    city: row.city,
    // The posting form requires district and address; rooms is 0 for property without rooms, and the UI hides it.
    district: row.district ?? "",
    address: row.address ?? "",
    rooms: row.rooms ?? 0,
    price: row.price,
    currency: row.currency,
    area: row.area,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    floor: row.floor ?? undefined,
    floors: row.floors ?? undefined,
    condition: row.condition ?? undefined,
    description: row.description,
    verified: row.verified,
    agent: row.agent
      ? {
          id: row.agent.id,
          name: row.agent.user.name ?? "",
          branch: row.agent.branch?.name ?? "",
          phone: row.agent.user.phone,
        }
      : undefined,
    verification: row.verifiedAt
      ? { by: row.verifiedBy?.user.name ?? "mTeam", at: row.verifiedAt.toISOString().slice(0, 10) }
      : undefined,
    contactPhone: row.agent?.user.phone ?? row.owner.phone,
    images: row.images.map((image) => image.url),
    // ponytail: placeholder gradient picked from the id, remove once every listing has photos.
    tone: tones[row.id % tones.length],
    updatedAt: row.updatedAt.toISOString().slice(0, 10),
  };
}

function roomsClause(rooms: number | undefined): Prisma.IntNullableFilter | number | undefined {
  return rooms === roomOptions[roomOptions.length - 1] ? { gte: rooms } : rooms;
}

function textClause(q: string | undefined): Prisma.ListingWhereInput[] | undefined {
  if (q === undefined) return undefined;
  // Without escaping, % and _ would act as LIKE wildcards.
  const match = { contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } as const;
  return [{ district: match }, { address: match }, { city: match }, { title: match }];
}

function whereFor(filters: ListingFilters): Prisma.ListingWhereInput {
  return {
    status: "ACTIVE",
    deal: filters.deal && dbDeals[filters.deal],
    type: filters.type && dbPropertyTypes[filters.type],
    city: filters.city && cityNames[filters.city],
    rooms: roomsClause(filters.rooms),
    verified: filters.verified,
    priceUsd: { gte: filters.priceMin, lte: filters.priceMax },
    area: { gte: filters.areaMin, lte: filters.areaMax },
    OR: textClause(filters.q),
  };
}

const orderings: Record<SortOrder, Prisma.ListingOrderByWithRelationInput[]> = {
  // Verified first is mTeam's default: trust leads, not paid placement.
  new: [{ verified: "desc" }, { id: "desc" }],
  asc: [{ priceUsd: "asc" }, { id: "desc" }],
  desc: [{ priceUsd: "desc" }, { id: "desc" }],
};

/** One page of published listings matching the filters. No filters means all of them. */
export async function searchListings(
  filters: ListingFilters = {},
  { sort = "new", page = 1, limit = PAGE_SIZE }: { sort?: SortOrder; page?: number; limit?: number } = {},
): Promise<Listing[]> {
  const rows = await db().listing.findMany({
    where: whereFor(filters),
    include: publicInclude,
    orderBy: orderings[sort],
    skip: (page - 1) * limit,
    take: limit,
  });
  return rows.map(toListing);
}

/** How many published listings match the filters, across all pages. */
export function countListings(filters: ListingFilters = {}): Promise<number> {
  return db().listing.count({ where: whereFor(filters) });
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

/** Saves a user's listing. It stays PENDING and unverified until mTeam reviews it. */
export async function createListing(ownerId: string, draft: ListingDraft, imageUrls: string[]): Promise<number> {
  const { id } = await db().listing.create({
    data: {
      ...draft,
      priceUsd: priceInUsd(draft.price, draft.currency),
      deal: dbDeals[draft.deal],
      type: dbPropertyTypes[draft.type],
      city: cityNames[draft.city],
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
