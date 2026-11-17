import { NextResponse } from "next/server";
import { countSellerListings, getGelPerUsd, getListing, listSimilarListings } from "@mteam/db";
import { toPublicListing } from "@/lib/public-listing";

/**
 * One published listing for the mobile app, with similar ones and, for an owner's listing, how many the owner has live,
 * as the site links to them when there is more than this one. Unknown, unpublished and malformed ids are all not found.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const listing = await getListing((await params).id);
  if (!listing) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const [similar, sellerCount, gelPerUsd] = await Promise.all([listSimilarListings(listing), listing.agent ? 0 : countSellerListings(listing.sellerId), getGelPerUsd()]);
  return NextResponse.json({ listing: toPublicListing(listing), similar: similar.map(toPublicListing), sellerCount, gelPerUsd });
}
