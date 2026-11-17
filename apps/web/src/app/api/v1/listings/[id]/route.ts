import { NextResponse } from "next/server";
import { getGelPerUsd, getListing, listSimilarListings } from "@mteam/db";
import { toPublicListing } from "@/lib/public-listing";

/** One published listing for the mobile app, with similar ones. Unknown, unpublished and malformed ids are all not found. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const listing = await getListing((await params).id);
  if (!listing) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const [similar, gelPerUsd] = await Promise.all([listSimilarListings(listing), getGelPerUsd()]);
  return NextResponse.json({ listing: toPublicListing(listing), similar: similar.map(toPublicListing), gelPerUsd });
}
