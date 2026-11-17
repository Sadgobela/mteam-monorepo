import { NextResponse } from "next/server";
import { getGelPerUsd, listMyListings } from "@mteam/db";
import { fail } from "@/lib/api";
import { toPublicListing } from "@/lib/public-listing";
import { currentUser } from "@/lib/session";

/** Everything the signed-in user has posted, with each listing's status. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const [rows, gelPerUsd] = await Promise.all([listMyListings(user.id), getGelPerUsd()]);
  return NextResponse.json({ listings: rows.map(({ listing, status }) => ({ ...toPublicListing(listing), status })), gelPerUsd });
}
