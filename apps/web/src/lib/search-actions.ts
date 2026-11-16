"use server";

import { countListings, getHiddenIds } from "@mteam/db";
import { parseListingFilters } from "@mteam/shared";
import { currentUser } from "./session";

/** How many listings a search finds, as its results page will count them. */
export async function countSearchAction(search: string): Promise<number> {
  const user = await currentUser();
  const hiddenIds = user ? await getHiddenIds(user.id) : [];
  return countListings(parseListingFilters(Object.fromEntries(new URLSearchParams(search))), { hiddenIds });
}
