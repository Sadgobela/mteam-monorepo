import { NextResponse } from "next/server";
import { getGelPerUsd, getPublicPerson, listSellerListings } from "@mteam/db";
import { fail } from "@/lib/api";
import { toPublicListing } from "@/lib/public-listing";

/** A seller's name, photo and live listings, as on their page on the site. 404 for someone with nothing published. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const [listings, seller] = await Promise.all([listSellerListings(id), getPublicPerson(id)]);
  if (listings.length === 0 || !seller) return fail("notFound", 404);
  return NextResponse.json({ seller, listings: listings.map(toPublicListing), gelPerUsd: await getGelPerUsd() });
}
