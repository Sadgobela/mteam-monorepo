import type { Listing } from "@mteam/shared";
import { db } from "./client";
import { publicInclude, toListing } from "./listings";

const LIST_LIMIT = 100;

/** Sets a favourite to the state the user asked for, so a double click or a stale tab cannot undo it. Only published listings can be added. */
export async function setFavorite(userId: string, listingId: number, want: boolean): Promise<void> {
  const client = db();
  if (!want) {
    await client.favorite.deleteMany({ where: { userId, listingId } });
    return;
  }
  const listing = await client.listing.findFirst({ where: { id: listingId, status: "ACTIVE" }, select: { id: true } });
  if (listing) await client.favorite.createMany({ data: [{ userId, listingId }], skipDuplicates: true });
}

export async function getFavoriteIds(userId: string): Promise<number[]> {
  const rows = await db().favorite.findMany({ where: { userId }, select: { listingId: true } });
  return rows.map((row) => row.listingId);
}

/** A user's saved listings, newest save first. Listings that are no longer published drop out. */
export async function listFavorites(userId: string): Promise<Listing[]> {
  const rows = await db().favorite.findMany({
    where: { userId, listing: { status: "ACTIVE" } },
    include: { listing: { include: publicInclude } },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
  });
  return rows.map((row) => toListing(row.listing));
}
