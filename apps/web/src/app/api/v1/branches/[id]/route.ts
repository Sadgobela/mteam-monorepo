import { NextResponse } from "next/server";
import { getBranch, getGelPerUsd } from "@mteam/db";
import { fail } from "@/lib/api";
import { toPublicListing } from "@/lib/public-listing";

/** One branch with its brokers and their live listings, as on the site's branch page. 404 for an empty or unknown one. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const branch = await getBranch((await params).id);
  if (!branch) return fail("notFound", 404);
  const { brokers, listings, ...place } = branch;
  return NextResponse.json({
    branch: place,
    brokers: brokers.map(({ id, name, branch: office, listingCount }) => ({ id, name, branch: office, listingCount })),
    listings: listings.map(toPublicListing),
    gelPerUsd: await getGelPerUsd(),
  });
}
