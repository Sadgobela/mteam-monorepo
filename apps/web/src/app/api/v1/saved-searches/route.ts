import { NextResponse } from "next/server";
import { listSavedSearches, saveSearch } from "@mteam/db";
import { canonicalSearch, defaultLocale, getDictionary, isLocale } from "@mteam/shared";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { searchName } from "@/lib/seo";

const saveSchema = z.object({ query: z.string().max(2000) });
/** The filters a saved search's name shows; the rest are counted as "+N". */
const NAMED = ["deal", "type", "city"];

/**
 * The user's saved searches as on the site's page: a name from deal, type and city in the asked language (`?locale=`),
 * how many other filters it has, and how many listings are new since it was last opened.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const asked = new URL(request.url).searchParams.get("locale") ?? "";
  const locale = isLocale(asked) ? asked : defaultLocale;
  const searches = await listSavedSearches(user.id);
  return NextResponse.json({
    searches: searches.map((search) => ({
      id: search.id,
      query: search.query,
      name: searchName(search.filters, locale) || getDictionary(locale).saved.allListings,
      others: Object.entries(search.filters).filter(([name, value]) => value !== undefined && !NAMED.includes(name)).length,
      newCount: search.newCount,
    })),
  });
}

/** Saves a search from its query string, in the same form as the site does. 409 `limit` when the user has too many. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const input = await readJson(request, saveSchema);
  const query = input ? canonicalSearch(Object.fromEntries(new URLSearchParams(input.query))) : "";
  if (!query) return fail("invalid", 400);
  return (await saveSearch(user.id, query)) ? NextResponse.json({ query }) : fail("limit", 409);
}
