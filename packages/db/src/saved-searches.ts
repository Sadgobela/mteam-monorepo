import { parseListingFilters, type ListingFilters } from "@mteam/shared";
import { db } from "./client";
import { countListings } from "./listings";

const SAVED_LIMIT = 30;

export interface SavedSearchRow {
  id: string;
  query: string;
  filters: ListingFilters;
  newCount: number;
}

/** Remembers a search. Saving one twice is harmless; false means the user is at the limit. */
export async function saveSearch(userId: string, query: string): Promise<boolean> {
  const client = db();
  if ((await client.savedSearch.count({ where: { userId } })) >= SAVED_LIMIT) return false;
  await client.savedSearch.createMany({ data: [{ userId, query }], skipDuplicates: true });
  return true;
}

export async function isSearchSaved(userId: string, query: string): Promise<boolean> {
  return (await db().savedSearch.count({ where: { userId, query } })) > 0;
}

/** The owner check is part of the write. */
export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
  await db().savedSearch.deleteMany({ where: { id, userId } });
}

/** A user's searches, each with how many listings appeared since it was last opened. */
export async function listSavedSearches(userId: string): Promise<SavedSearchRow[]> {
  const rows = await db().savedSearch.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: SAVED_LIMIT });
  return Promise.all(
    rows.map(async ({ id, query, seenAt }) => {
      const filters = parseListingFilters(Object.fromEntries(new URLSearchParams(query)));
      // ponytail: counts by creation date, so a listing approved after the search was last opened is missed. Add a published date if moderation gets slow.
      return { id, query, filters, newCount: await countListings(filters, { since: seenAt }) };
    }),
  );
}

/** Marks a search as seen now and gives its URL parameters. Null when it is not this user's. */
export async function openSavedSearch(userId: string, id: string): Promise<string | null> {
  const client = db();
  const { count } = await client.savedSearch.updateMany({ where: { id, userId }, data: { seenAt: new Date() } });
  if (count === 0) return null;
  const row = await client.savedSearch.findFirst({ where: { id, userId }, select: { query: true } });
  return row?.query ?? null;
}
