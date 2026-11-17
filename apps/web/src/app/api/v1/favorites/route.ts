import { NextResponse } from "next/server";
import { getGelPerUsd, listFavorites } from "@mteam/db";
import { fail } from "@/lib/api";
import { toPublicListing } from "@/lib/public-listing";
import { currentUser } from "@/lib/session";

/** The signed-in user's favourites, newest first. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const [listings, gelPerUsd] = await Promise.all([listFavorites(user.id), getGelPerUsd()]);
  return NextResponse.json({ listings: listings.map(toPublicListing), gelPerUsd });
}
