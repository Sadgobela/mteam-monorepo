"use server";

import { claimAssistantQuery, countListings, getGelPerUsd, getHiddenIds } from "@mteam/db";
import { parseListingFilters } from "@mteam/shared";
import { interpretSearch } from "./assistant-ai";
import { clientIp, currentUser } from "./session";

/** How many listings a search finds, as its results page will count them. */
export async function countSearchAction(search: string): Promise<number> {
  const user = await currentUser();
  const hiddenIds = user ? await getHiddenIds(user.id) : [];
  return countListings(parseListingFilters(Object.fromEntries(new URLSearchParams(search))), { hiddenIds });
}

const MAX_MESSAGE = 300;

export type AskResult = { search: string } | { error: "unclear" | "busy" | "failed" };

/** Reads what the visitor typed into the assistant and returns the updated search. */
export async function askAssistantAction(text: string, current: string): Promise<AskResult> {
  const message = String(text).trim();
  if (!message || message.length > MAX_MESSAGE) return { error: "unclear" };
  if (!(await claimAssistantQuery(await clientIp()))) return { error: "busy" };
  try {
    const search = await interpretSearch(message, String(current), await getGelPerUsd());
    return search ? { search } : { error: "unclear" };
  } catch (error) {
    console.error(error);
    return { error: "failed" };
  }
}
