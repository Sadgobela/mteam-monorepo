import type { DealType as DbDealType, Prisma, PropertyType as DbPropertyType } from "@prisma/client";
import {
  cityNames,
  roomOptions,
  type Currency,
  type DealType,
  type Listing,
  type ListingFilters,
  type PropertyType,
} from "@mteam/shared";
import { z } from "zod";
import { db } from "./client";

// ponytail: one page of results; add pagination when a search can match more than this.
const SEARCH_LIMIT = 24;
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
// ponytail: fixed rates. AED is pegged to USD; GEL drifts, so replace this with a stored daily rate if price filters need to be exact.
const unitsPerUsd: Record<Currency, number> = { USD: 1, GEL: 2.7, AED: 3.6725 };
const tones = ["violet", "sand", "steel", "rose"] as const;

/** Only what a public page may show: the owner and the broker's email stay out. */
const publicInclude = {
  agent: { include: { branch: true, user: { select: { name: true, phone: true } } } },
} satisfies Prisma.ListingInclude;

type ListingRow = Prisma.ListingGetPayload<{ include: typeof publicInclude }>;

/** Digits only, so "1e3" or " 12" do not resolve to a listing, and within the column's range. */
const listingIdSchema = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .transform(Number)
  .refine((id) => id <= POSTGRES_INT_MAX);

function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    deal: deals[row.deal],
    type: propertyTypes[row.type],
    title: row.title,
    city: row.city,
    // ponytail: empty/0 fallbacks until the posting form (step 4) decides which of these land and commercial listings may omit.
    district: row.district ?? "",
    address: row.address ?? "",
    rooms: row.rooms ?? 0,
    price: row.price,
    currency: row.currency,
    area: row.area,
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
    // ponytail: placeholder gradient picked from the id, remove once listings have photos.
    tone: tones[row.id % tones.length],
    updatedAt: row.updatedAt.toISOString().slice(0, 10),
  };
}

/** Price bounds are in USD; each listing is compared in its own currency. */
function priceClauses({ priceMin, priceMax }: ListingFilters): Prisma.ListingWhereInput[] | undefined {
  if (priceMin === undefined && priceMax === undefined) return undefined;
  return (Object.keys(unitsPerUsd) as Currency[]).map((currency) => {
    const rate = unitsPerUsd[currency];
    return {
      currency,
      price: {
        gte: priceMin === undefined ? undefined : Math.round(priceMin * rate),
        lte: priceMax === undefined ? undefined : Math.round(priceMax * rate),
      },
    };
  });
}

function roomsClause(rooms: number | undefined): Prisma.IntNullableFilter | number | undefined {
  return rooms === roomOptions[roomOptions.length - 1] ? { gte: rooms } : rooms;
}

/** Newest published listings matching the filters. No filters means all of them. */
export async function searchListings(filters: ListingFilters = {}): Promise<Listing[]> {
  const rows = await db().listing.findMany({
    where: {
      status: "ACTIVE",
      deal: filters.deal && dbDeals[filters.deal],
      type: filters.type && dbPropertyTypes[filters.type],
      city: filters.city && cityNames[filters.city],
      rooms: roomsClause(filters.rooms),
      OR: priceClauses(filters),
    },
    include: publicInclude,
    orderBy: { id: "desc" },
    take: SEARCH_LIMIT,
  });
  return rows.map(toListing);
}

export function countActiveListings(): Promise<number> {
  return db().listing.count({ where: { status: "ACTIVE" } });
}

/** Takes the raw URL segment. Unknown, unpublished and malformed ids all return undefined. */
export async function getListing(rawId: string): Promise<Listing | undefined> {
  const id = listingIdSchema.safeParse(rawId);
  if (!id.success) return undefined;
  const row = await db().listing.findFirst({ where: { id: id.data, status: "ACTIVE" }, include: publicInclude });
  return row ? toListing(row) : undefined;
}
