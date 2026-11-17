import { NextResponse } from "next/server";
import { countMyListings, getGelPerUsd, listMyListingsTab, myListingTabs, type MyListingTab } from "@mteam/db";
import { fail } from "@/lib/api";
import { toPublicListing } from "@/lib/public-listing";
import { currentUser } from "@/lib/session";

const isTab = (value: string | null): value is MyListingTab => myListingTabs.includes(value as MyListingTab);

/**
 * One tab of the signed-in user's listings (`?tab=`), with how many each tab holds and, for each listing, its status,
 * numbers and what can be done with it now, as on the site's page. Without a tab, the first one with something in it.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const asked = new URL(request.url).searchParams.get("tab");
  const counts = await countMyListings(user.id);
  const tab = isTab(asked) ? asked : (myListingTabs.find((name) => counts[name] > 0) ?? "active");
  const [rows, gelPerUsd] = await Promise.all([listMyListingsTab(user.id, { tab }), getGelPerUsd()]);
  return NextResponse.json({
    tab,
    counts,
    listings: rows.map(({ listing, expiresAt, nextBumpAt, ...mine }) => ({
      ...toPublicListing(listing),
      ...mine,
      expiresAt: expiresAt?.toISOString() ?? null,
      nextBumpAt: nextBumpAt?.toISOString() ?? null,
    })),
    gelPerUsd,
  });
}
